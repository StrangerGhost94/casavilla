import Link from "next/link";
import { AlertTriangle, BarChart3, Building2, Plus, Wallet } from "lucide-react";
import { CollectedCard, DashHeader, MiniStat, TodoList } from "@/components/Dashboard";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, ugx } from "@/lib/format";
import { Avatar, SectionTitle } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { JobList } from "@/components/Jobs";
import { SmartPanel } from "@/components/Insights";
import { AreaReport } from "@/components/AreaReport";
import { runChecks } from "@/lib/integrity";
import { chargeLabel } from "@/lib/rules";
import { missingCount } from "@/lib/efris";

export default async function ManagerHome() {
  await requireUser("manager");
  await ensureChargesFor("all");
  const s = await portfolioStats();
  const [pending, pendingApps, unassigned, recentRaw, efrisMissing, newBuild] = await Promise.all([
    db.user.count({ where: { status: "pending" } }),
    db.application.count({ where: { status: "pending" } }).then(async (n) => n + await db.tenantLink.count({ where: { status: "pending" } })),
    db.job.count({ where: { providerId: null, status: { notIn: ["done", "cancelled"] } } }),
    db.payment.findMany({ where: { status: "success" }, orderBy: { paidAt: "desc" }, take: 6, include: { tenant: { select: { name: true } }, charge: { select: { kind: true, period: true } } } }),
    missingCount(),
    db.buildRequest.count({ where: { status: "new" } }),
  ]);
  const dataIssues = (await runChecks()).filter((c) => c.count > 0).length;
  const vacant = s.units - s.occupied;
  const occupancy = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <DashHeader title="Portfolio overview">
        <Link href="/manager/properties/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add property</Link>
        <Link href="/manager/payments" className="btn-outline btn-sm"><Wallet className="h-4 w-4" /> Payments</Link>
        <Link href="/manager/reports" className="btn-outline btn-sm"><BarChart3 className="h-4 w-4" /> Reports</Link>
      </DashHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CollectedCard href="/manager/payments" collected={s.collected} due={s.due_month} left={s.left_month} />
        <MiniStat href="/manager/tenants" tone="red" icon={<AlertTriangle className="h-[18px] w-[18px]" />} value={ugx(s.arrears)} label={`Overdue · ${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"}`} />
        <MiniStat href="/manager/properties" icon={<Building2 className="h-[18px] w-[18px]" />} value={`${occupancy}% let`} label={`${s.occupied} of ${s.units} units · ${vacant} vacant`} hint={`${s.properties} propert${s.properties === 1 ? "y" : "ies"}`} />
      </div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <TodoList rows={[
          { href: "/manager/tenants", count: s.lateTenants, label: "Tenants behind on rent", tone: "red" },
          { href: "/manager/people?status=pending", count: pending, label: "Landlords & providers to approve", tone: "blue" },
          { href: "/manager/applications", count: pendingApps, label: "Applications & tenants to connect", tone: "blue" },
          { href: "/manager/build", count: newBuild, label: "New build requests to call back", tone: "blue" },
          { href: "/manager/jobs", count: unassigned, label: "Repairs with no provider", tone: "gold" },
          { href: "/manager/efris", count: efrisMissing, label: "Payments waiting for an EFRIS receipt", tone: "gold" },
          { href: "/manager/tenants#former", count: s.pastTenants, label: s.pastArrears ? `Former tenants who still owe (${ugx(s.pastArrears)})` : "Former tenants who still owe", tone: "gold" },
          { href: "/manager/health", count: dataIssues, label: "Data checks needing attention", tone: "gold" },
        ]} />
        <div>
          <SectionTitle title="Latest payments" href="/manager/payments" />
          <div className="card divide-y divide-stone-100 p-0">
            {recentRaw.length === 0 && <div className="muted p-4">No payments yet.</div>}
            {recentRaw.map((p) => (
              <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50">
                <Avatar name={p.tenant.name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium text-stone-800">{p.tenant.name}</div><div className="truncate text-xs text-stone-500">{chargeLabel(p.charge.kind, p.charge.period)} · {fmtDate(p.paidAt)} · <span className="uppercase">{p.method}</span></div></div>
                <div className="font-semibold text-brand-700">{ugx(p.amount)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <SmartPanel base="/manager" />

      <SectionTitle title="By district" href="/manager/areas" cta="All areas" />
      <AreaReport by="district" base="/manager/areas" limit={6} />

      <SectionTitle title="Repairs with no provider yet" href="/manager/jobs" />
      <JobList where={{ providerId: null, status: { notIn: ["done", "cancelled"] } }} base="/manager/jobs" empty="Every open job has a provider" />

      <SectionTitle title="Tenants in arrears" href="/manager/tenants" />
      <TenantsTable where={{ status: "active" }} only="overdue" base="/manager/tenants" />
    </div>
  );
}
