import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db, type Lease } from "@/db";
import { notify } from "./notify";
import { audit } from "./audit";
import { dateOnly, kampalaToday, periodLabel, ugx, ymd } from "./format";
import { LATE_FEE_GRACE_DAYS, PAYMENT_TIMEOUT_MIN } from "./rules";
import { verifyCharge, provider } from "./momo";
import { brandFor } from "./brand";
import { emailHtml, queueEmail } from "./mail";
import { appUrl, queueMessage } from "./messaging";

type Tx = Prisma.TransactionClient;

function monthsBetween(start: string, end: string) {
  const out: string[] = [];
  let [y, m] = start.slice(0, 7).split("-").map(Number);
  const [ey, em] = end.slice(0, 7).split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Serialises all money movements on one lease, so two payments can never both fill the same charge. */
async function lockLease(tx: Tx, leaseId: number) {
  await tx.$queryRaw`SELECT id FROM leases WHERE id = ${leaseId} FOR UPDATE`;
}

const statusFor = (amount: number, paid: number) => (paid >= amount ? "paid" : paid > 0 ? "partial" : "unpaid");

/**
 * Spreads money over a lease's open charges — the charge the tenant chose first, then the oldest due —
 * and records each piece as an Allocation. Returns what was left over. Caller must hold the lease lock.
 */
async function allocate(
  tx: Tx, leaseId: number, amount: number,
  o: { source: "payment" | "credit" | "deposit"; paymentId?: number; firstChargeId?: number },
) {
  const open = await tx.charge.findMany({
    where: { leaseId, status: { not: "paid" }, ...(o.source === "deposit" ? { kind: { not: "deposit" } } : {}) },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  const first = open.findIndex((c) => c.id === o.firstChargeId);
  if (first > 0) open.unshift(...open.splice(first, 1));
  let left = amount;
  for (const c of open) {
    if (left <= 0) break;
    const take = Math.min(c.amount - c.paid, left);
    if (take <= 0) continue;
    await tx.charge.update({ where: { id: c.id }, data: { paid: c.paid + take, status: statusFor(c.amount, c.paid + take) } });
    await tx.allocation.create({ data: { chargeId: c.id, paymentId: o.paymentId ?? null, amount: take, source: o.source } });
    left -= take;
  }
  return left;
}

/** Uses any advance-payment credit on a lease to settle its open charges. */
export async function applyCredit(leaseId: number) {
  await db.$transaction(async (tx) => {
    await lockLease(tx, leaseId);
    const l = await tx.lease.findUniqueOrThrow({ where: { id: leaseId } });
    if (l.credit <= 0) return;
    const left = await allocate(tx, leaseId, l.credit, { source: "credit" });
    if (left !== l.credit) await tx.lease.update({ where: { id: leaseId }, data: { credit: left } });
  });
}

/**
 * Brings a lease's charges up to date (idempotent):
 * deposit, every month's rent up to this month — including month-to-month "holdover" after the end date while
 * the tenant is still in — and late fees when the lease has them. Then applies any credit.
 */
export async function ensureCharges(lease: Lease) {
  if (lease.status !== "active") return;
  const today = kampalaToday();
  const rows: Prisma.ChargeCreateManyInput[] = [];
  if (lease.deposit > 0) {
    rows.push({ leaseId: lease.id, period: "DEPOSIT", kind: "deposit", description: "Security deposit", amount: lease.deposit, dueDate: lease.startDate });
  }
  const start = ymd(lease.startDate);
  if (start <= today) {
    // An agreed rent change applies from its month onwards (earlier months keep the old rent).
    const changeFrom = lease.nextRent && lease.nextRentFrom ? ymd(lease.nextRentFrom).slice(0, 7) : null;
    for (const p of monthsBetween(start, today)) {
      const day = Math.min(lease.dueDay, 28);
      const holdover = p > ymd(lease.endDate).slice(0, 7);
      rows.push({
        leaseId: lease.id, period: p, kind: "rent", amount: changeFrom && p >= changeFrom ? lease.nextRent! : lease.rent,
        description: `Rent — ${periodLabel(p)}${holdover ? " (month-to-month)" : ""}`,
        dueDate: dateOnly(`${p}-${String(day).padStart(2, "0")}`),
      });
    }
  }
  if (rows.length) await db.charge.createMany({ data: rows, skipDuplicates: true });
  if (lease.nextRent && lease.nextRentFrom && ymd(lease.nextRentFrom) <= today) {
    // The change has taken effect: it becomes the lease's rent.
    const done = await db.lease.updateMany({ where: { id: lease.id, nextRent: lease.nextRent }, data: { rent: lease.nextRent, nextRent: null, nextRentFrom: null } });
    if (done.count) await audit(null, "lease.rent_rise_effective", "lease", lease.id, `${ugx(lease.rent)} → ${ugx(lease.nextRent)}`);
  }

  if (lease.lateFeePct > 0) {
    const cutoff = dateOnly(addDays(today, -LATE_FEE_GRACE_DAYS));
    const late = await db.charge.findMany({ where: { leaseId: lease.id, kind: "rent", status: { not: "paid" }, dueDate: { lt: cutoff } } });
    const fee = Math.round((lease.rent * lease.lateFeePct) / 100);
    if (late.length && fee > 0) {
      const made = await db.charge.createMany({
        skipDuplicates: true,
        data: late.map((c) => ({
          leaseId: lease.id, period: `LATE-${c.period}`, kind: "late_fee", amount: fee,
          description: `Late fee — ${periodLabel(c.period)} (${lease.lateFeePct}%)`, dueDate: dateOnly(today),
        })),
      });
      if (made.count) await notify(lease.tenantId, `A late fee of ${ugx(fee)} was added for overdue rent. Pay soon to avoid more.`, "/tenant/rent");
    }
  }
  if (lease.credit > 0) await applyCredit(lease.id);
}

export async function ensureChargesFor(where: "tenant" | "landlord" | "all", userId?: number) {
  const list = await db.lease.findMany({
    where: { status: "active", ...(where === "tenant" ? { tenantId: userId } : where === "landlord" ? { landlordId: userId } : {}) },
  });
  for (const l of list) await ensureCharges(l);
}

/** Outstanding balance on a lease (all open charges). */
export async function leaseBalance(leaseId: number, client: Tx | typeof db = db) {
  const open = await client.charge.findMany({ where: { leaseId, status: { not: "paid" } }, select: { amount: true, paid: true } });
  return open.reduce((s, c) => s + c.amount - c.paid, 0);
}

/**
 * Marks a pending payment successful, spreads it over the charges, keeps any extra as credit and issues a receipt.
 * Safe to call twice (webhook + page refresh): only the first caller applies it.
 */
export async function completePayment(paymentId: number) {
  const year = kampalaToday().slice(0, 4);
  const receiptNo = `CV-${year}-${String(paymentId).padStart(6, "0")}`;
  const done = await db.$transaction(async (tx) => {
    const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "success", receiptNo, paidAt: new Date() } });
    if (claimed.count === 0) return null;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    await lockLease(tx, p.leaseId);
    const left = await allocate(tx, p.leaseId, p.amount, { source: "payment", paymentId: p.id, firstChargeId: p.chargeId });
    const l = await tx.lease.findUniqueOrThrow({ where: { id: p.leaseId }, select: { status: true, settlement: true } });
    if (l.status === "ended") {
      // Money after move-out reduces what's still owed in the final settlement (any extra becomes a refund due).
      await tx.lease.update({ where: { id: p.leaseId }, data: { settlement: (l.settlement ?? 0) + p.amount, ...(left > 0 ? { credit: { increment: left } } : {}) } });
    } else if (left > 0) await tx.lease.update({ where: { id: p.leaseId }, data: { credit: { increment: left } } });
    const balance = await leaseBalance(p.leaseId, tx);
    return { p, left, balance };
  });
  if (!done) return;
  const { p, left, balance } = done;
  const lease = await db.lease.findUniqueOrThrow({
    where: { id: p.leaseId }, include: { tenant: true, unit: { include: { property: true } } },
  });
  const extra = left > 0 ? ` ${ugx(left)} kept as credit for your next rent.` : balance > 0 ? ` Remaining balance ${ugx(balance)}.` : " You're fully paid up.";
  await notify(p.tenantId, `Payment of ${ugx(p.amount)} received. Receipt ${receiptNo}.${extra}`, `/receipts/${p.id}`);
  await notify(lease.landlordId, `${lease.tenant.name} paid ${ugx(p.amount)} for ${lease.unit.property.name} · ${lease.unit.label}.`, `/receipts/${p.id}`);
  // Email the receipt (queued; delivered once an email provider is set up).
  if (lease.tenant.emailReceipts) {
    const brand = await brandFor(lease.landlordId);
    const app = process.env.APP_URL || "https://casavilla-production.up.railway.app";
    await queueEmail({
      to: lease.tenant.email, subject: `Receipt ${receiptNo} — ${ugx(p.amount)} received`, attachKind: "receipt", attachId: p.id,
      html: emailHtml({ accent: brand.accentColor, title: `Payment received — ${ugx(p.amount)}`, lines: [`Hello ${lease.tenant.name.split(" ")[0]},`, `We received ${ugx(p.amount)} for ${lease.unit.property.name} · ${lease.unit.label}. Your receipt ${receiptNo} is attached.`, extra.trim()], button: { label: "View receipt", href: `${app}/receipts/${p.id}` }, footer: brand.displayName }),
    });
  }
  // A WhatsApp / SMS receipt too (people check WhatsApp far more than email).
  const first = lease.tenant.name.split(" ")[0];
  const msg = `Payment received: ${ugx(p.amount)} for ${lease.unit.property.name} · ${lease.unit.label}. Receipt ${receiptNo}`;
  await queueMessage({ userId: lease.tenantId, kind: "notice", dedupeKey: `receipt:${p.id}`, params: [first, `${msg}: ${appUrl(`/receipts/${p.id}`)}`], text: `Hello ${first}, ${msg}: ${appUrl(`/receipts/${p.id}`)} — CasaVilla` });
  await audit(p.recordedById ?? p.tenantId, "payment.received", "payment", p.id, `${ugx(p.amount)} via ${p.method}${left ? `, ${ugx(left)} to credit` : ""}`);
}

