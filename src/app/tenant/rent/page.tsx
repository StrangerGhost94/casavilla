import Link from "next/link";
import { CalendarClock, CheckCircle2, Wallet } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { chargeLabel, payLabel } from "@/lib/rules";
import { PageHeader, Empty } from "@/components/ui";
import { chargesSummary, Ledger } from "@/components/Ledger";
import { activeLease } from "../lib";

export default async function TenantRent() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id, true);
  if (!lease) return <><PageHeader title="Rent & receipts" /><Empty title="No active lease">Rent appears here once a landlord approves your application.</Empty></>;
  const ended = lease.l.status === "ended";
  const year = kampalaToday().slice(0, 4);
  const [{ owed, next }, paidYear, count] = await Promise.all([
    chargesSummary(lease.l.id),
    db.payment.aggregate({ _sum: { amount: true }, where: { leaseId: lease.l.id, status: "success", paidAt: { gte: new Date(`${year}-01-01T00:00:00+03:00`) } } }),
    db.payment.count({ where: { leaseId: lease.l.id, status: "success" } }),
  ]);
  const late = !!next && ymd(next.dueDate) < kampalaToday();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Rent & receipts" subtitle={`${lease.property} · ${lease.unit}${ended ? " (moved out)" : ""}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className={`col-span-2 rounded-2xl p-5 text-white shadow-card sm:col-span-1 sm:row-span-2 ${late ? "bg-maroon-600" : "bg-brand-900"}`}>
          <div className="text-xs text-white/70">{owed > 0 ? "Balance due" : "Balance"}</div>
          <div className="mt-0.5 text-2xl font-bold">{ugx(owed)}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-white/75">
            {next ? <><CalendarClock className="h-3.5 w-3.5" /> {chargeLabel(next.kind, next.period)} · {late ? "was due" : "due"} {fmtDate(next.dueDate)}</> : <><CheckCircle2 className="h-3.5 w-3.5" /> All paid up</>}
          </div>
          {next && <Link href={`/tenant/pay/${next.id}`} className="btn-gold btn-sm mt-4 w-full"><Wallet className="h-4 w-4" /> {payLabel(next.kind)}</Link>}
        </div>
        <div className="card p-4">
          <div className="truncate text-base font-bold text-brand-950 sm:text-lg">{ugx(paidYear._sum.amount ?? 0)}</div>
          <div className="text-xs text-stone-500">Paid in {year}</div>
        </div>
        <div className="card p-4">
          <div className="text-base font-bold text-brand-950 sm:text-lg">{count}</div>
          <div className="text-xs text-stone-500">Receipt{count === 1 ? "" : "s"} kept here</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {lease.l.credit > 0 && !ended && (
          <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">You have <span className="font-bold">{ugx(lease.l.credit)}</span> credit from paying ahead. It&apos;s used automatically on your next charges.</div>
        )}
        {ended && lease.l.settlement != null && lease.l.settlement < 0 && (
          <div className="rounded-2xl bg-maroon-50 p-4 text-sm text-maroon-700">Your lease has ended with <span className="font-bold">{ugx(-lease.l.settlement)}</span> still owed. You can clear it below with Mobile Money.</div>
        )}
        {ended && lease.l.settlement != null && lease.l.settlement > 0 && (
          <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">Your landlord owes you a refund of <span className="font-bold">{ugx(lease.l.settlement)}</span> from your deposit. You&apos;ll be notified when it&apos;s paid.</div>
        )}
      </div>
      <div className="mt-4">
        <Ledger leaseId={lease.l.id} payHref={(id) => `/tenant/pay/${id}`} />
      </div>
    </div>
  );
}
