import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { roleName } from "@/lib/nav";
import { Badge, PageHeader, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { CollectedCard, MiniStat } from "@/components/Dashboard";
import { PropertyList, TenantsTable, portfolioStats } from "@/components/Portfolio";
import { PayoutAccountForm } from "@/components/Payouts";
import { setUserStatus } from "../../actions";

export const metadata = { title: "Person" };

/** Everything about one person in one place: contact, status, and (by role) their properties, tenants, lease or jobs. */
export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser("manager");
  const u = await db.user.findUnique({ where: { id: Number((await params).id) || 0 } });
  if (!u) notFound();
  const local = u.phone.replace("+", "");
  const [leases, jobs, sites, requests] = await Promise.all([
    u.role === "tenant" ? db.lease.findMany({ where: { tenantId: u.id }, orderBy: { startDate: "desc" }, include: { unit: { select: { label: true, property: { select: { name: true } } } } } }) : [],
    u.role === "provider" ? db.job.groupBy({ by: ["status"], where: { providerId: u.id }, _count: { _all: true } }) : [],
    db.buildSite.findMany({ where: { clientId: u.id }, select: { id: true, title: true, status: true } }),
    db.buildRequest.count({ where: { userId: u.id } }),
  ]);
  const s = u.role === "landlord" ? await portfolioStats(u.id) : null;
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/manager/people" className="link text-sm">← People</Link>
      <PageHeader title={u.businessName || u.name} subtitle={`${roleName[u.role]}${u.businessName ? ` · ${u.name}` : ""} · joined ${fmtDate(u.createdAt)}`} />
      <div className="card flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm">{u.phone}{u.phoneVerifiedAt ? <span className="text-brand-700"> · verified</span> : ""} · {u.email}</span>
        <Badge color={u.status === "active" ? "green" : u.status === "pending" ? "gold" : "red"}>{u.status}</Badge>
        <a href={`tel:${u.phone}`} className="btn-outline btn-sm"><Phone className="h-3.5 w-3.5" /> Call</a>
        <a href={`https://wa.me/${local}`} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        {u.id !== me.id && u.status !== "active" && <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" /><Submit className="btn-primary btn-sm">{u.status === "pending" ? "Approve" : "Reactivate"}</Submit></form>}
        {u.id !== me.id && u.status !== "suspended" && <form action={setUserStatus}><input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="suspended" /><Submit className="btn-ghost btn-sm text-maroon-600">Suspend</Submit></form>}
      </div>

      {s && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <CollectedCard href={`/manager/statements?landlord=${u.id}`} collected={s.collected} due={s.due_month} left={s.left_month} />
            <MiniStat href="/manager/tenants" tone={s.arrears ? "red" : "green"} icon={<AlertTriangle className="h-[18px] w-[18px]" />} value={ugx(s.arrears)} label={`Overdue · ${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"}`} />
            <MiniStat href="#properties" icon={<Building2 className="h-[18px] w-[18px]" />} value={`${s.units ? Math.round((s.occupied / s.units) * 100) : 0}% let`} label={`${s.occupied} of ${s.units} units`} hint={`${s.properties} propert${s.properties === 1 ? "y" : "ies"}`} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/manager/statements?landlord=${u.id}`} className="btn-outline btn-sm">Statements</Link>
            <Link href={`/manager/properties/new?landlord=${u.id}`} className="btn-outline btn-sm">Add a property for them</Link>
            <Link href="/manager/payouts" className="btn-outline btn-sm">Payouts</Link>
          </div>
          <section id="properties" className="scroll-mt-24"><SectionTitle title="Properties" /><PropertyList where={{ landlordId: u.id }} base="/manager/properties" /></section>
          <section><SectionTitle title="Tenants" /><TenantsTable where={{ landlordId: u.id, status: "active" }} base="/manager/tenants" /></section>
          <details className="card"><summary className="cursor-pointer font-semibold text-brand-950">Where their rent is paid out</summary><div className="mt-3"><PayoutAccountForm landlordId={u.id} manager /></div></details>
        </>
      )}

      {u.role === "tenant" && (
        <section>
          <SectionTitle title="Leases" />
          {leases.length ? (
            <div className="card divide-y divide-stone-100 p-0">
              {leases.map((l) => (
                <Link key={l.id} href={`/manager/tenants/${l.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-stone-50">
                  <span>{l.unit.property.name} · {l.unit.label}<span className="block text-xs text-stone-500">{fmtDate(l.startDate)} · {ugx(l.rent)} / month</span></span>
                  <Badge color={l.status === "active" ? "green" : "gray"}>{l.status}</Badge>
                </Link>
              ))}
            </div>
          ) : <p className="card text-sm text-stone-500">No lease yet.</p>}
        </section>
      )}

      {u.role === "provider" && (
        <section className="card text-sm">
          <div className="font-semibold text-brand-950">Jobs</div>
          <div className="mt-1 text-stone-600">{jobs.length ? jobs.map((j) => `${j._count._all} ${j.status}`).join(" · ") : "No jobs yet."}</div>
          <Link href="/manager/jobs" className="link mt-2 inline-block">All maintenance jobs →</Link>
        </section>
      )}

      {(sites.length > 0 || requests > 0) && (
        <section className="card text-sm">
          <div className="font-semibold text-brand-950">Building with CasaVilla</div>
          {sites.map((b) => <Link key={b.id} href={`/manager/build/sites/${b.id}`} className="link block">{b.title} ({b.status.replace("_", " ")})</Link>)}
          {requests > 0 && <Link href="/manager/build?tab=all" className="mt-1 block text-stone-600 hover:underline">{requests} build request{requests === 1 ? "" : "s"}</Link>}
        </section>
      )}
    </div>
  );
}
