// How one tenant payment is divided. Pure arithmetic (no database) so it can be tested on its own.
//
// - Rent and late fees are the landlord's rental income. CasaVilla's commission and the tax set aside are
//   worked out on them. Paying ahead (credit) counts as rent.
// - VAT (18%) only applies to VAT-registered landlords letting commercial property; residential rent is exempt.
//   Rent is treated as VAT-inclusive, so VAT = 18/118 of it.
// - Individual landlords' rental tax is 12% of rent above UGX 2,820,000 a tax year (July–June). It is set aside
//   on the margin: the extra tax this payment causes, given the rent already received this tax year.
// - Deposits, utility bills and repair recharges pass straight through: no commission, no tax.
import { RENTAL_TAX } from "./rules";

export const VAT_RATE = 0.18;
export const RENT_KINDS = ["rent", "late_fee"] as const;

export function rentalTaxOn(yearRent: number) {
  return Math.round(Math.max(0, yearRent - RENTAL_TAX.threshold) * RENTAL_TAX.rate);
}

export type SplitInput = {
  /** What the payment settled, by charge kind. */
  lines: { kind: string; amount: number }[];
  /** Paid beyond what was owed (kept as credit for next rent). */
  credit: number;
  commissionPct: number;
  taxMode: "individual" | "none";
  vatApplies: boolean;
  /** Rent (excluding VAT) already received this tax year, before this payment. */
  yearRentBefore: number;
};

export function splitPayment(i: SplitInput) {
  const gross = i.lines.reduce((s, l) => s + l.amount, 0) + i.credit;
  const rentish = i.lines.filter((l) => (RENT_KINDS as readonly string[]).includes(l.kind)).reduce((s, l) => s + l.amount, 0) + i.credit;
  const vat = i.vatApplies ? Math.round((rentish * VAT_RATE) / (1 + VAT_RATE)) : 0;
  const taxableRent = rentish - vat;
  const commission = Math.round((taxableRent * Math.max(0, i.commissionPct)) / 100);
  const rentalTax = i.taxMode === "individual" ? rentalTaxOn(i.yearRentBefore + taxableRent) - rentalTaxOn(i.yearRentBefore) : 0;
  const net = gross - commission - vat - rentalTax;
  return { gross, taxableRent, commission, vat, rentalTax, net };
}

/**
 * Cash the landlord's side collected: they already hold the money, so CasaVilla's commission and the tax set
 * aside are owed back and taken from their next payouts, oldest first. Returns how much to take from each debt
 * and what is left to send.
 */
export function recoverFrom(net: number, debts: { id: number; outstanding: number }[]) {
  let left = Math.max(0, net);
  const take: { id: number; amount: number }[] = [];
  for (const d of debts) {
    if (left <= 0) break;
    const a = Math.min(left, Math.max(0, d.outstanding));
    if (a > 0) { take.push({ id: d.id, amount: a }); left -= a; }
  }
  return { take, send: left };
}

/** The tax year (July–June, Kampala time) a date falls in, as its starting year. */
export const taxYearStart = (d: Date) => {
  const k = new Date(d.getTime() + 3 * 3600 * 1000);
  const m = k.getUTCMonth() + 1, y = k.getUTCFullYear();
  return m >= 7 ? y : y - 1;
};

/** Start of a tax year (1 July, Kampala midnight) as a Date. */
export const taxYearFrom = (startYear: number) => new Date(`${startYear}-07-01T00:00:00+03:00`);
