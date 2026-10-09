import "server-only";
import { db } from "@/db";
import { RENTAL_TAX } from "./rules";
import { fmtDate, kampalaToday, ugx } from "./format";
import { PdfWriter, embedLogo } from "./pdf";
import { brandFor } from "./brand";

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(`${month}-01T00:00:00+03:00`);
  const end = new Date(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01T00:00:00+03:00`);
  return { start, end };
};
/** Uganda's tax year for individuals runs 1 July – 30 June. */
export const taxYearOf = (month: string) => { const [y, m] = month.split("-").map(Number); const from = m >= 7 ? y : y - 1; return { from, label: `July ${from} – June ${from + 1}`, start: `${from}-07`, end: `${from + 1}-06` }; };

export function rentalTax(grossYear: number) {
  return Math.round(Math.max(0, grossYear - RENTAL_TAX.threshold) * RENTAL_TAX.rate);
}

/** Money actually received in a period, split by what it paid for (rent, deposits, bills…) and by property. */
async function received(landlordId: number, start: Date, end: Date, propertyId?: number) {
  const allocs = await db.allocation.findMany({
    where: {
      source: "payment",
      payment: { status: "success", paidAt: { gte: start, lt: end } },
      charge: { lease: { landlordId, ...(propertyId ? { unit: { propertyId } } : {}) } },
    },
    select: { amount: true, charge: { select: { kind: true, lease: { select: { unit: { select: { propertyId: true } } } } } } },
  });
  // Money paid beyond what was owed sits as credit — still received this month.
  const pays = await db.payment.findMany({
    where: { status: "success", paidAt: { gte: start, lt: end }, lease: { landlordId, ...(propertyId ? { unit: { propertyId } } : {}) } },
    select: { amount: true, lease: { select: { unit: { select: { propertyId: true } } } }, allocations: { select: { amount: true } } },
  });
  const stays = await db.booking.findMany({
    where: { status: { in: ["confirmed", "completed"] }, paidAt: { gte: start, lt: end }, unit: { property: { landlordId, ...(propertyId ? { id: propertyId } : {}) } } },
    select: { total: true, unit: { select: { propertyId: true } } },
  });
  const byKind: Record<string, number> = {};
  const byProperty = new Map<number, number>();
  const addP = (pid: number, n: number) => byProperty.set(pid, (byProperty.get(pid) ?? 0) + n);
  for (const a of allocs) { byKind[a.charge.kind] = (byKind[a.charge.kind] ?? 0) + a.amount; addP(a.charge.lease.unit.propertyId, a.amount); }
  for (const p of pays) {
    const extra = p.amount - p.allocations.reduce((s, a) => s + a.amount, 0);
    if (extra > 0) { byKind.credit = (byKind.credit ?? 0) + extra; addP(p.lease.unit.propertyId, extra); }
  }
  for (const b of stays) { byKind.short_stay = (byKind.short_stay ?? 0) + b.total; addP(b.unit.propertyId, b.total); }
  const total = Object.values(byKind).reduce((s, n) => s + n, 0);
  return { byKind, byProperty, total };
}

/**
 * A landlord's monthly statement: what came in, what went out, CasaVilla's commission, and the net — plus
 * arrears and occupancy at the end of the month, and a rental-tax estimate for the tax year so far.
 */
export async function statement(landlordId: number, month: string, propertyId?: number) {
  const { start, end } = monthRange(month);
  const landlord = await db.user.findUniqueOrThrow({ where: { id: landlordId }, select: { id: true, name: true, businessName: true, commissionPct: true, phone: true, email: true } });
  const properties = await db.property.findMany({ where: { landlordId, ...(propertyId ? { id: propertyId } : {}) }, orderBy: { name: "asc" }, select: { id: true, name: true, units: { select: { id: true, status: true, mode: true } } } });
  const inc = await received(landlordId, start, end, propertyId);
  const expenses = await db.expense.findMany({
    where: { landlordId, status: "approved", spentOn: { gte: new Date(`${month}-01T00:00:00Z`), lt: new Date(end.getTime() + 3 * 3600000) }, ...(propertyId ? { propertyId } : {}) },
    orderBy: { spentOn: "asc" }, include: { property: { select: { name: true } }, unit: { select: { label: true } } },
  });
  // Commission is on rent actually collected (and short-stay income), not deposits or bills passed through.
  const commissionBase = (inc.byKind.rent ?? 0) + (inc.byKind.late_fee ?? 0) + (inc.byKind.short_stay ?? 0);
  const commission = Math.round((commissionBase * landlord.commissionPct) / 100);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  // Deposits are held for the tenant, not income — shown separately.
  const deposits = inc.byKind.deposit ?? 0;
  const income = inc.total - deposits;
  const net = income - spent - commission;

  const monthEnd = new Date(end.getTime() - 1);
  const arrearsRows = await db.charge.findMany({
    where: { status: { not: "paid" }, dueDate: { lte: monthEnd }, kind: { not: "deposit" }, lease: { landlordId, status: "active", ...(propertyId ? { unit: { propertyId } } : {}) } },
    select: { amount: true, paid: true },
  });
  const arrears = arrearsRows.reduce((s, c) => s + c.amount - c.paid, 0);
  const longUnits = properties.flatMap((p) => p.units.filter((u) => u.mode === "long"));
  const occupied = longUnits.filter((u) => u.status === "occupied").length;

  // Rental tax estimate: gross rent received in the tax year up to the end of this month (individuals).
  const ty = taxYearOf(month);
  const yearInc = await received(landlordId, new Date(`${ty.start}-01T00:00:00+03:00`), end, propertyId);
  const grossRentYear = (yearInc.byKind.rent ?? 0) + (yearInc.byKind.late_fee ?? 0) + (yearInc.byKind.short_stay ?? 0);

  return {
    landlord, month, properties, propertyId: propertyId ?? null,
    income, deposits, byKind: inc.byKind, byProperty: inc.byProperty,
    expenses, byCategory, spent, commission, commissionPct: landlord.commissionPct, net,
    arrears, units: longUnits.length, occupied,
    tax: { year: ty.label, grossRent: grossRentYear, estimate: rentalTax(grossRentYear), threshold: RENTAL_TAX.threshold, rate: RENTAL_TAX.rate },
  };
}
export type Statement = Awaited<ReturnType<typeof statement>>;

export const KIND_NAMES: Record<string, string> = { rent: "Rent", late_fee: "Late fees", utility: "Utility bills", repair: "Damage / repairs recharged", other: "Other charges", credit: "Paid in advance (credit)", short_stay: "Short stays", deposit: "Deposits (held)" };

export function lastMonths(n = 12) {
  const t = kampalaToday();
  let [y, m] = t.slice(0, 7).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) { out.push(`${y}-${String(m).padStart(2, "0")}`); m--; if (m === 0) { m = 12; y--; } }
  return out;
}
export const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** The statement as an A4 PDF, in the landlord's (or CasaVilla's) branding. */
export async function statementPdf(s: Statement) {
  const brand = await brandFor(s.landlord.id);
  const who = s.landlord.businessName || s.landlord.name;
  const w = await PdfWriter.create({ accent: brand.accentColor, title: `Statement ${s.month} — ${who}`, author: brand.displayName, footer: `${brand.displayName} · Statement for ${monthName(s.month)}` });
  const logo = await embedLogo(w, brand.logoFileId);
  if (logo) { w.image(logo, 120, 46); w.gap(54); }
  w.text("Landlord statement", { size: 18, bold: true, color: w.accent });
  w.text(`${who} · ${monthName(s.month)}${s.propertyId ? ` · ${s.properties[0]?.name ?? ""}` : " · all properties"}`, { size: 10 });
  w.gap(6);
  w.facts([["Received", ugx(s.income)], ["Expenses & fees", ugx(s.spent + s.commission)], ["Net to landlord", ugx(s.net)], ["Arrears at month end", ugx(s.arrears)], ["Units let", `${s.occupied} of ${s.units}`], ["Prepared", fmtDate(new Date())]], 3);
  w.heading("Money in");
  const inc = Object.entries(s.byKind).filter(([k, v]) => k !== "deposit" && v > 0).map(([k, v]) => [KIND_NAMES[k] ?? k, ugx(v)]);
  w.table(["What it paid for", "Amount"], inc.length ? inc : [["Nothing received", ugx(0)]], { totalRows: [["Total received", ugx(s.income)]] });
  if (s.deposits) { w.gap(4); w.text(`Deposits received (held for tenants, not income): ${ugx(s.deposits)}`, { size: 9, italic: true }); }
  if (s.properties.length > 1 && s.byProperty.size) {
    w.heading("By property");
    w.table(["Property", "Received"], s.properties.filter((p) => s.byProperty.get(p.id)).map((p) => [p.name, ugx(s.byProperty.get(p.id)!)]));
  }
  w.heading("Money out");
  const out = s.expenses.map((e) => [`${fmtDate(e.spentOn)} · ${e.category} · ${e.description}${e.property ? ` (${e.property.name})` : ""}`, ugx(e.amount)]);
  if (s.commission) out.push([`CasaVilla management fee — ${s.commissionPct}% of rent collected`, ugx(s.commission)]);
  w.table(["Expense", "Amount"], out.length ? out : [["No expenses this month", ugx(0)]], { totalRows: [["Total out", ugx(s.spent + s.commission)], ["Net to landlord", ugx(s.net)]] });
  w.heading("Rental income tax estimate");
  w.text(`Tax year ${s.tax.year}: gross rent received so far ${ugx(s.tax.grossRent)}. For individuals, rental tax is ${Math.round(s.tax.rate * 100)}% of gross rental income above ${ugx(s.tax.threshold)} a year, with no expenses deducted — about ${ugx(s.tax.estimate)} so far. This is an estimate; companies are taxed differently. Confirm with URA or your accountant.`, { size: 9 });
  return w.bytes();
}
