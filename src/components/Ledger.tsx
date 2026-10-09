import Link from "next/link";
import { Banknote, Building, ChevronRight, Smartphone } from "lucide-react";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Badge } from "./ui";
import { Submit } from "./client";
import { waiveLeaseCharge } from "@/app/landlord/actions";

const methodLabel: Record<string, string> = { mtn: "MTN MoMo", airtel: "Airtel Money", cash: "Cash", bank: "Bank" };
const MethodIcon = ({ m }: { m: string }) => {
  if (m === "mtn") return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-300 text-[10px] font-extrabold text-black">MTN</span>;
  if (m === "airtel") return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white"><Smartphone className="h-4 w-4" /></span>;
  if (m === "bank") return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Building className="h-4 w-4" /></span>;
  return <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Banknote className="h-4 w-4" /></span>;
};

/** Rent charges and payment history for one lease. */
/** `manage` lets a landlord/manager waive part or all of an open charge. */
export async function Ledger({ leaseId, payHref, recordCash, manage }: { leaseId: number; payHref?: (chargeId: number) => string; recordCash?: React.ReactNode; manage?: boolean }) {
  const [cs, ps] = await Promise.all([
    db.charge.findMany({ where: { leaseId }, orderBy: { dueDate: "desc" } }),
    db.payment.findMany({ where: { leaseId }, orderBy: { createdAt: "desc" } }),
  ]);
  const today = kampalaToday();
  const owed = cs.reduce((s, c) => s + (c.amount - c.paid), 0);
  return (
    <div className="space-y-5">
      <div className="card p-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <div className="h2">Charges</div>
          <div className="text-xs text-stone-500">Balance <span className={`ml-1 text-sm font-bold ${owed > 0 ? "text-maroon-600" : "text-brand-700"}`}>{ugx(owed)}</span></div>
        </div>
        <div className="divide-y divide-stone-100">
          {cs.map((c) => {
            const overdue = c.status !== "paid" && ymd(c.dueDate) < today;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-stone-800">{c.description}</div>
                  <div className="text-xs text-stone-500">Due {fmtDate(c.dueDate)}{c.paid > 0 && c.status !== "paid" && <> · paid {ugx(c.paid)}</>}{c.waived > 0 && <> · {ugx(c.waived)} waived</>}</div>
                  {manage && c.status !== "paid" && (
                    <details className="mt-1">
                      <summary className="cursor-pointer list-none text-[11px] font-semibold text-brand-700">Waive…</summary>
                      <form action={waiveLeaseCharge} className="mt-1.5 flex flex-wrap gap-1.5">
                        <input type="hidden" name="chargeId" value={c.id} />
                        <input name="amount" type="number" min={1} max={c.amount - c.paid} defaultValue={c.amount - c.paid} inputMode="numeric" className="input w-28 py-1.5" aria-label="Amount to waive" />
                        <input name="reason" className="input w-40 flex-1 py-1.5" placeholder="Reason" maxLength={200} />
                        <Submit className="btn-outline btn-sm">Waive</Submit>
                      </form>
                    </details>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-stone-800">{ugx(c.amount)}</div>
                  <Badge>{overdue ? "overdue" : c.status}</Badge>
                </div>
                {payHref && c.status !== "paid" && <Link href={payHref(c.id)} className="btn-primary btn-sm">Pay</Link>}
              </div>
            );
          })}
          {cs.length === 0 && <div className="px-4 py-4 text-sm text-stone-500">No charges yet.</div>}
        </div>
      </div>
      {recordCash}
      <div className="card p-0">
        <div className="h2 px-4 pb-2 pt-4">Payment history</div>
        <div className="divide-y divide-stone-100">
          {ps.map((p) => {
            const href = p.status === "success" ? `/receipts/${p.id}` : p.status === "pending" ? `/pay/${p.reference}` : null;
            const body = (
              <>
                <MethodIcon m={p.method} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-stone-800">{fmtDate(p.paidAt || p.createdAt)}</div>
                  <div className="truncate text-xs text-stone-500">{methodLabel[p.method] ?? p.method}{p.receiptNo && <> · {p.receiptNo}</>}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-stone-800">{ugx(p.amount)}</div>
                  <Badge>{p.status === "success" ? "paid" : p.status}</Badge>
                </div>
                {href && <ChevronRight className="h-4 w-4 text-stone-400" />}
              </>
            );
            return href
              ? <Link key={p.id} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">{body}</Link>
              : <div key={p.id} className="flex items-center gap-3 px-4 py-3">{body}</div>;
          })}
          {ps.length === 0 && <div className="px-4 py-4 text-sm text-stone-500">No payments yet.</div>}
        </div>
      </div>
    </div>
  );
}

export async function chargesSummary(leaseId: number) {
  const open = await db.charge.findMany({ where: { leaseId, status: { not: "paid" } }, orderBy: { dueDate: "asc" } });
  return { owed: open.reduce((s, c) => s + c.amount - c.paid, 0), next: open[0] };
}
