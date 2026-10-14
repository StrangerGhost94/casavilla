import Link from "next/link";
import { FileSpreadsheet } from "lucide-react";
import { db, type User } from "@/db";
import { financialReport, periodFrom, scopeName, PRESETS } from "@/lib/reports";
import { FileButton } from "./FileButton";
import { PageHeader } from "./ui";

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const short = (x: number) => (Math.abs(x) >= 1e9 ? `${(x / 1e9).toFixed(2)}B` : Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(1)}M` : Math.abs(x) >= 1e3 ? `${Math.round(x / 1e3)}K` : String(Math.round(x)));

/**
 * Portfolio-wide financial report: pick a period and (optionally) a landlord or property, read the headline
 * numbers and breakdowns, and download the PDF or the Excel workbook with every line.
 */
export async function FinanceReport({ viewer, q }: { viewer: User; q: Record<string, string | undefined> }) {
  const manager = viewer.role === "manager";
  const period = periodFrom(q);
  const landlordId = manager ? Number(q.landlord) || undefined : viewer.id;
  const propertyId = Number(q.property) || undefined;
  const [r, landlords, properties, scope] = await Promise.all([
    financialReport(period, { landlordId, propertyId }),
    manager ? db.user.findMany({ where: { role: "landlord" }, orderBy: { name: "asc" }, select: { id: true, name: true, businessName: true } }) : [],
    db.property.findMany({ where: landlordId ? { landlordId } : {}, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    scopeName(landlordId, propertyId),
  ]);
  const t = r.totals;
  const qs = new URLSearchParams(Object.entries({ period: period.preset, from: q.from, to: q.to, landlord: manager ? q.landlord : undefined, property: q.property }).filter(([, v]) => v) as [string, string][]).toString();
  const max = Math.max(1, ...r.monthly.map((m) => Math.max(m.billed, m.collected)));
  const base = `/${viewer.role}/reports`;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Financial reports" subtitle={`${scope} · ${period.label}`} />

      <form action={base} className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select name="period" defaultValue={period.preset} className="input col-span-2 sm:col-span-1">{PRESETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input type="date" name="from" defaultValue={q.from} className="input" aria-label="From (custom)" />
        <input type="date" name="to" defaultValue={q.to} className="input" aria-label="To (custom)" />
        {manager ? (
          <select name="landlord" defaultValue={q.landlord ?? ""} className="input col-span-2 sm:col-span-1">
            <option value="">All landlords</option>
            {landlords.map((l) => <option key={l.id} value={l.id}>{l.businessName || l.name}</option>)}
          </select>
        ) : <span className="hidden sm:block" />}
        <select name="property" defaultValue={q.property ?? ""} className="input col-span-2 sm:col-span-3">
          <option value="">All properties{landlordId ? " of this landlord" : ""}</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-primary col-span-2 sm:col-span-1">Show report</button>
        <p className="col-span-2 text-[11px] text-stone-500 sm:col-span-4">The dates are only used with “Custom dates”. Changing the landlord resets the property list after you tap Show report.</p>
      </form>

      <div className="mb-5 flex flex-wrap gap-2">
        <FileButton href={`/reports/finance/pdf?${qs}`} name="CasaVilla-report.pdf">Download PDF report</FileButton>
        <FileButton href={`/reports/finance/xlsx?${qs}`} name="CasaVilla-report.xlsx" className="btn-outline btn-sm"><FileSpreadsheet className="h-4 w-4" /> Excel (all payments & expenses)</FileButton>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Collected" value={`UGX ${n(t.collected)}`} hint={`${t.payments} payments${t.bookings ? ` · ${t.bookings} stays` : ""}`} strong />
        <Kpi label="Billed" value={`UGX ${n(t.billed)}`} hint={t.collectionRate != null ? `${t.collectionRate}% collected` : "Nothing due"} />
        <Kpi label="Net to landlords" value={`UGX ${n(t.netToLandlords)}`} hint={`after UGX ${short(t.expenses + t.commission)} out`} />
        <Kpi label="Arrears" value={`UGX ${n(t.arrears)}`} hint={`as at ${r.asOf}`} warn={t.arrears > 0} />
        <Kpi label="CasaVilla commission" value={`UGX ${n(t.commission)}`} />
        <Kpi label="Expenses" value={`UGX ${n(t.expenses)}`} />
        <Kpi label="Deposits held" value={`UGX ${n(t.depositsHeld)}`} hint="active tenancies" />
        <Kpi label="Occupancy" value={t.occupancy != null ? `${t.occupancy}%` : "—"} hint={`${t.occupied} of ${t.units} units · ${t.properties} properties`} />
      </div>

      {r.monthly.length > 1 && (
        <div className="card mt-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold text-brand-950">Month by month</div>
            <div className="flex gap-3 text-[11px] text-stone-500"><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-stone-300" /> Billed</span><span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-700" /> Collected</span></div>
          </div>
          <div className="flex h-40 items-end gap-1 sm:gap-2">
            {r.monthly.map((m) => (
              <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5" title={`${m.label}: billed ${n(m.billed)}, collected ${n(m.collected)}`}>
                  <div className="w-1/2 max-w-4 rounded-t bg-stone-300" style={{ height: `${(m.billed / max) * 100}%` }} />
                  <div className="w-1/2 max-w-4 rounded-t bg-brand-700" style={{ height: `${(m.collected / max) * 100}%` }} />
                </div>
                <div className="w-full truncate text-center text-[9px] text-stone-500 sm:text-[10px]">{r.monthly.length > 8 ? m.label.slice(0, 3) : m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Box title="Money in">
          {r.income.length ? r.income.map((i) => <Line key={i.kind} k={i.label} v={n(i.amount)} />) : <Muted>Nothing received.</Muted>}
          {t.deposits > 0 && <Line k="Deposits received (held)" v={n(t.deposits)} muted />}
          <Line k="Total collected" v={n(t.collected)} bold />
        </Box>
        <Box title="How it was paid">
          {r.methods.length ? r.methods.map((m) => <Line key={m.method} k={`${m.label} (${m.count})`} v={n(m.amount)} />) : <Muted>No payments.</Muted>}
        </Box>
        <Box title="Money out">
          {r.expensesByCategory.map((e) => <Line key={e.category} k={e.category} v={n(e.amount)} />)}
          {t.commission > 0 && <Line k="CasaVilla commission" v={n(t.commission)} />}
          {!r.expensesByCategory.length && !t.commission && <Muted>No expenses recorded.</Muted>}
          <Line k="Net to landlords" v={n(t.netToLandlords)} bold />
        </Box>
      </div>

      {manager && !landlordId && r.byLandlord.length > 0 && (
        <Table title="By landlord" head={["Landlord", "Let", "Collected", "Expenses", "Commission", "Net", "Arrears"]}
          rows={r.byLandlord.map((l) => [
            <Link key="n" href={`${base}?${new URLSearchParams({ period: period.preset, ...(q.from ? { from: q.from } : {}), ...(q.to ? { to: q.to } : {}), landlord: String(l.id) })}`} className="link">{l.name}</Link>,
            `${l.occupied}/${l.units}`, n(l.collected), n(l.expenses), `${n(l.commission)}${l.commissionPct ? ` (${l.commissionPct}%)` : ""}`, n(l.net), n(l.arrears),
          ])} />
      )}
      <Table title="By property" head={["Property", "Let", "Billed", "Collected", "Rate", "Expenses", "Arrears"]}
        rows={r.byProperty.map((p) => [<span key="n"><span className="font-medium">{p.name}</span>{!landlordId && <span className="block text-[11px] text-stone-500">{p.landlord}</span>}</span>, `${p.occupied}/${p.units}`, n(p.billed), n(p.collected), p.rate != null ? `${p.rate}%` : "—", n(p.expenses), n(p.arrears)])} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <Box title="Arrears by age">
          {Object.entries(r.aging).map(([k, v]) => <Line key={k} k={k} v={n(v)} />)}
          <Line k="Total" v={n(t.arrears)} bold />
        </Box>
        <Box title={`Who owes (${r.debtors.length})`}>
          {r.debtors.length ? r.debtors.slice(0, 15).map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-3 border-b border-stone-100 py-1.5 text-sm last:border-0">
              <span className="min-w-0"><span className="block truncate font-medium text-stone-800">{d.tenant}{d.ended ? " (moved out)" : ""}</span><span className="block truncate text-[11px] text-stone-500">{d.property} · {d.unit} · {d.days} days · <a href={`tel:${d.phone}`} className="hover:underline">{d.phone}</a></span></span>
              <span className="shrink-0 font-semibold text-maroon-600">{n(d.owed)}</span>
            </div>
          )) : <Muted>Nobody is behind. 🎉</Muted>}
          {r.debtors.length > 15 && <p className="pt-2 text-[11px] text-stone-500">…and {r.debtors.length - 15} more in the downloads.</p>}
        </Box>
      </div>
      <p className="mt-4 text-[11px] text-stone-500">Collected = payments received in the period (Mobile Money, cash, bank, short-stay bookings), excluding security deposits. Billed = rent and charges falling due in the period. Commission = each landlord&apos;s rate on rent, late fees and short stays collected. Amounts in UGX.</p>
    </div>
  );
}

function Kpi({ label, value, hint, strong, warn }: { label: string; value: string; hint?: string; strong?: boolean; warn?: boolean }) {
  return (
    <div className={`card p-4 ${strong ? "border-brand-200 bg-brand-50/60" : ""}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${warn ? "text-maroon-600" : "text-brand-950"}`}>{value}</div>
      {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
    </div>
  );
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card"><div className="mb-2 font-semibold text-brand-950">{title}</div>{children}</div>;
}
function Line({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return <div className={`flex justify-between gap-3 py-1 text-sm ${bold ? "mt-1 border-t border-stone-100 pt-2 font-bold text-brand-950" : muted ? "text-stone-500" : "text-stone-700"}`}><span className="min-w-0">{k}</span><span className="shrink-0 tabular-nums">{v}</span></div>;
}
const Muted = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-stone-500">{children}</p>;
function Table({ title, head, rows }: { title: string; head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="card mt-4 p-0">
      <div className="px-4 pb-2 pt-4 font-semibold text-brand-950">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="border-y border-stone-100 bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">{head.map((h, i) => <th key={h} className={`px-4 py-2 font-semibold ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-stone-100">
            {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-2 ${j ? "text-right tabular-nums" : ""}`}>{c}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={head.length} className="px-4 py-4 text-center text-stone-500">Nothing in this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
