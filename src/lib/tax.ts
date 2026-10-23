import "server-only";
import { db } from "@/db";
import { kampalaToday, ugx } from "./format";
import { notifyManagers } from "./notify";

/**
 * Tax set aside from tenant payments (see lib/payouts.ts) and paid to URA on each landlord's behalf.
 *
 * URA isn't paid per transaction: CasaVilla generates a payment registration number (PRN) on the URA portal for
 * the landlord's TIN, pays it (bank or Mobile Money), and records it here. "In hand" is tax CasaVilla actually
 * holds — for cash the landlord took themselves, only once it has been taken back from their payouts.
 */
export type TaxKind = "rental" | "vat";
export const TAX_LABEL: Record<TaxKind, string> = { rental: "Rental income tax", vat: "VAT" };

export async function taxPositions(landlordId?: number) {
  const where = landlordId ? { landlordId } : {};
  const [rows, paid, landlords] = await Promise.all([
    db.payout.findMany({ where: { ...where, OR: [{ rentalTax: { gt: 0 } }, { vat: { gt: 0 } }] }, select: { landlordId: true, rentalTax: true, vat: true, collectedBy: true, recovered: true } }),
    db.taxRemittance.groupBy({ by: ["landlordId", "kind"], where, _sum: { amount: true } }),
    db.user.findMany({ where: { role: "landlord", ...(landlordId ? { id: landlordId } : {}) }, select: { id: true, name: true, efrisProfile: { select: { tin: true } } } }),
  ]);
  const by = new Map<number, Record<TaxKind, { due: number; inHand: number; paid: number }>>();
  const blank = () => ({ rental: { due: 0, inHand: 0, paid: 0 }, vat: { due: 0, inHand: 0, paid: 0 } });
  for (const r of rows) {
    const t = by.get(r.landlordId) ?? blank();
    t.rental.due += r.rentalTax; t.vat.due += r.vat;
    if (r.collectedBy === "casavilla") { t.rental.inHand += r.rentalTax; t.vat.inHand += r.vat; }
    else {
      // What has been taken back from the landlord goes to tax first (VAT, then rental tax), then commission.
      let back = r.recovered;
      const v = Math.min(back, r.vat); back -= v; t.vat.inHand += v;
      t.rental.inHand += Math.min(back, r.rentalTax);
    }
    by.set(r.landlordId, t);
  }
  for (const p of paid) {
    const t = by.get(p.landlordId) ?? blank();
    t[p.kind as TaxKind].paid += p._sum.amount ?? 0;
    by.set(p.landlordId, t);
  }
  return landlords
    .filter((l) => by.has(l.id))
    .map((l) => {
      const t = by.get(l.id)!;
      const kinds = (["rental", "vat"] as TaxKind[]).filter((k) => t[k].due || t[k].paid).map((k) => ({ kind: k, ...t[k], toPay: Math.max(0, t[k].inHand - t[k].paid), withLandlord: Math.max(0, t[k].due - t[k].inHand) }));
      return { landlordId: l.id, name: l.name, tin: l.efrisProfile?.tin ?? null, kinds, toPay: kinds.reduce((s, k) => s + k.toPay, 0) };
    })
    .sort((a, b) => b.toPay - a.toPay);
}

/** On the 10th of each month: remind managers of tax set aside and not yet paid (VAT returns are due by the 15th). */
export async function taxReminders() {
  const today = kampalaToday();
  if (Number(today.slice(8, 10)) < 10) return 0;
  const claimed = await db.marker.createMany({ data: [{ key: `taxremind:${today.slice(0, 7)}` }], skipDuplicates: true });
  if (!claimed.count) return 0;
  const total = (await taxPositions()).reduce((s, p) => s + p.toPay, 0);
  if (total > 0) await notifyManagers(`${ugx(total)} of tax set aside for landlords is waiting to be paid to URA. VAT is due by the 15th.`, "/manager/tax");
  return total > 0 ? 1 : 0;
}
