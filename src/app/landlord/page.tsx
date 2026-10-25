import Link from "next/link";
import { AlertTriangle, Banknote, Building2, CalendarRange, CircleDollarSign, PieChart, Plus, Receipt, Wallet } from "lucide-react";
import { CollectedCard, DashHeader, MiniStat, TodoList } from "@/components/Dashboard";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { ugx } from "@/lib/format";
import { KeyRow, SectionTitle } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { SmartPanel } from "@/components/Insights";
import { AreaReport } from "@/components/AreaReport";
import { missingCount } from "@/lib/efris";
import { PushToggle } from "@/components/PushToggle";
import { pushPublicKey } from "@/lib/push";

export default async function LandlordHome() {
  const u = await requireUser("landlord");
  await ensureChargesFor("landlord", u.id);
  const s = await portfolioStats(u.id);
  const [pendingApps, openJobs, vacant, rentRoll, efrisMissing] = await Promise.all([
    db.application.count({ where: { status: "pending", unit: { property: { landlordId: u.id } } } })
      .then(async (n) => n + await db.tenantLink.count({ where: { status: "pending", landlordId: u.id } })),
    db.job.count({ where: { landlordId: u.id, status: { notIn: ["done", "cancelled"] } } }),
    db.unit.count({ where: { status: "vacant", property: { landlordId: u.id } } }),
    db.lease.aggregate({ _sum: { rent: true }, where: { landlordId: u.id, status: "active" } }),
    missingCount(u.id),
  ]);
  const occ = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <DashHeader title="My portfolio">
        <Link href="/landlord/properties/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add property</Link>
        <Link href="/landlord/statements" className="btn-outline btn-sm"><Receipt className="h-4 w-4" /> Statements</Link>
        <Link href="/landlord/payouts" className="btn-outline btn-sm"><Banknote className="h-4 w-4" /> Payouts</Link>
      </DashHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CollectedCard href="/landlord/tenants" collected={s.collected} due={s.due_month} left={s.left_month} />
        <MiniStat href="/landlord/tenants" tone={s.arrears ? "red" : "green"} icon={<AlertTriangle className="h-[18px] w-[18px]" />} value={ugx(s.arrears)} label={`Overdue · ${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"}`}
          hint={s.pastArrears > 0 ? `+ ${ugx(s.pastArrears)} from former tenants` : undefined} />
        <MiniStat href="/landlord/properties" icon={<Building2 className="h-[18px] w-[18px]" />} value={`${occ}% let`} label={`${s.occupied} of ${s.units} units · ${vacant} vacant`} hint={`Rent roll ${ugx(rentRoll._sum.rent ?? 0)} / month`} />
      </div>

      <div className="mt-3 empty:hidden"><PushToggle publicKey={pushPublicKey()} variant="card" text="Know the moment a tenant pays, applies or reports a repair, straight on this phone." /></div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <TodoList rows={[
          { href: "/landlord/tenants", count: s.lateTenants, label: "Tenants with overdue rent", tone: "red" },
          { href: "/landlord/applications", count: pendingApps, label: "Applications & tenants to confirm", tone: "blue" },
          { href: "/landlord/maintenance", count: openJobs, label: "Open maintenance requests", tone: "gold" },
          { href: "/landlord/efris", count: efrisMissing, label: "Payments waiting for an EFRIS receipt", tone: "gold" },
          { href: "/landlord/tenants#former", count: s.pastTenants, label: "Former tenants who still owe", tone: "gold" },
          { href: "/landlord/properties", count: vacant, label: "Vacant units to let", tone: "green" },
        ]} />
        <div>
          <SectionTitle title="This month" href="/landlord/reports" cta="Reports" />
          <div className="card divide-y divide-stone-100 p-0">
            <KeyRow icon={<CalendarRange className="h-4 w-4" />} label="Due this month" value={ugx(s.due_month)} />
            <KeyRow icon={<Wallet className="h-4 w-4" />} label="Collected" value={ugx(s.collected)} />
            <KeyRow icon={<CircleDollarSign className="h-4 w-4" />} label="Still to collect" value={ugx(Math.max(0, s.left_month))} />
            <KeyRow icon={<PieChart className="h-4 w-4" />} label="Occupancy" value={`${occ}%`} strong />
          </div>
          <Link href="/landlord/tenants" className="btn-outline mt-3 w-full">View tenants & rent</Link>
        </div>
      </div>

      <SmartPanel landlordId={u.id} base="/landlord" />

      <SectionTitle title="By district" href="/landlord/areas" cta="All areas" />
      <AreaReport landlordId={u.id} by="district" base="/landlord/areas" limit={5} />

      <SectionTitle title="Tenants with balances" href="/landlord/tenants" />
      <TenantsTable where={{ landlordId: u.id, status: "active" }} only="owing" base="/landlord/tenants" />
    </div>
  );
}
