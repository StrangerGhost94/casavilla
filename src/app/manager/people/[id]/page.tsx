import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Building2, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { roleLabel } from "@/lib/nav";
import { Badge, PageHeader, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { Signature } from "@/components/Signature";
import { Checklist } from "@/components/Checklist";
import { History } from "@/components/History";
import { CollectedCard, MiniStat } from "@/components/Dashboard";
import { PropertyList, TenantsTable, portfolioStats } from "@/components/Portfolio";
import { landlordCodeFor } from "@/lib/landlord-code";
import { SITE } from "@/lib/seo";
import { newLandlordCode, setSuperAdmin, setUserStatus } from "../../actions";

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
  const code = u.role === "landlord" && u.status !== "pending" ? await landlordCodeFor(u.id) : null;
  // Office accounts, and approving a new landlord, are for super admins.
  const canChange = me.superAdmin || !(u.role === "manager" || (u.role === "landlord" && u.status === "pending"));
  const provider = u.role === "provider";
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link href="/manager/people" className="link text-sm">← People</Link>
      <PageHeader title={u.businessName || u.name} subtitle={`${roleLabel(u)}${u.businessName ? ` · ${u.name}` : ""} · joined ${fmtDate(u.createdAt)}`} />
      <div className="card flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm">{u.phone}{u.phoneVerifiedAt ? <span className="text-brand-700"> · verified</span> : ""} · {u.email}</span>
        <Badge color={u.status === "active" ? "green" : u.status === "pending" ? "gold" : "red"}>{u.status}</Badge>
        <a href={`tel:${u.phone}`} className="btn-outline btn-sm"><Phone className="h-3.5 w-3.5" /> Call</a>
        <a href={`https://wa.me/${local}`} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        {!canChange && u.id !== me.id && <span className="text-xs text-stone-500">{u.role === "manager" ? "Only a super admin can change office accounts" : "A super admin approves landlords and sets their commission"}</span>}
      </div>

      {/* Changes to an account are signed: a reason and the office member's own password, kept in the audit trail. */}
      {u.id !== me.id && (
        <div className="space-y-2">
          {provider && u.status === "pending" && (
            <form action={setUserStatus} className="card space-y-2 text-sm">
              <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" />
              <Checklist name="provider" />
              <Submit className="btn-primary btn-sm">Approve provider</Submit>
            </form>
          )}
          {canChange && u.status !== "active" && !(provider && u.status === "pending") && (
            <details className="card text-sm" open={u.status === "pending"}>
              <summary className="cursor-pointer font-semibold text-brand-950">{u.status === "pending" ? "Approve" : "Reactivate"} this account</summary>
              <form action={setUserStatus} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="active" />
                {/* A landlord's commission is agreed when they sign up with CasaVilla, so it's set before approval. */}
                {u.role === "landlord" && u.status === "pending" && <Checklist name="landlord" />}
                {u.role === "landlord" && u.status === "pending" && (
                  <label className="flex items-center gap-1.5"><span className="text-stone-600">Commission agreed</span>
                    <input name="commission" type="number" min={0} max={50} step={0.5} required defaultValue={u.commissionPct || ""} className="input w-20 py-1.5" aria-label="Commission %" />%</label>
                )}
                <Signature reasonHint={u.status === "pending" ? "e.g. ID checked, agreement signed" : "Why reactivate?"} />
                <Submit className="btn-primary btn-sm">{u.status === "pending" ? "Approve" : "Reactivate"}</Submit>
              </form>
            </details>
          )}
          {u.role === "manager" && me.superAdmin && u.status === "active" && (
            <details className="card text-sm">
              <summary className="cursor-pointer font-semibold text-brand-950">{u.superAdmin ? "Make ordinary staff" : "Make super admin"}</summary>
              <form action={setSuperAdmin} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={u.id} /><input type="hidden" name="on" value={u.superAdmin ? "0" : "1"} />
                <p className="text-xs text-stone-500">{u.superAdmin ? "They will lose the super admin powers." : "They will be able to manage office accounts, approve landlords, change commission and waive charges."}</p>
                <Signature />
                <Submit className="btn-outline btn-sm">{u.superAdmin ? "Make ordinary staff" : "Make super admin"}</Submit>
              </form>
            </details>
          )}
          {(me.superAdmin || u.role !== "manager") && u.status !== "suspended" && (
            <details className="card text-sm">
              <summary className="cursor-pointer font-semibold text-maroon-600">Suspend this account</summary>
              <form action={setUserStatus} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={u.id} /><input type="hidden" name="status" value="suspended" />
                <p className="text-xs text-stone-500">They can no longer sign in{u.role === "landlord" ? "; their vacant units come off the listings" : u.role === "provider" ? "; their open jobs go back to be reassigned" : ""}. Their history stays.</p>
                <Signature reasonHint="Why suspend?" />
                <Submit className="btn-outline btn-sm border-maroon-200 text-maroon-600">Suspend</Submit>
              </form>
            </details>
          )}
        </div>
      )}

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
          </div>
          <section id="properties" className="scroll-mt-24"><SectionTitle title="Properties" /><PropertyList where={{ landlordId: u.id }} base="/manager/properties" /></section>
          <section><SectionTitle title="Tenants" /><TenantsTable where={{ landlordId: u.id, status: "active" }} base="/manager/tenants" /></section>
          {code && (
            <div className="card flex flex-wrap items-center gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-950">Landlord code: <span className="font-mono tracking-wider">{code}</span> · commission {u.commissionPct}%</div>
                <div className="text-xs text-stone-500">Give this code to their existing tenants. They enter it when they sign up, instead of the landlord&apos;s phone number.</div>
              </div>
              {me.superAdmin && (
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-semibold text-brand-700">New code…</summary>
                  <form action={newLandlordCode} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={u.id} />
                    <p className="text-xs text-stone-500">The old code stops working, so tenants who haven&apos;t joined yet will need the new one.</p>
                    <Signature reasonHint="e.g. code shared with the wrong people" />
                    <Submit className="btn-outline btn-sm">Replace code</Submit>
                  </form>
                </details>
              )}
              <a href={`https://wa.me/?text=${encodeURIComponent(`Hello, CasaVilla Property Management now manages your home. Join the CasaVilla app to pay rent by Mobile Money, get receipts and report repairs: ${SITE}/register?code=${code}`)}`} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> Send sign-up link</a>
            </div>
          )}
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

      <History refs={[{ entity: "user", ids: [u.id] }]} />
    </div>
  );
}
