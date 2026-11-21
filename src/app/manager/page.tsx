import Link from "next/link";
import { AlertTriangle, Building2, Plus, Wallet } from "lucide-react";
import { CollectedCard, DashHeader, Fold, MiniStat, TodoList } from "@/components/Dashboard";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { accessReviewThisMonth, unclosedCashDays } from "@/lib/controls";
import { AGENT_WAITING } from "@/lib/queries";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, ugx } from "@/lib/format";
import { Avatar } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { JobList } from "@/components/Jobs";
import { SmartPanel } from "@/components/Insights";
import { AreaReport } from "@/components/AreaReport";
import { runChecks } from "@/lib/integrity";
import { chargeLabel } from "@/lib/rules";
import { missingCount } from "@/lib/efris";

export default async function ManagerHome() {
  const me = await requireUser("manager");
  await ensureChargesFor("all");
  const s = await portfolioStats();
  const [pending, pendingApps, unassigned, recentRaw, efrisMissing, newBuild, saleReview, viewingAsks, toVerify] = await Promise.all([
    db.user.count({ where: { status: "pending" } }),
    db.application.count({ where: { status: "pending" } }).then(async (n) => n + await db.tenantLink.count({ where: { status: "pending" } })),
    db.job.count({ where: { providerId: null, status: { notIn: ["done", "cancelled"] } } }),
    db.payment.findMany({ where: { status: "success" }, orderBy: { paidAt: "desc" }, take: 6, include: { tenant: { select: { name: true } }, charge: { select: { kind: true, period: true } } } }),
    missingCount(),
    db.buildRequest.count({ where: { status: "new" } }),
    db.saleListing.count({ where: { status: "pending" } }),
    db.viewing.count({ where: { status: "requested" } }),
    // Listed homes nobody from CasaVilla has visited yet (the "Verified" badge sells them).
    db.property.count({ where: { archivedAt: null, verifiedAt: null, OR: [{ units: { some: { listed: true, status: "vacant" } } }, AGENT_WAITING] } }),
  ]);
  const dataIssues = (await runChecks()).filter((c) => c.count > 0).length;
  const reported = await db.saleListing.count({ where: { reports: { some: { status: "new" } } } });
  // Super admins' own duties: decisions others are waiting on, cash to sign off, the monthly access review.
  const [toApprove, cashToClose, reviewDone] = me.superAdmin
    ? await Promise.all([db.approvalRequest.count({ where: { status: "pending", requestedById: { not: me.id } } }), unclosedCashDays(), accessReviewThisMonth()])
    : [0, 0, true];
  const vacant = s.units - s.occupied;
  const occupancy = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <DashHeader title="Portfolio overview">
        {/* One main action, named by what it achieves: the overdue money first, otherwise growing the portfolio. */}
        {s.arrears > 0
          ? <Link href="/manager/tenants?show=overdue" className="btn-primary btn-sm"><Wallet className="h-4 w-4" /> Chase {ugx(s.arrears)} overdue</Link>
          : <Link href="/manager/properties/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add a property</Link>}
        {s.arrears > 0 && <Link href="/manager/properties/new" className="btn-outline btn-sm"><Plus className="h-4 w-4" /> Add a property</Link>}
      </DashHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CollectedCard href="/manager/payments" collected={s.collected} due={s.due_month} left={s.left_month} />
        <MiniStat href="/manager/tenants" tone="red" icon={<AlertTriangle className="h-[18px] w-[18px]" />} value={ugx(s.arrears)} label={`Overdue · ${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"}`} />
        <MiniStat href="/manager/properties" icon={<Building2 className="h-[18px] w-[18px]" />} value={`${occupancy}% let`} label={`${s.occupied} of ${s.units} units · ${vacant} vacant`} hint={`${s.properties} propert${s.properties === 1 ? "y" : "ies"}`} />
      </div>

        <TodoList rows={[
          { href: "/manager/approvals", count: toApprove, label: "Requests waiting for your approval", tone: "red" },
          { href: "/manager/cash", count: cashToClose, label: "Days of cash to count & close", tone: "red" },
          { href: "/manager/access-review", count: reviewDone ? 0 : 1, label: "Monthly access review due", tone: "gold" },
          { href: "/manager/tenants", count: s.lateTenants, label: "Tenants behind on rent", tone: "red" },
          { href: "/manager/people?status=pending", count: pending, label: "Landlords & providers to approve", tone: "blue" },
          { href: "/manager/applications", count: pendingApps, label: "Applications & tenants to connect", tone: "blue" },
          { href: "/manager/build", count: newBuild, label: "New build requests to call back", tone: "blue" },
          { href: "/manager/sale?tab=review", count: saleReview, label: "Listings for sale to review", tone: "blue" },
          { href: "/manager/sale?tab=reported", count: reported, label: "Listings reported by the public", tone: "red" },
          { href: "/viewings", count: viewingAsks, label: "Viewing requests to confirm", tone: "blue" },
          { href: "/manager/properties?show=verify", count: toVerify, label: "Listed properties to visit & verify", tone: "gold" },
          { href: "/manager/jobs", count: unassigned, label: "Repairs with no provider", tone: "gold" },
          { href: "/manager/efris", count: efrisMissing, label: "Payments waiting for an EFRIS receipt", tone: "gold" },
          { href: "/manager/tenants#former", count: s.pastTenants, label: s.pastArrears ? `Former tenants who still owe (${ugx(s.pastArrears)})` : "Former tenants who still owe", tone: "gold" },
          { href: "/manager/health", count: dataIssues, label: "Data checks needing attention", tone: "gold" },
        ]} />
      <Fold title="Tenants behind on rent" hint={s.lateTenants ? `${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"} · ${ugx(s.arrears)}` : "Nobody is behind"} href="/manager/tenants?show=overdue">
        <TenantsTable where={{ status: "active" }} only="overdue" base="/manager/tenants" />
      </Fold>
      <Fold title="Latest payments" hint={recentRaw.length ? `${recentRaw[0].tenant.name} · ${ugx(recentRaw[0].amount)} · ${fmtDate(recentRaw[0].paidAt)}` : "None yet"} href="/manager/payments">
        <div className="divide-y divide-stone-100">
          {recentRaw.length === 0 && <div className="muted p-2">No payments yet.</div>}
          {recentRaw.map((p) => (
            <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center gap-3 px-1 py-2.5 text-sm hover:bg-stone-50">
              <Avatar name={p.tenant.name} className="h-9 w-9 text-xs" />
              <div className="min-w-0 flex-1"><div className="truncate font-medium text-stone-800">{p.tenant.name}</div><div className="truncate text-xs text-stone-500">{chargeLabel(p.charge.kind, p.charge.period)} · {fmtDate(p.paidAt)} · <span className="uppercase">{p.method}</span></div></div>
              <div className="font-semibold text-brand-700">{ugx(p.amount)}</div>
            </Link>
          ))}
        </div>
      </Fold>
      <Fold title="Repairs with no provider" hint={unassigned ? `${unassigned} waiting` : "Every open job has a provider"} href="/manager/jobs">
        <JobList where={{ providerId: null, status: { notIn: ["done", "cancelled"] } }} base="/manager/jobs" empty="Every open job has a provider" />
      </Fold>
      <Fold title="Insights" hint="Rents, demand and what to do next">
        <SmartPanel base="/manager" />
      </Fold>
      <Fold title="By district" hint="Occupancy and rent by area" href="/manager/areas">
        <AreaReport by="district" base="/manager/areas" limit={6} />
      </Fold>
    </div>
  );
}
