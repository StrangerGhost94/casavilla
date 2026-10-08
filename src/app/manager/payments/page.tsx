import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Badge } from "@/components/ui";

export default async function ManagerPayments({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; status?: string }> }) {
  await requireUser("manager");
  const sp = await searchParams;
  const rows = (await db.payment.findMany({
    where: {
      status: sp.status || undefined,
      createdAt: {
        gte: sp.from ? new Date(`${sp.from}T00:00:00+03:00`) : undefined,
        lte: sp.to ? new Date(`${sp.to}T23:59:59+03:00`) : undefined,
      },
    },
    include: { tenant: { select: { name: true } }, lease: { select: { unit: { select: { label: true, property: { select: { name: true } } } } } } },
    orderBy: { createdAt: "desc" }, take: 500,
  })).map((p) => ({ p, tenant: p.tenant.name, unit: p.lease.unit.label, property: p.lease.unit.property.name }));
  const total = rows.filter((r) => r.p.status === "success").reduce((s, r) => s + r.p.amount, 0);
  const byMethod = rows.filter((r) => r.p.status === "success").reduce<Record<string, number>>((a, r) => ({ ...a, [r.p.method]: (a[r.p.method] || 0) + r.p.amount }), {});
  return (
    <>
      <PageHeader title="Payments" subtitle={`Successful in view: ${ugx(total)} · ${Object.entries(byMethod).map(([m, v]) => `${m.toUpperCase()} ${ugx(v)}`).join(" · ") || "none"}`} />
      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
        <label><span className="label">Status</span>
          <select name="status" defaultValue={sp.status} className="input"><option value="">All</option><option value="success">Success</option><option value="pending">Pending</option><option value="failed">Failed</option></select>
        </label>
        <button className="btn-outline">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table table-stack">
          <thead><tr><th>Date</th><th>Tenant</th><th>Unit</th><th>Method</th><th className="text-right">Amount</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.p.id}>
                <td data-label="" className="whitespace-nowrap">{fmtDate(r.p.paidAt || r.p.createdAt)}</td>
                <td data-label="Tenant">{r.tenant}</td>
                <td data-label="Unit">{r.property} · {r.unit}</td>
                <td data-label="Method" className="uppercase">{r.p.method}</td>
                <td data-label="Amount" className="text-right">{ugx(r.p.amount)}</td>
                <td data-label="Status"><Badge>{r.p.status}</Badge></td>
                <td data-label="Receipt">{r.p.status === "success" ? <Link href={`/receipts/${r.p.id}`} className="link">{r.p.receiptNo}</Link> : <span className="text-xs text-stone-400">{r.p.reference}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