export async function failPayment(paymentId: number) {
  await db.payment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "failed" } });
}

/** Closes mobile-money requests the tenant never approved (after checking with the provider in live mode). */
export async function expireStalePayments() {
  const cutoff = new Date(Date.now() - PAYMENT_TIMEOUT_MIN * 60000);
  const stale = await db.payment.findMany({ where: { status: "pending", createdAt: { lt: cutoff }, method: { in: ["mtn", "airtel"] } }, take: 50 });
  for (const p of stale) {
    const r = provider === "sandbox" ? "failed" : await verifyCharge(p.reference, p.amount);
    if (r === "success") await completePayment(p.id);
    else await failPayment(p.id);
  }
  return stale.length;
}

/** Adds a one-off charge (water bill, damage, repair) to a lease. */
export async function addCharge(o: { leaseId: number; kind: string; description: string; amount: number; dueDate: string; actorId: number }) {
  const c = await db.charge.create({
    data: {
      leaseId: o.leaseId, kind: o.kind, description: o.description, amount: o.amount, dueDate: dateOnly(o.dueDate),
      period: `X-${Date.now().toString(36)}${randomBytes(2).toString("hex")}`,
    },
  });
  await audit(o.actorId, "charge.added", "charge", c.id, `${o.description}: ${ugx(o.amount)}`);
  const l = await db.lease.findUniqueOrThrow({ where: { id: o.leaseId } });
  if (l.credit > 0) await applyCredit(l.id);
  return c;
}

