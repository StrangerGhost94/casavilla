import Link from "next/link";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Badge } from "./ui";

/** Rent charges and payment history for one lease. */
export async function Ledger({ leaseId, payHref, recordCash }: { leaseId: number; payHref?: (chargeId: number) => string; recordCash?: React.ReactNode }) {
  const [cs, ps] = await Promise.all([
    db.charge.findMany({ where: { leaseId }, orderBy: { dueDate: "desc" } }),
    db.payment.findMany({ where: { leaseId }, orderBy: { createdAt: "desc" } }),
  ]);
  const today = kampalaToday();
  const owed = cs.reduce((s, c) => s + (c.amount - c.paid), 0);
  return (
    <div className="space-y-6">
      <div className="card overflow-x-auto p-0">
        <div className="flex items-center justify-between p-5 pb-3">
          <div className="h2">Rent charges</div>
          <div className="text-sm">Balance: <span className={`font-bold ${owed > 0 ? "text-maroon-600" : "text-brand-600"}`}>{ugx(owed)}</span></div>
        </div>
        <table className="table">
          <thead><tr><th>For</th><th>Due</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {cs.map((c) => {
              const overdue = c.status !== "paid" && ymd(c.dueDate) < today;
              return (
                <tr key={c.id}>
                  <td>{c.description}</td>
                  <td className="whitespace-nowrap">{fmtDate(c.dueDate)}</td>
                  <td className="text-right">{ugx(c.amount)}</td>
                  <td className="text-right">{ugx(c.paid)}</td>
                  <td><Badge>{overdue ? "overdue" : c.status}</Badge></td>
                  <td className="text-right">{c.status !== "paid" && payHref && <Link href={payHref(c.id)} className="btn-primary btn-sm">Pay</Link>}</td>
                </tr>
              );
            })}
            {cs.length === 0 && <tr><td colSpan={6} className="text-stone-500">No charges yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {recordCash}
      <div className="card overflow-x-auto p-0">
        <div className="h2 p-5 pb-3">Payments</div>
        <table className="table">
          <thead><tr><th>Date</th><th>Method</th><th className="text-right">Amount</th><th>Status</th><th>Receipt</th></tr></thead>
          <tbody>
            {ps.map((p) => (
              <tr key={p.id}>
                <td className="whitespace-nowrap">{fmtDate(p.paidAt || p.createdAt)}</td>
                <td className="uppercase">{p.method}{p.phone && <span className="ml-1 normal-case text-stone-500">{p.phone}</span>}</td>
                <td className="text-right">{ugx(p.amount)}</td>
                <td><Badge>{p.status}</Badge></td>
                <td>{p.status === "success" ? <Link href={`/receipts/${p.id}`} className="link">{p.receiptNo}</Link> : p.status === "pending" ? <Link href={`/pay/${p.reference}`} className="link">Check</Link> : "—"}</td>
              </tr>
            ))}
            {ps.length === 0 && <tr><td colSpan={5} className="text-stone-500">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export async function chargesSummary(leaseId: number) {
  const open = await db.charge.findMany({ where: { leaseId, status: { not: "paid" } }, orderBy: { dueDate: "asc" } });
  return { owed: open.reduce((s, c) => s + c.amount - c.paid, 0), next: open[0] };
}
