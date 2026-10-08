import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Stat, Badge } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { JobList } from "@/components/Jobs";

export default async function ManagerHome() {
  await requireUser("manager");
  await ensureChargesFor("all");
  const s = await portfolioStats();
  const [tenants, landlords, providers, pending, pendingApps, recentRaw] = await Promise.all([
    db.user.count({ where: { role: "tenant" } }),
    db.user.count({ where: { role: "landlord" } }),
    db.user.count({ where: { role: "provider" } }),
    db.user.count({ where: { status: "pending" } }),
    db.application.count({ where: { status: "pending" } }),
    db.payment.findMany({ where: { status: "success" }, orderBy: { paidAt: "desc" }, take: 6, include: { tenant: { select: { name: true } } } }),
  ]);
  const counts = { tenants, landlords, providers, pending };
  const recent = recentRaw.map((p) => ({ p, tenant: p.tenant.name }));
  const occ = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <>
      <PageHeader title="CasaVilla dashboard" subtitle="Everything across all landlords, tenants and providers." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Collected this month" value={ugx(s.collected)} hint={`of ${ugx(s.due_month)} due this month`} href="/manager/payments" />
        <Stat label="Overdue rent" value={<span className={s.arrears ? "text-maroon-600" : ""}>{ugx(s.arrears)}</span>} href="/manager/tenants" />
        <Stat label="Occupancy" value={`${occ}%`} hint={`${s.occupied}/${s.units} units · ${s.properties} properties`} href="/manager/properties" />
        <Stat label="Awaiting approval" value={counts.pending} hint={`${counts.landlords} landlords · ${counts.providers} providers · ${counts.tenants} tenants`} href="/manager/people?status=pending" />
      </div>
      {pendingApps > 0 && <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{pendingApps} tenant application(s) waiting for landlords. <Link href="/manager/applications" className="link">Review →</Link></div>}

      <h2 className="h2 mb-3 mt-8">Repairs with no provider yet</h2>
      <JobList where={{ providerId: null, status: { notIn: ["done", "cancelled"] } }} base="/manager/jobs" empty="Every open job has a provider" />

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="h2 mb-3">Tenants in arrears</h2>
          <TenantsTable where={{ status: "active" }} only="overdue" base="/manager/tenants" />
        </div>
        <div>
          <h2 className="h2 mb-3">Latest payments</h2>
          <div className="card divide-y divide-stone-100 p-0">
            {recent.length === 0 && <div className="muted p-4">No payments yet.</div>}
            {recent.map((r) => (
              <Link key={r.p.id} href={`/receipts/${r.p.id}`} className="flex items-center justify-between p-3 text-sm hover:bg-stone-50">
                <div><div className="font-medium">{r.tenant}</div><div className="text-xs text-stone-500">{fmtDate(r.p.paidAt)} · <span className="uppercase">{r.p.method}</span></div></div>
                <div className="font-semibold text-brand-600">{ugx(r.p.amount)}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