/** Writes off some or all of what's left on a charge. */
export async function waiveCharge(chargeId: number, amount: number, actorId: number, reason: string) {
  return db.$transaction(async (tx) => {
    const c0 = await tx.charge.findUniqueOrThrow({ where: { id: chargeId } });
    await lockLease(tx, c0.leaseId);
    const c = await tx.charge.findUniqueOrThrow({ where: { id: chargeId } });
    const open = c.amount - c.paid;
    const w = Math.min(open, amount);
    if (w <= 0) return 0;
    await tx.charge.update({ where: { id: c.id }, data: { amount: c.amount - w, waived: c.waived + w, status: statusFor(c.amount - w, c.paid) } });
    // After move-out, writing off a debt also improves the final settlement.
    const l = await tx.lease.findUniqueOrThrow({ where: { id: c.leaseId }, select: { status: true, settlement: true } });
    if (l.status === "ended" && c.kind !== "deposit") await tx.lease.update({ where: { id: c.leaseId }, data: { settlement: (l.settlement ?? 0) + w } });
    await audit(actorId, "charge.waived", "charge", c.id, `${ugx(w)} waived on ${c.description}${reason ? ` — ${reason}` : ""}`, tx);
    return w;
  });
}

/**
 * Move-out: removes unpaid charges for months after the move-out, optionally uses the held deposit
 * against what's still owed, and works out the settlement (refund due, or balance still owed).
 */
