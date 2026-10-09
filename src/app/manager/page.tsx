import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { AttentionList, Avatar, SectionTitle } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { JobList } from "@/components/Jobs";
import { SmartPanel } from "@/components/Insights";
import { runChecks } from "@/lib/integrity";

export default async function ManagerHome() {
  await requireUser("manager");
  await ensureChargesFor("all");
  const s = await portfolioStats();
  const today = kampalaToday();
  const [pending, pendingApps, unassigned, overdueLeases, recentRaw] = await Promise.all([
    db.user.count({ where: { status: "pending" } }),
    db.application.count({ where: { status: "pending" } }).then(async (n) => n + await db.tenantLink.count({ where: { status: "pending" } })),
    db.job.count({ where: { providerId: null, status: { notIn: ["done", "cancelled"] } } }),
    db.charge.findMany({ where: { status: { not: "paid" }, dueDate: { lt: new Date(`${today}T00:00:00Z`) } }, distinct: ["leaseId"], select: { leaseId: true } }),
    db.payment.findMany({ where: { status: "success" }, orderBy: { paidAt: "desc" }, take: 6, include: { tenant: { select: { name: true } } } }),
  ]);
  const dataIssues = (await runChecks()).filter((c) => c.count > 0).length;
  const vacant = s.units - s.occupied;
  const pct = s.due_month ? Math.min(100, Math.round((s.collected / s.due_month) * 100)) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="h2 mb-3">Portfolio overview</h1>
      <div className="card grid grid-cols-4 divide-x divide-stone-100 p-0 text-center">
        {[["Properties", s.properties, "/manager/properties"], ["Units", s.units, "/manager/properties"], ["Occupied", s.occupied, "/manager/tenants"], ["Vacant", vacant, "/manager/properties"]].map(([l, v, h]) => (
          <Link key={l as string} href={h as string} className="px-1 py-4 hover:bg-stone-50">
            <div className="text-xl font-bold text-brand-950">{v as number}</div>
            <div className="text-[11px] text-stone-500">{l as string}</div>
          </Link>
        ))}
      </div>

      <Link href="/manager/payments" className="mt-3 block overflow-hidden rounded-2xl bg-brand-900 p-5 text-white shadow-card">
        <div className="text-xs text-white/70">Collected this month</div>
        <div className="mt-0.5 text-2xl font-bold">{ugx(s.collected)}</div>
        <div className="mt-3 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-gold-400" style={{ width: `${pct}%` }} /></div>
        <div className="mt-2 flex justify-between text-xs text-white/70"><span>{pct}% of {ugx(s.due_month)} due</span><span>Overdue {ugx(s.arrears)}</span></div>
      </Link>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Attention required" />
          <AttentionList rows={[
            { href: "/manager/tenants", count: overdueLeases.length, label: "Overdue rents", tone: "red" },
            { href: "/manager/jobs", count: unassigned, label: "Repairs with no provider", tone: "gold" },
            { href: "/manager/people?status=pending", count: pending, label: "Landlords & providers to approve", tone: "blue" },
            { href: "/manager/applications", count: pendingApps, label: "Applications & tenants to connect", tone: "blue" },
            { href: "/manager/properties", count: vacant, label: "Vacant units", tone: "green" },
            { href: "/manager/health", count: dataIssues, label: "Data checks needing attention", tone: "gold" },
          ]} />
        </div>
        <div>
          <SectionTitle title="Latest payments" href="/manager/payments" />
          <div className="card divide-y divide-stone-100 p-0">
            {recentRaw.length === 0 && <div className="muted p-4">No payments yet.</div>}
            {recentRaw.map((p) => (
              <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50">
                <Avatar name={p.tenant.name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium text-stone-800">{p.tenant.name}</div><div className="text-xs text-stone-500">{fmtDate(p.paidAt)} · <span className="uppercase">{p.method}</span></div></div>
                <div className="font-semibold text-brand-700">{ugx(p.amount)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SmartPanel base="/manager" />

      <SectionTitle title="Repairs with no provider yet" href="/manager/jobs" />
      <JobList where={{ providerId: null, status: { notIn: ["done", "cancelled"] } }} base="/manager/jobs" empty="Every open job has a provider" />

      <SectionTitle title="Tenants in arrears" href="/manager/tenants" />
      <TenantsTable where={{ status: "active" }} only="overdue" base="/manager/tenants" />
    </div>
  );
}
