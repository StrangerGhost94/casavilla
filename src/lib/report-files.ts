import "server-only";
import ExcelJS from "exceljs";
import { PdfWriter, embedLogo } from "./pdf";
import { brandFor } from "./brand";
import type { FinancialReport } from "./reports";

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const ugx = (x: number) => `UGX ${n(x)}`;
const pct = (x: number | null) => (x == null ? "—" : `${x}%`);
const day = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 10);

/** The report as an A4 PDF in CasaVilla's branding (amounts in UGX). */
export async function reportPdf(r: FinancialReport, scopeLabel: string) {
  const brand = await brandFor(null);
  const w = await PdfWriter.create({ accent: brand.accentColor, title: `Financial report — ${r.period.label}`, author: brand.displayName, footer: `${brand.displayName} · Financial report · ${r.period.label}` });
  const logo = await embedLogo(w, brand.logoFileId);
  if (logo) { w.image(logo, 120, 46); w.gap(54); }
  w.text("Financial report", { size: 18, bold: true, color: w.accent });
  w.text(`${scopeLabel} · ${r.period.label}`, { size: 10 });
  w.text(`Prepared ${day(r.generatedAt)} · arrears as at ${r.asOf} · all amounts in UGX`, { size: 8, italic: true });
  w.gap(8);
  const t = r.totals;
  w.facts([
    ["Collected (excl. deposits)", ugx(t.collected)], ["Billed (due in period)", ugx(t.billed)], ["Collection rate", pct(t.collectionRate)],
    ["Expenses", ugx(t.expenses)], ["CasaVilla commission", ugx(t.commission)], ["Net to landlords", ugx(t.netToLandlords)],
    ["Arrears", ugx(t.arrears)], ["Deposits held (active leases)", ugx(t.depositsHeld)], ["Occupancy", `${pct(t.occupancy)} (${t.occupied}/${t.units} units)`],
  ], 3);

  w.heading("Money in");
  w.table(["What it paid for", "Amount"], r.income.length ? r.income.map((i) => [i.label, n(i.amount)]) : [["Nothing received", "0"]], { totalRows: [["Total collected", n(t.collected)]] });
  if (t.deposits) { w.gap(3); w.text(`Deposits received in the period (held for tenants, not income): ${ugx(t.deposits)}`, { size: 8.5, italic: true }); }
  if (r.methods.length) {
    w.heading("How it was paid");
    w.table(["Method", "Payments", "Amount"], r.methods.map((m) => [m.label, String(m.count), n(m.amount)]), { widths: [260, 100, 139] });
  }
  w.heading("Money out");
  const out = r.expensesByCategory.map((e) => [e.category, n(e.amount)]);
  if (t.commission) out.push(["CasaVilla management commission", n(t.commission)]);
  w.table(["Expense", "Amount"], out.length ? out : [["No expenses recorded", "0"]], { totalRows: [["Total out", n(t.expenses + t.commission)], ["Net to landlords", n(t.netToLandlords)]] });

  if (r.byLandlord.length > 1 || !r.scope.landlordId) {
    w.heading("By landlord");
    w.table(["Landlord", "Collected", "Expenses", "Commission", "Net", "Arrears"],
      r.byLandlord.map((l) => [`${l.name}${l.commissionPct ? ` (${l.commissionPct}%)` : ""} · ${l.occupied}/${l.units} let`, n(l.collected), n(l.expenses), n(l.commission), n(l.net), n(l.arrears)]),
      { widths: [149, 70, 70, 70, 70, 70] });
  }
  w.heading("By property");
  w.table(["Property", "Billed", "Collected", "Rate", "Expenses", "Arrears"],
    r.byProperty.map((p) => [`${p.name} · ${p.landlord} · ${p.occupied}/${p.units} let`, n(p.billed), n(p.collected), pct(p.rate), n(p.expenses), n(p.arrears)]),
    { widths: [159, 70, 70, 40, 70, 90] });

  w.heading("Arrears by age");
  w.table(["How late", "Amount"], Object.entries(r.aging).map(([k, v]) => [k, n(v)]), { totalRows: [["Total arrears", n(t.arrears)]] });
  if (r.debtors.length) {
    w.heading("Who owes", 11);
    w.table(["Tenant · property", "Days late", "Owed"], r.debtors.slice(0, 60).map((d) => [`${d.tenant} · ${d.property} ${d.unit}${d.ended ? " (moved out)" : ""} · ${d.phone}`, String(d.days), n(d.owed)]), { widths: [330, 60, 109] });
    if (r.debtors.length > 60) w.text(`…and ${r.debtors.length - 60} more (see the Excel workbook).`, { size: 8, italic: true });
  }
  if (r.monthly.length > 1) {
    w.heading("Month by month");
    w.table(["Month", "Billed", "Collected", "Expenses"], r.monthly.map((m) => [m.label, n(m.billed), n(m.collected), n(m.expenses)]), { widths: [200, 100, 100, 99] });
  }
  w.gap(8);
  w.text("Collected = payments received in the period (Mobile Money, cash, bank and short-stay bookings), excluding security deposits. Billed = rent and other charges falling due in the period. Commission is on rent, late fees and short stays collected, at each landlord's agreed rate.", { size: 7.5, italic: true });
  return w.bytes();
}

