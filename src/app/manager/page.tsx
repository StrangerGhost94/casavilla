import Link from "next/link";
import { AlertTriangle, BarChart3, Building2, CheckCircle2, Plus, Wallet } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, ugx } from "@/lib/format";
import { AttentionList, Avatar, SectionTitle } from "@/components/ui";
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
  const [pending, pendingApps, unassigned, recentRaw, efrisMissing] = await Promise.all([
    db.user.count({ where: { status: "pending" } }),
    db.application.count({ where: { status: "pending" } }).then(async (n) => n + await db.tenantLink.count({ where: { status: "pending" } })),
    db.job.count({ where: { providerId: null, status: { notIn: ["done", "cancelled"] } } }),
    db.payment.findMany({ where: { status: "success" }, orderBy: { paidAt: "desc" }, take: 6, include: { tenant: { select: { name: true } }, charge: { select: { kind: true, period: true } } } }),
    missingCount(),
  ]);
  const dataIssues = (await runChecks()).filter((c) => c.count > 0).length;
  const vacant = s.units - s.occupied;
  const pct = s.due_month ? Math.min(100, Math.round((s.collected / s.due_month) * 100)) : 0;
  const occupancy = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  // Only what actually needs doing, most urgent first.
  const todo = [
    { href: "/manager/tenants", count: s.lateTenants, label: "Tenants behind on rent", tone: "red" as const },
    { href: "/manager/people?status=pending", count: pending, label: "Landlords & providers to approve", tone: "blue" as const },
    { href: "/manager/applications", count: pendingApps, label: "Applications & tenants to connect", tone: "blue" as const },
    { href: "/manager/jobs", count: unassigned, label: "Repairs with no provider", tone: "gold" as const },
    { href: "/manager/efris", count: efrisMissing, label: "Payments waiting for an EFRIS receipt", tone: "gold" as const },
    { href: "/manager/tenants#former", count: s.pastTenants, label: s.pastArrears ? `Former tenants who still owe (${ugx(s.pastArrears)})` : "Former tenants who still owe", tone: "gold" as const },
    { href: "/manager/health", count: dataIssues, label: "Data checks needing attention", tone: "gold" as const },
  ].filter((r) => r.count > 0);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" });
  return (
    <div className="mx-auto max-w-5xl">
      {/* Greeting and the things managers reach for most */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">{today}</div>
          <h1 className="h1 mt-0.5">Portfolio overview</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/manager/properties/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add property</Link>
          <Link href="/manager/payments" className="btn-outline btn-sm"><Wallet className="h-4 w-4" /> Payments</Link>
          <Link href="/manager/reports" className="btn-outline btn-sm"><BarChart3 className="h-4 w-4" /> Reports</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/manager/payments" className="col-span-2 overflow-hidden rounded-2xl bg-brand-900 p-5 text-white shadow-card transition hover:bg-brand-950">
          <div className="flex items-center justify-between text-xs text-white/70"><span>Collected this month</span><span className="font-semibold text-gold-300">{pct}%</span></div>
          <div className="mt-1 text-2xl font-bold sm:text-3xl">{ugx(s.collected)}</div>
          <div className="mt-4 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-gold-400" style={{ width: `${pct}%` }} /></div>
          <div className="mt-2 flex justify-between gap-3 text-xs text-white/70"><span>of {ugx(s.due_month)} due</span><span>{ugx(s.left_month > 0 ? s.left_month : 0)} still to come</span></div>
        </Link>
        <Link href="/manager/tenants" className="card p-4 transition hover:-translate-y-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon-50 text-maroon-600"><AlertTriangle className="h-[18px] w-[18px]" /></div>
          <div className="mt-3 text-lg font-bold leading-tight text-brand-950 sm:text-xl">{ugx(s.arrears)}</div>
          <div className="mt-1 text-xs font-medium text-stone-500">Overdue · {s.lateTenants} tenant{s.lateTenants === 1 ? "" : "s"}</div>
        </Link>
        <Link href="/manager/properties" className="card p-4 transition hover:-translate-y-0.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Building2 className="h-[18px] w-[18px]" /></div>
          <div className="mt-3 text-lg font-bold leading-tight text-brand-950 sm:text-xl">{occupancy}% let</div>
          <div className="mt-1 text-xs font-medium text-stone-500">{s.occupied} of {s.units} units · {vacant} vacant</div>
          <div className="mt-0.5 text-[11px] text-stone-400">{s.properties} propert{s.properties === 1 ? "y" : "ies"}</div>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle title={todo.length ? `To do · ${todo.length}` : "To do"} />
          {todo.length ? <AttentionList rows={todo} /> : (
            <div className="card flex items-center gap-3 p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700"><CheckCircle2 className="h-5 w-5" /></span>
              <div><div className="text-sm font-semibold text-brand-950">All caught up</div><div className="text-xs text-stone-500">Nothing is waiting on you right now.</div></div>
            </div>
          )}
        </div>
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