export async function settleLease(leaseId: number, moveOut: string, useDeposit: boolean) {
  return db.$transaction(async (tx) => {
    await lockLease(tx, leaseId);
    const l = await tx.lease.findUniqueOrThrow({ where: { id: leaseId } });
    const moveMonth = moveOut.slice(0, 7);
    // Rent for months after the tenant left is cancelled — but only if nothing was paid toward it.
    const future = await tx.charge.findMany({ where: { leaseId, kind: "rent", paid: 0, period: { gt: moveMonth } }, select: { id: true, period: true } });
    const futureIds = future.filter((c) => /^\d{4}-\d{2}$/.test(c.period)).map((c) => c.id);
    if (futureIds.length) {
      await tx.charge.deleteMany({ where: { id: { in: futureIds } } });
      await tx.charge.deleteMany({ where: { leaseId, period: { in: future.map((c) => `LATE-${c.period}`) }, paid: 0 } });
    }

    const dep = await tx.charge.findFirst({ where: { leaseId, kind: "deposit" } });
    const used = await tx.allocation.aggregate({ _sum: { amount: true }, where: { source: "deposit", charge: { leaseId } } });
    let depositHeld = Math.max(0, (dep?.paid ?? 0) - (used._sum.amount ?? 0));
    let depositUsed = 0;
    if (useDeposit && depositHeld > 0) {
      const left = await allocate(tx, leaseId, depositHeld, { source: "deposit" });
      depositUsed = depositHeld - left;
      depositHeld = left;
    }
    let credit = l.credit;
    if (credit > 0) credit = await allocate(tx, leaseId, credit, { source: "credit" });
    // A deposit never fully paid isn't collectable once the tenant has left: write off the unpaid part.
    if (dep && dep.paid < dep.amount) {
      await tx.charge.update({ where: { id: dep.id }, data: { amount: dep.paid, waived: dep.waived + dep.amount - dep.paid, status: "paid" } });
    }
    const owed = (await tx.charge.findMany({ where: { leaseId, status: { not: "paid" }, kind: { not: "deposit" } }, select: { amount: true, paid: true } }))
      .reduce((s, c) => s + c.amount - c.paid, 0);
    const settlement = depositHeld + credit - owed;
    await tx.lease.update({ where: { id: leaseId }, data: { status: "ended", endedAt: dateOnly(moveOut), settlement, credit: 0 } });
    return { lease: l, depositUsed, depositHeld, credit, owed, settlement, cancelled: futureIds.length };
  });
}