/** The report as an Excel workbook: a summary plus every payment and expense line, ready to filter and total. */
export async function reportXlsx(r: FinancialReport, scopeLabel: string) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CasaVilla"; wb.created = new Date();
  const GREEN = "FF124331", GOLD = "FFD2A84A", MONEY = "#,##0";
  const header = (ws: ExcelJS.Worksheet, cols: { header: string; key: string; width: number; money?: boolean; date?: boolean }[]) => {
    ws.columns = cols.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.money ? { numFmt: MONEY } : c.date ? { numFmt: "dd mmm yyyy" } : {} }));
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } };
    row.height = 20;
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  };
  const totalRow = (ws: ExcelJS.Worksheet, values: Record<string, unknown>) => {
    const row = ws.addRow(values);
    row.font = { bold: true }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4E8C9" } };
  };
  const t = r.totals;

  // Summary
  const s = wb.addWorksheet("Summary", { properties: { tabColor: { argb: GOLD } } });
  s.columns = [{ width: 42 }, { width: 22 }, { width: 14 }];
  s.addRow(["CasaVilla — Financial report"]).font = { bold: true, size: 16, color: { argb: GREEN } };
  s.addRow([`${scopeLabel} · ${r.period.label}`]).font = { size: 11 };
  s.addRow([`Prepared ${day(r.generatedAt)} · arrears as at ${r.asOf} · amounts in UGX`]).font = { italic: true, size: 9, color: { argb: "FF78716C" } };
  s.addRow([]);
  const kv = (k: string, v: number | string | null, money = true) => { const row = s.addRow([k, v ?? "—"]); if (money && typeof v === "number") row.getCell(2).numFmt = MONEY; return row; };
  const section = (title: string) => { s.addRow([]); const row = s.addRow([title]); row.font = { bold: true, color: { argb: "FFFFFFFF" } }; row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN } }; };
  section("Headline");
  kv("Collected (excluding deposits)", t.collected); kv("Billed (due in the period)", t.billed); kv("Collection rate", t.collectionRate == null ? "—" : `${t.collectionRate}%`, false);
  kv("Expenses", t.expenses); kv("CasaVilla commission", t.commission); kv("Net to landlords", t.netToLandlords).font = { bold: true };
  kv("Arrears at period end", t.arrears); kv("Deposits held (active leases)", t.depositsHeld);
  kv("Occupancy", `${t.occupancy ?? "—"}% (${t.occupied} of ${t.units} units)`, false); kv("Landlords / properties", `${t.landlords} / ${t.properties}`, false);
  section("Money in");
  for (const i of r.income) kv(i.label, i.amount);
  if (t.deposits) kv("Deposits received (held for tenants, not income)", t.deposits);
  section("How it was paid");
  for (const m of r.methods) { const row = s.addRow([m.label, m.amount, `${m.count} payments`]); row.getCell(2).numFmt = MONEY; }
  section("Money out");
  for (const e of r.expensesByCategory) kv(e.category, e.amount);
  kv("CasaVilla commission", t.commission);
  section("Arrears by age");
  for (const [k, v] of Object.entries(r.aging)) kv(k, v);

  const L = wb.addWorksheet("By landlord");
  header(L, [{ header: "Landlord", key: "name", width: 30 }, { header: "Commission %", key: "pct", width: 13 }, { header: "Properties", key: "properties", width: 11 }, { header: "Units", key: "units", width: 8 }, { header: "Let", key: "occupied", width: 8 },
    { header: "Collected", key: "collected", width: 16, money: true }, { header: "Expenses", key: "expenses", width: 14, money: true }, { header: "Commission", key: "commission", width: 14, money: true }, { header: "Net to landlord", key: "net", width: 16, money: true }, { header: "Arrears", key: "arrears", width: 14, money: true }]);
  for (const l of r.byLandlord) L.addRow({ ...l, pct: l.commissionPct });
  totalRow(L, { name: "Total", collected: t.collected, expenses: t.expenses, commission: t.commission, net: t.netToLandlords, arrears: t.arrears });

  const P = wb.addWorksheet("By property");
  header(P, [{ header: "Property", key: "name", width: 28 }, { header: "Landlord", key: "landlord", width: 24 }, { header: "Location", key: "location", width: 30 }, { header: "Units", key: "units", width: 8 }, { header: "Let", key: "occupied", width: 8 },
    { header: "Billed", key: "billed", width: 14, money: true }, { header: "Collected", key: "collected", width: 14, money: true }, { header: "Collection %", key: "rate", width: 12 }, { header: "Expenses", key: "expenses", width: 14, money: true }, { header: "Arrears", key: "arrears", width: 14, money: true }]);
  for (const p of r.byProperty) P.addRow(p);

  const A = wb.addWorksheet("Arrears");
  header(A, [{ header: "Tenant", key: "tenant", width: 26 }, { header: "Phone", key: "phone", width: 16 }, { header: "Property", key: "property", width: 24 }, { header: "Unit", key: "unit", width: 12 },
    { header: "Oldest unpaid due", key: "oldest", width: 16 }, { header: "Days late", key: "days", width: 10 }, { header: "Owed", key: "owed", width: 14, money: true }, { header: "Status", key: "status", width: 14 }]);
  for (const d of r.debtors) A.addRow({ ...d, status: d.ended ? "Moved out" : "Current tenant" });
  totalRow(A, { tenant: "Total", owed: t.arrears });

  const Pay = wb.addWorksheet("Payments");
  header(Pay, [{ header: "Date", key: "date", width: 13, date: true }, { header: "Receipt", key: "receipt", width: 18 }, { header: "Paid by", key: "payer", width: 24 }, { header: "Property", key: "property", width: 24 }, { header: "Unit", key: "unit", width: 12 },
    { header: "For", key: "forWhat", width: 22 }, { header: "Method", key: "method", width: 18 }, { header: "Reference", key: "reference", width: 22 }, { header: "Recorded by", key: "recordedBy", width: 24 }, { header: "EFRIS FDN", key: "efris", width: 22 }, { header: "Amount", key: "amount", width: 14, money: true }]);
  for (const p of r.paymentRows) Pay.addRow({ ...p, date: new Date(day(p.date)) });
  totalRow(Pay, { date: null, payer: `${r.paymentRows.length} payments`, amount: r.paymentRows.reduce((x, p) => x + p.amount, 0) });

  const E = wb.addWorksheet("Expenses");
  header(E, [{ header: "Date", key: "date", width: 13, date: true }, { header: "Landlord", key: "landlord", width: 24 }, { header: "Property", key: "property", width: 24 }, { header: "Category", key: "category", width: 24 }, { header: "Description", key: "description", width: 40 }, { header: "From repair job", key: "job", width: 14 }, { header: "Amount", key: "amount", width: 14, money: true }]);
  for (const e of r.expenseRows) E.addRow({ ...e, job: e.fromJob ? "Yes" : "" });
  totalRow(E, { description: `${r.expenseRows.length} expenses`, amount: t.expenses });

  const M = wb.addWorksheet("Month by month");
  header(M, [{ header: "Month", key: "label", width: 12 }, { header: "Billed", key: "billed", width: 16, money: true }, { header: "Collected", key: "collected", width: 16, money: true }, { header: "Expenses", key: "expenses", width: 16, money: true }]);
  for (const m of r.monthly) M.addRow(m);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
