import "server-only";
import { db } from "@/db";
import { notify, notifyManagers } from "./notify";
import { audit } from "./audit";
import { ugx } from "./format";
import { recoverFrom, splitPayment, taxYearFrom, taxYearStart } from "./split";
import { sendTransfer, transferStatus } from "./momo";

/**
 * Landlord payouts.
 *
 * When a tenant pays, the payment is split (see lib/split.ts) and a Payout row records it:
 * - money that reached CasaVilla (Mobile Money, or cash paid at the office) is sent to the landlord's Mobile
 *   Money or bank, minus commission and tax set aside — and minus anything they still owe from cash payments;
 * - cash the landlord or caretaker took themselves stays with them, so its commission and tax are owed back
 *   and taken from their next payouts.
 *
 * PAYOUT_MODE controls whether money actually moves:
 *   off (default) — payouts are worked out and queued, nothing is sent;
 *   sandbox       — sending is simulated (for testing);
 *   live          — real transfers through Flutterwave (needs PAYMENT_PROVIDER=flutterwave and FLW_SECRET_KEY).
 * PAYOUT_DAILY_LIMIT (UGX, optional) stops automatic sending once a day's total would pass it.
 * Automatic sending only picks up payouts from the last 48 hours, so switching payouts on never sends an old
 * backlog (which may already have been paid by hand); older ones wait for a manager ("Send now" / "Mark paid").
 */
const AUTO_WINDOW_MS = 48 * 3600 * 1000;
export type PayoutMode = "off" | "sandbox" | "live";
export function payoutMode(): PayoutMode {
  const m = (process.env.PAYOUT_MODE || "off").toLowerCase();
  if (m === "live") return process.env.PAYMENT_PROVIDER === "flutterwave" && process.env.FLW_SECRET_KEY ? "live" : "off";
  return m === "sandbox" ? "sandbox" : "off";
}

const COMMERCIAL = ["Commercial / shops", "Office"];

/** Works out the split for a successful payment and records it. Safe to call twice (one payout per payment). */
export async function createPayout(paymentId: number) {
  if (await db.payout.findUnique({ where: { paymentId }, select: { id: true } })) return null;
  const p = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      allocations: { where: { source: "payment" }, include: { charge: { select: { kind: true } } } },
      recordedBy: { select: { role: true } },
      lease: { select: { landlordId: true, landlord: { select: { commissionPct: true, efrisProfile: true } }, unit: { select: { property: { select: { type: true } } } } } },
    },
  });
  if (!p || p.status !== "success" || !p.paidAt) return null;
  const prof = p.lease.landlord.efrisProfile;
  const lines = p.allocations.map((a) => ({ kind: a.charge.kind, amount: a.amount }));
  const credit = Math.max(0, p.amount - lines.reduce((s, l) => s + l.amount, 0));
  const ty = taxYearStart(p.paidAt);
  const before = await db.payout.aggregate({
    _sum: { taxableRent: true },
    where: { landlordId: p.lease.landlordId, payment: { paidAt: { gte: taxYearFrom(ty), lt: taxYearFrom(ty + 1) } } },
  });
  const split = splitPayment({
    lines, credit,
    commissionPct: p.lease.landlord.commissionPct,
    taxMode: prof?.taxMode === "none" ? "none" : "individual",
    vatApplies: !!prof?.vatRegistered && COMMERCIAL.includes(p.lease.unit.property.type),
    yearRentBefore: before._sum.taxableRent ?? 0,
  });
  // Mobile Money comes into CasaVilla's account; so does cash taken at the office. Cash a landlord or caretaker
  // recorded is already with them.
  const atCasaVilla = !p.recordedBy || p.recordedBy.role === "manager";
  const deductions = split.commission + split.rentalTax + split.vat;
  const row = await db.$transaction(async (tx) => {
    if (!atCasaVilla) {
      return tx.payout.create({
        data: { paymentId, landlordId: p.lease.landlordId, ...split, collectedBy: "landlord", amount: 0, status: deductions > 0 ? "owed" : "settled", reference: `payout-${paymentId}` },
      });
    }
    const debts = await tx.payout.findMany({ where: { landlordId: p.lease.landlordId, status: "owed" }, orderBy: { createdAt: "asc" }, select: { id: true, commission: true, rentalTax: true, vat: true, recovered: true } });
    const { take, send } = recoverFrom(split.net, debts.map((d) => ({ id: d.id, outstanding: d.commission + d.rentalTax + d.vat - d.recovered })));
    for (const t of take) {
      const d = debts.find((x) => x.id === t.id)!;
      const total = d.recovered + t.amount;
      await tx.payout.update({ where: { id: d.id }, data: { recovered: total, status: total >= d.commission + d.rentalTax + d.vat ? "settled" : "owed" } });
    }
    const recovered = take.reduce((s, t) => s + t.amount, 0);
    return tx.payout.create({
      data: { paymentId, landlordId: p.lease.landlordId, ...split, collectedBy: "casavilla", recovered, amount: send, status: send > 0 ? "queued" : "paid", reference: `payout-${paymentId}`, ...(send > 0 ? {} : { sentAt: new Date(), error: recovered ? "Nothing to send: all of it covered money owed from earlier cash payments" : null }) },
    });
  });
  await audit(null, "payout.created", "payment", paymentId, `${ugx(split.gross)}: commission ${ugx(split.commission)}, tax ${ugx(split.rentalTax + split.vat)}, landlord ${ugx(split.net)}${row.recovered ? `, ${ugx(row.recovered)} recovered` : ""}`);
  return row;
}

