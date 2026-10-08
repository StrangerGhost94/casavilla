import "server-only";
import { db, type Lease } from "@/db";
import { notify } from "./notify";
import { dateOnly, kampalaToday, periodLabel, ugx, ymd } from "./format";

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

/** Creates rent charges for every month of the lease up to the current month (idempotent). */
export async function ensureCharges(lease: Lease) {
  if (lease.status !== "active") return;
  const now = kampalaToday();
  const start = ymd(lease.startDate);
  const end = ymd(lease.endDate);
  const until = end < now ? end : now;
  const rows: { leaseId: number; period: string; description: string; amount: number; dueDate: Date }[] = [];
  if (lease.deposit > 0) {
    rows.push({ leaseId: lease.id, period: "DEPOSIT", description: "Security deposit", amount: lease.deposit, dueDate: lease.startDate });
  }
  for (const p of monthsBetween(start, until)) {
    const day = Math.min(lease.dueDay, 28);
    rows.push({ leaseId: lease.id, period: p, description: `Rent — ${periodLabel(p)}`, amount: lease.rent, dueDate: dateOnly(`${p}-${String(day).padStart(2, "0")}`) });
  }
  if (rows.length) await db.charge.createMany({ data: rows, skipDuplicates: true });
}

export async function ensureChargesFor(where: "tenant" | "landlord" | "all", userId?: number) {
  const list = await db.lease.findMany({
    where: { status: "active", ...(where === "tenant" ? { tenantId: userId } : where === "landlord" ? { landlordId: userId } : {}) },
  });
  for (const l of list) await ensureCharges(l);
}

/** Marks a pending payment successful, issues a receipt and updates the charge. Safe to call twice. */
export async function completePayment(paymentId: number) {
  const year = kampalaToday().slice(0, 4);
  const receiptNo = `CV-${year}-${String(paymentId).padStart(6, "0")}`;
  const done = await db.$transaction(async (tx) => {
    // Only the first caller flips pending → success; a webhook and a page refresh can't both apply it.
    const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "success", receiptNo, paidAt: new Date() } });
    if (claimed.count === 0) return null;
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const c = await tx.charge.update({ where: { id: p.chargeId }, data: { paid: { increment: p.amount } } });
    await tx.charge.update({ where: { id: c.id }, data: { status: c.paid >= c.amount ? "paid" : "partial" } });
    return p;
  });
  if (!done) return;
  const lease = await db.lease.findUniqueOrThrow({
    where: { id: done.leaseId }, include: { tenant: true, unit: { include: { property: true } } },
  });
  await notify(done.tenantId, `Payment of ${ugx(done.amount)} received. Receipt ${receiptNo}.`, `/receipts/${done.id}`);
  await notify(lease.landlordId, `${lease.tenant.name} paid ${ugx(done.amount)} for ${lease.unit.property.name} · ${lease.unit.label}.`, `/receipts/${done.id}`);
}

export async function failPayment(paymentId: number) {
  await db.payment.updateMany({ where: { id: paymentId, status: "pending" }, data: { status: "failed" } });
}
