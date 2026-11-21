import "server-only";
import { db } from "@/db";
import { audit } from "./audit";
import { ugx } from "./format";
import { recoverFrom, splitPayment, taxYearFrom, taxYearStart } from "./split";

/**
 * The split of every successful payment: CasaVilla's commission, tax set aside, and the landlord's share.
 * One Payout row per payment records it for statements and tax for URA. CasaVilla's finance department pays
 * landlords outside the app, so nothing here sends money.
 * Cash a landlord took themselves stays with them, so its commission and tax are owed back and recovered
 * from the next payments that come through CasaVilla.
 */
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

/** Called once a payment succeeds: record the split. Never blocks or undoes the payment. */
export async function afterPayment(paymentId: number) {
  try {
    await createPayout(paymentId);
  } catch (e) {
    console.error("payout after payment", paymentId, e);
  }
}