/** Sends one queued (or failed) payout. Never throws: problems are written on the payout and retried later. */
export async function sendPayout(payoutId: number, opts: { byManager?: boolean } = {}) {
  const mode = payoutMode();
  if (mode === "off") return;
  const recentOnly = opts.byManager ? {} : { createdAt: { gte: new Date(Date.now() - AUTO_WINDOW_MS) } };
  const claimed = await db.payout.updateMany({ where: { id: payoutId, status: { in: ["queued", "failed"] }, amount: { gt: 0 }, ...recentOnly }, data: { status: "sending", attempts: { increment: 1 }, error: null } });
  if (!claimed.count) return;
  const po = await db.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { landlord: { select: { id: true, name: true, payoutAccount: true } } } });
  const fail = async (error: string, status = "failed") => {
    await db.payout.update({ where: { id: po.id }, data: { status, error } });
  };
  const acct = po.landlord.payoutAccount;
  if (!acct) {
    await fail("No payout account yet — the landlord needs to add their Mobile Money number or bank", "queued");
    if (po.attempts <= 1) await notify(po.landlordId, `You have ${ugx(po.amount)} waiting. Add your Mobile Money number or bank to receive it.`, "/landlord/payouts");
    return;
  }
  const limit = Number(process.env.PAYOUT_DAILY_LIMIT) || 0;
  if (limit) {
    const since = new Date(Date.now() - 86400000);
    const sent = await db.payout.aggregate({ _sum: { amount: true }, where: { status: { in: ["paid", "sending"] }, sentAt: { gte: since }, id: { not: po.id } } });
    if ((sent._sum.amount ?? 0) + po.amount > limit) {
      await fail(`Held: today's payouts would pass the daily limit of ${ugx(limit)}`, "queued");
      await notifyManagers(`A payout of ${ugx(po.amount)} to ${po.landlord.name} is held by the daily limit. Release it from Payouts.`, "/manager/payouts");
      return;
    }
  }
  const destination = acct.method === "bank" ? `${acct.bankName ?? acct.bankCode} · ${acct.accountNumber}` : acct.phone!;
  const r = mode === "sandbox"
    ? { ok: true as const, id: `SANDBOX-${po.id}`, done: true }
    : await sendTransfer({ reference: po.reference, amount: po.amount, method: acct.method as "mtn" | "airtel" | "bank", phone: acct.phone, bankCode: acct.bankCode, accountNumber: acct.accountNumber, name: acct.accountName, narration: `CasaVilla rent payout ${po.reference}` });
  if (!r.ok) {
    await fail(r.error);
    if (po.attempts >= 3) await notifyManagers(`Payout of ${ugx(po.amount)} to ${po.landlord.name} keeps failing: ${r.error}`, "/manager/payouts");
    return;
  }
  await db.payout.update({ where: { id: po.id }, data: { status: r.done ? "paid" : "sending", providerRef: r.id, method: acct.method, destination, sentAt: new Date() } });
  if (r.done) await paidNotice(po.id);
}

async function paidNotice(payoutId: number) {
  const po = await db.payout.findUniqueOrThrow({ where: { id: payoutId }, include: { payment: { include: { tenant: { select: { name: true } } } } } });
  await notify(po.landlordId, `${ugx(po.amount)} sent to ${po.destination} — ${po.payment.tenant.name}'s payment of ${ugx(po.gross)}, after ${ugx(po.commission)} commission and ${ugx(po.rentalTax + po.vat)} tax set aside.`, "/landlord/payouts");
  await audit(null, "payout.paid", "payment", po.paymentId, `${ugx(po.amount)} to ${po.destination}`);
}

/** Hourly: send queued payouts and check the ones Flutterwave is still processing. */
export async function sendQueuedPayouts() {
  if (payoutMode() === "off") return 0;
  let n = 0;
  const pending = await db.payout.findMany({ where: { status: "sending", providerRef: { not: null } }, take: 50 });
  for (const po of pending) {
    if (payoutMode() !== "live") continue;
    const s = await transferStatus(po.providerRef!);
    if (s === "paid") { await db.payout.update({ where: { id: po.id }, data: { status: "paid" } }); await paidNotice(po.id); n++; }
    else if (s === "failed") await db.payout.update({ where: { id: po.id }, data: { status: "failed", error: "Flutterwave reported the transfer failed" } });
  }
  const queued = await db.payout.findMany({ where: { status: { in: ["queued", "failed"] }, amount: { gt: 0 }, attempts: { lt: 6 }, createdAt: { gte: new Date(Date.now() - AUTO_WINDOW_MS) } }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true } });
  for (const q of queued) { await sendPayout(q.id); n++; }
  return n;
}

/** Called once a payment succeeds: split it, then pay the landlord straight away if payouts are on. */
export async function afterPayment(paymentId: number) {
  try {
    const po = await createPayout(paymentId);
    if (po?.status === "queued") await sendPayout(po.id);
  } catch (e) {
    console.error("payout after payment", paymentId, e);
  }
}
