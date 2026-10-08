import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { ugx } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";

export default async function LandlordHome() {
  const u = await requireUser("landlord");
  await ensureChargesFor("landlord", u.id);
  const s = await portfolioStats(u.id);
  const pendingApps = await db.application.count({ where: { status: "pending", unit: { property: { landlordId: u.id } } } });
  const openJobs = await db.job.count({ where: { landlordId: u.id, status: { notIn: ["done", "cancelled"] } } });
  const occ = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <>
      <PageHeader title={`Hello, ${u.name.split(" ")[0]}`} subtitle="Your portfolio at a glance."
        actions={<Link href="/landlord/properties/new" className="btn-primary">Add property</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Collected this month" value={ugx(s.collected)} hint={`of ${ugx(s.due_month)} rent due this month`} href="/landlord/tenants" />
        <Stat label="Overdue rent" value={<span className={s.arrears ? "text-maroon-600" : ""}>{ugx(s.arrears)}</span>} href="/landlord/tenants" />
        <Stat label="Occupancy" value={`${occ}%`} hint={`${s.occupied} of ${s.units} units · ${s.properties} properties`} href="/landlord/properties" />
        <Stat label="Needs attention" value={pendingApps + openJobs} hint={`${pendingApps} applications · ${openJobs} open repairs`} href={pendingApps ? "/landlord/applications" : "/landlord/maintenance"} />
      </div>
      <h2 className="h2 mb-3 mt-8">Tenants with balances</h2>
      <TenantsTable where={{ landlordId: u.id, status: "active" }} only="owing" base="/landlord/tenants" />
    </>
  );
}
