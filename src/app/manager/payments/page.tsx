import Link from "next/link";
import { ChevronRight, SlidersHorizontal } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { Avatar, Badge, Empty, PageHeader } from "@/components/ui";
import { LocationPicker } from "@/components/LocationPicker";
import { crumbText, insideFilter, trailFor } from "@/lib/geo";

type SP = { from?: string; to?: string; status?: string; in?: string };

const methodName: Record<string, string> = { mtn: "MTN MoMo", airtel: "Airtel Money", cash: "Cash", bank: "Bank" };
const methodTone: Record<string, string> = { mtn: "bg-gold-400", airtel: "bg-maroon-500", cash: "bg-brand-600", bank: "bg-sky-500" };

/** Quick date ranges, as [label, from, to] in Kampala days. */
function periods(): [string, string, string][] {
  const today = kampalaToday();
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${y}-${pad(m)}-01`;
  const prev = m === 1 ? [y - 1, 12] : [y, m - 1];
  const prevStart = `${prev[0]}-${pad(prev[1])}-01`;
  const prevEnd = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const d30 = new Date(Date.parse(`${today}T00:00:00Z`) - 29 * 86_400_000).toISOString().slice(0, 10);
  return [["This month", monthStart, today], ["Last month", prevStart, prevEnd], ["Last 30 days", d30, today], ["All time", "", ""]];
}

export default async function ManagerPayments({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser("manager");
  const sp = await searchParams;
  const area = await trailFor(sp.in);
  const inside = area.length > 1 ? await insideFilter(sp.in) : null;
  const rows = await db.payment.findMany({
    where: {
      status: sp.status || undefined,
      ...(inside ? { lease: { unit: { property: { place: inside } } } } : {}),
      createdAt: {
        gte: sp.from ? new Date(`${sp.from}T00:00:00+03:00`) : undefined,
        lte: sp.to ? new Date(`${sp.to}T23:59:59+03:00`) : undefined,
      },
    },
    include: { tenant: { select: { name: true } }, lease: { select: { unit: { select: { label: true, property: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" }, take: 500,
  });
  const ok = rows.filter((p) => p.status === "success");
  const total = ok.reduce((s, p) => s + p.amount, 0);
  const byMethod = Object.entries(ok.reduce<Record<string, number>>((a, p) => ({ ...a, [p.method]: (a[p.method] || 0) + p.amount }), {})).sort((a, b) => b[1] - a[1]);
  const pending = rows.filter((p) => p.status === "pending").length;
  const failed = rows.filter((p) => p.status === "failed").length;

  const qs = (over: Partial<SP>) => {
    const q = new URLSearchParams(Object.entries({ ...sp, ...over }).filter(([, v]) => v) as [string, string][]);
    return `/manager/payments${q.size ? `?${q}` : ""}`;
  };
  const filtered = !!(sp.from || sp.to || sp.status || area.length > 1);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Payments" subtitle="Every payment tenants have made, newest first." actions={<Link href="/manager/reports" className="btn-outline btn-sm">Financial reports</Link>} />

      {/* Quick ranges */}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 text-xs font-semibold [scrollbar-width:none] lg:mx-0 lg:px-0">
        {periods().map(([label, from, to]) => {
          const on = (sp.from ?? "") === from && (sp.to ?? "") === to;
          return (
            <Link key={label} href={qs({ from, to })} className={`shrink-0 rounded-full border px-3 py-1.5 ${on ? "border-brand-700 bg-brand-700 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-brand-300"}`}>{label}</Link>
          );
        })}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-brand-900 p-5 text-white shadow-card sm:col-span-2">
          <div className="text-xs text-white/70">Collected{sp.from || sp.to ? ` ${sp.from ? fmtDate(new Date(`${sp.from}T12:00:00Z`)) : "…"} – ${sp.to ? fmtDate(new Date(`${sp.to}T12:00:00Z`)) : "today"}` : ", all time"}</div>
          <div className="mt-1 text-2xl font-bold sm:text-3xl">{ugx(total)}</div>
          <div className="mt-1 text-xs text-white/60">{ok.length} successful payment{ok.length === 1 ? "" : "s"}</div>
          {total > 0 && (
            <>
              <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/15">
                {byMethod.map(([m, v]) => <div key={m} className={methodTone[m] ?? "bg-white/60"} style={{ width: `${(v / total) * 100}%` }} />)}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
                {byMethod.map(([m, v]) => <span key={m} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${methodTone[m] ?? "bg-white/60"}`} />{methodName[m] ?? m.toUpperCase()} {ugx(v)}</span>)}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <Link href={qs({ status: "pending" })} className="card p-4 transition hover:-translate-y-0.5">
            <div className="text-xl font-bold text-brand-950">{pending}</div>
            <div className="text-xs font-medium text-stone-500">Pending</div>
          </Link>
          <Link href={qs({ status: "failed" })} className="card p-4 transition hover:-translate-y-0.5">
            <div className={`text-xl font-bold ${failed ? "text-maroon-600" : "text-brand-950"}`}>{failed}</div>
            <div className="text-xs font-medium text-stone-500">Failed</div>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <details className="card group mt-4 p-0" open={filtered}>
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-900">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="flex-1">Filter{filtered && <span className="font-normal text-stone-500"> · {[sp.status, area.length > 1 ? crumbText(area, true) : null, sp.from || sp.to ? "dates" : null].filter(Boolean).join(" · ")}</span>}</span>
          {filtered && <Link href="/manager/payments" className="text-xs font-semibold text-maroon-600 hover:underline">Clear</Link>}
        </summary>
        <form className="grid grid-cols-2 gap-3 border-t border-stone-100 p-4 sm:grid-cols-4">
          <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
          <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
          <label><span className="label">Status</span>
            <select name="status" defaultValue={sp.status} className="input"><option value="">All</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
          </label>
          <div className="flex items-end"><button className="btn-primary w-full">Apply</button></div>
          <div className="col-span-2 sm:col-span-4">
            <span className="label">Area</span>
            <LocationPicker name="in" initial={area} label="" compact />
          </div>
        </form>
      </details>

      <h2 className="h2 mb-2 mt-6">{rows.length} payment{rows.length === 1 ? "" : "s"}{rows.length === 500 ? " (latest 500)" : ""}</h2>
      {!rows.length ? <Empty title="No payments here">{filtered ? "Try a wider date range or clear the filters." : "Payments appear as soon as tenants pay."}</Empty> : (
        <>
          {/* Phones: compact rows */}
          <div className="card divide-y divide-stone-100 p-0 lg:hidden">
            {rows.map((p) => {
              const inner = (
                <>
                  <Avatar name={p.tenant.name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-stone-800">{p.tenant.name}</div>
                    <div className="truncate text-xs text-stone-500">{p.lease.unit.property.name} · {p.lease.unit.label}</div>
                    <div className="truncate text-[11px] text-stone-400">{fmtDate(p.paidAt || p.createdAt)} · {methodName[p.method] ?? p.method.toUpperCase()}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`text-sm font-semibold ${p.status === "success" ? "text-brand-700" : "text-stone-500"}`}>{ugx(p.amount)}</div>
                    {p.status !== "success" && <Badge>{p.status}</Badge>}
                  </div>
                  {p.status === "success" && <ChevronRight className="h-4 w-4 shrink-0 text-stone-300" />}
                </>
              );
              return p.status === "success"
                ? <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">{inner}</Link>
                : <div key={p.id} className="flex items-center gap-3 px-4 py-3">{inner}</div>;
            })}
          </div>
          {/* Desktop: table */}
          <div className="card hidden overflow-x-auto p-0 lg:block">
            <table className="table">
              <thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Method</th><th className="text-right">Amount</th><th>Status</th><th>Receipt</th></tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{fmtDate(p.paidAt || p.createdAt)}</td>
                    <td><span className="flex items-center gap-2"><Avatar name={p.tenant.name} className="h-7 w-7 text-[10px]" />{p.tenant.name}</span></td>
                    <td>{p.lease.unit.property.name} · {p.lease.unit.label}</td>
                    <td><span className="flex items-center gap-1.5 whitespace-nowrap"><span className={`h-2 w-2 rounded-full ${methodTone[p.method] ?? "bg-stone-300"}`} />{methodName[p.method] ?? p.method.toUpperCase()}</span></td>
                    <td className="whitespace-nowrap text-right font-semibold">{ugx(p.amount)}</td>
                    <td><Badge>{p.status}</Badge></td>
                    <td>{p.status === "success" ? <Link href={`/receipts/${p.id}`} className="link whitespace-nowrap">{p.receiptNo}</Link> : <span className="text-xs text-stone-400">{p.reference}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
