import Link from "next/link";
import { AlertTriangle, Building2, CalendarRange, CircleDollarSign, DoorOpen, PieChart, UserMinus, Wallet } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { ugx } from "@/lib/format";
import { AttentionList, KeyRow, SectionTitle, Stat } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { SmartPanel } from "@/components/Insights";
import { AreaReport } from "@/components/AreaReport";
import { missingCount } from "@/lib/efris";

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
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="h2">My portfolio</h1>
        <Link href="/landlord/properties/new" className="btn-primary btn-sm hidden lg:inline-flex">Add property</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Properties" value={s.properties} icon={<Building2 className="h-[18px] w-[18px]" />} href="/landlord/properties" />
        <Stat label="Units" value={s.units} hint={`${s.occupied} occupied`} icon={<DoorOpen className="h-[18px] w-[18px]" />} href="/landlord/properties" />
        <Stat label="Monthly rent roll" value={ugx(rentRoll._sum.rent ?? 0)} icon={<CircleDollarSign className="h-[18px] w-[18px]" />} href="/landlord/tenants" />
        <Stat label="Collected this month" value={ugx(s.collected)} icon={<Wallet className="h-[18px] w-[18px]" />} href="/landlord/tenants" />
      </div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Income overview" />
          <div className="card divide-y divide-stone-100 p-0">
            <KeyRow icon={<Wallet className="h-4 w-4" />} label="Collected this month" value={ugx(s.collected)} />
            <KeyRow icon={<CalendarRange className="h-4 w-4" />} label="Due this month" value={<>{ugx(s.due_month)}{s.left_month > 0 && <span className="block text-[11px] font-normal text-stone-500">{ugx(s.left_month)} still to collect</span>}</>} />
            <KeyRow icon={<AlertTriangle className="h-4 w-4" />} label="Overdue (current tenants)" value={<span className={s.arrears ? "text-maroon-600" : ""}>{ugx(s.arrears)}</span>} />
            {s.pastArrears > 0 && <KeyRow icon={<UserMinus className="h-4 w-4" />} label={<Link href="/landlord/tenants#former" className="hover:underline">Owed by former tenants</Link>} value={<span className="text-gold-700">{ugx(s.pastArrears)}</span>} />}
            <KeyRow icon={<PieChart className="h-4 w-4" />} label="Occupancy" value={`${occ}%`} strong />
          </div>
          <Link href="/landlord/tenants" className="btn-primary mt-3 w-full">View tenants & rent</Link>
        </div>
        <div>
          <SectionTitle title="Attention required" />
          <AttentionList rows={[
            { href: "/landlord/tenants", count: s.lateTenants, label: "Tenants with overdue rent", tone: "red" },
            { href: "/landlord/maintenance", count: openJobs, label: "Open maintenance requests", tone: "gold" },
            { href: "/landlord/applications", count: pendingApps, label: "Applications & tenants to confirm", tone: "blue" },
            { href: "/landlord/properties", count: vacant, label: "Vacant units", tone: "green" },
            ...(efrisMissing ? [{ href: "/landlord/efris", count: efrisMissing, label: "Payments waiting for an EFRIS receipt", tone: "gold" as const }] : []),
          ]} />
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
