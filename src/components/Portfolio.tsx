import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import type { Prisma, Property } from "@prisma/client";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Avatar, Badge, Empty, Field, Photo } from "./ui";
import { Submit, ConfirmSubmit } from "./client";
import { Documents } from "./Documents";
import { InspectionsCard } from "./Inspections";
import { PlaceFields } from "./PlaceFields";
import { UnitFields } from "./UnitFields";
import { PhotoStudio } from "./PhotoStudio";
import { Steps, UnitGroups } from "./NewPropertyFlow";
import { shotList } from "@/lib/photo-check";
import { Ledger } from "./Ledger";
import { saveProperty, addUnit, updateUnit, decideApplication, removeProperty, restoreProperty, removeUnit } from "@/app/landlord/actions";
import { propertyRemoval } from "@/lib/removal";
import { AgreementCard, CashForm, ChargeForm, LeaseFacts, MoveOutForm, RenewForm, ScorePill, TenantScoreCard } from "./LeaseTools";
import { ensureCharges } from "@/lib/billing";
import { crumbText, trailFor } from "@/lib/geo";
import { marketRent, tenantScore } from "@/lib/insights";

import { PROPERTY_TYPES } from "@/lib/property-types";
export { PROPERTY_TYPES };

/** Editing an existing property's details (its own screen, not repeated on the property page). */
export async function PropertyForm({ p }: { p: Property }) {
  return (
    <form action={saveProperty} className="card space-y-4">
      <input type="hidden" name="id" value={p.id} />
      <BasicsFields p={p} />
      <PlaceFields p={p} />
      <Submit>Save changes</Submit>
    </form>
  );
}

function BasicsFields({ p }: { p?: Property }) {
  return (
    <>
      <Field label="Property name"><input name="name" defaultValue={p?.name} className="input" required maxLength={120} placeholder="e.g. Rubaga Court" /></Field>
      <Field label="Type">
        <select name="type" defaultValue={p?.type} className="input">{PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
      <Field label="Description (optional)"><textarea name="description" defaultValue={p?.description ?? ""} rows={3} className="input" placeholder="Water, power, parking, security, nearby…" /></Field>
    </>
  );
}

/** Adding a property: three short steps in one form — the basics, where it is, and its units. */
export async function NewPropertyForm({ landlords }: { landlords?: { id: number; name: string }[] }) {
  return (
    <form action={saveProperty}>
      <Steps titles={["Basics", "Location", "Units"]} submitLabel="Add property">
        <div className="space-y-4">
          {landlords && (
            <Field label="Landlord">
              <select name="landlordId" className="input" required>{landlords.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            </Field>
          )}
          <BasicsFields />
        </div>
        <div><PlaceFields /></div>
        <div><UnitGroups /></div>
      </Steps>
    </form>
  );
}

export async function PropertyList({ where, base }: { where: Prisma.PropertyWhereInput; base: string }) {
  const [rows, archived] = await Promise.all([
    db.property.findMany({
      where: { ...where, archivedAt: null }, orderBy: { createdAt: "desc" },
      include: { landlord: { select: { name: true } }, units: { select: { status: true } } },
    }),
    db.property.findMany({ where: { ...where, archivedAt: { not: null } }, orderBy: { archivedAt: "desc" }, select: { id: true, name: true, location: true, archivedAt: true } }),
  ]);
  const archivedList = archived.length > 0 && (
    <details className="card mt-6">
      <summary className="cursor-pointer list-none text-sm font-semibold text-stone-600">Archived properties ({archived.length})</summary>
      <div className="mt-2 divide-y divide-stone-100">
        {archived.map((p) => (
          <Link key={p.id} href={`${base}/${p.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline">
            <span className="min-w-0 truncate">{p.name} · <span className="text-stone-500">{p.location}</span></span>
            <span className="shrink-0 text-xs text-stone-500">archived {fmtDate(p.archivedAt!)}</span>
          </Link>
        ))}
      </div>
    </details>
  );
  if (!rows.length) return <><Empty title="No properties yet">Add your first property, then its units.</Empty>{archivedList}</>;
  return (
    <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => {
        const total = p.units.length;
        const occupied = p.units.filter((u) => u.status === "occupied").length;
        return (
          <Link key={p.id} href={`${base}/${p.id}`} className="card overflow-hidden p-0 hover:shadow-md">
            <Photo id={p.photoId} alt={p.name} className="h-36 w-full" />
            <div className="p-4">
              <div className="font-semibold text-stone-900">{p.name}</div>
              <div className="muted">{p.location} · {p.type}</div>
              {!p.locationId && <div className="mt-1 text-[11px] font-semibold text-gold-700">Location not verified</div>}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>{occupied}/{total} units occupied</span>
                <span className="text-xs text-stone-500">{p.landlord.name}</span>
              </div>
              <div className="mt-2 h-1.5 rounded bg-stone-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${total ? (occupied / total) * 100 : 0}%` }} /></div>
            </div>
          </Link>
        );
      })}
    </div>
    {archivedList}
    </>
  );
}

export async function PropertyDetail({ id, viewer, base }: { id: number; viewer: User; base: string }) {
  const p = await db.property.findUnique({
    where: { id },
    include: { units: { orderBy: { label: "asc" }, include: { leases: { where: { status: "active" }, include: { tenant: { select: { name: true } } } } } } },
  });
  if (!p || (viewer.role !== "manager" && p.landlordId !== viewer.id)) notFound();
  const tenantsBase = base.replace("/properties", "/tenants");
  const trail = await trailFor(p.locationId);
  const photos = await db.propertyPhoto.findMany({ where: { propertyId: p.id }, orderBy: [{ sort: "asc" }] });
  const markets = new Map(await Promise.all(p.units.filter((u) => u.status === "vacant" && u.mode === "long").map(async (u) => [u.id, await marketRent(p, u.bedrooms, u.id)] as const)));
  const occupied = p.units.filter((u) => u.status === "occupied").length;
  const editHref = `${base}/${p.id}/edit`;
  // Units that were never let, booked or repaired can be deleted outright.
  const ids = p.units.map((u) => u.id);
  const [withLeases, withStays, withJobs] = await Promise.all([
    db.lease.findMany({ where: { unitId: { in: ids } }, select: { unitId: true }, distinct: ["unitId"] }),
    db.booking.findMany({ where: { unitId: { in: ids }, status: { notIn: ["blocked", "expired"] } }, select: { unitId: true }, distinct: ["unitId"] }),
    db.job.findMany({ where: { unitId: { in: ids } }, select: { unitId: true }, distinct: ["unitId"] }),
  ]);
  const used = new Set([...withLeases, ...withStays, ...withJobs].map((x) => x.unitId));
  return (
    <div>
      <Link href={base} className="link hidden text-sm lg:inline">← Properties</Link>
      {p.archivedAt && (
        <div className="card mt-3 flex flex-wrap items-center justify-between gap-3 border-gold-200 bg-gold-50/60">
          <div className="text-sm text-stone-700"><b>Archived {fmtDate(p.archivedAt)}.</b> Hidden from your lists and listings; its tenancy history is kept.</div>
          <form action={restoreProperty}><input type="hidden" name="id" value={p.id} /><Submit className="btn-outline btn-sm">Restore</Submit></form>
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="card overflow-hidden p-0">
            <Photo id={p.photoId} alt={p.name} className="h-36 w-full" />
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="text-xl font-bold text-brand-950">{p.name}</div>
                <div className="muted">{p.type} · {p.units.length} unit{p.units.length === 1 ? "" : "s"}{p.units.length ? ` · ${occupied} let` : ""}</div>
                {trail.length > 1 ? <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}{p.lat != null ? " · exact pin saved" : ""}</div>
                  : <Link href={editHref} className="mt-1 inline-block rounded-lg bg-gold-50 px-2 py-1 text-[11px] font-semibold text-gold-700">Location not verified — confirm it →</Link>}
              </div>
              <Link href={editHref} className="btn-outline btn-sm shrink-0">Edit</Link>
            </div>
          </div>

          <div className="card p-0">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div className="font-semibold text-brand-950">Units</div>
              <span className="text-xs text-stone-500">Tap a unit to edit it</span>
            </div>
            <div className="divide-y divide-stone-100 border-t border-stone-100">
              {p.units.map((u) => {
                const lease = u.leases[0];
                const m = markets.get(u.id);
                const diff = m ? Math.round(((u.rent - m.median) / m.median) * 100) : 0;
                return (
                  <details key={u.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-stone-900">{u.label}</div>
                        <div className="truncate text-xs text-stone-500">
                          {u.bedrooms ? `${u.bedrooms} bed · ` : ""}{u.bathrooms} bath{u.mode === "short" ? ` · ${ugx(u.nightlyRate ?? 0)}/night` : ` · ${ugx(u.rent)}/mo`}
                          {lease ? ` · ${lease.tenant.name}` : u.status === "vacant" ? (u.listed ? " · listed" : " · not listed") : ""}
                        </div>
                        {m && Math.abs(diff) >= 10 && <div className={`text-[11px] ${diff > 0 ? "text-gold-700" : "text-brand-700"}`}>{diff > 0 ? `${diff}% above` : `${-diff}% below`} similar units {m.scope}</div>}
                      </div>
                      {u.mode === "short" ? <Badge color="blue">short stay</Badge> : <Badge>{u.status}</Badge>}
                      <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" />
                    </summary>
                    <div className="space-y-3 bg-stone-50/60 px-4 pb-4 pt-1">
                      <div className="flex flex-wrap gap-3 text-xs">
                        {lease && <Link href={`${tenantsBase}/${lease.id}`} className="link">Open {lease.tenant.name}'s tenancy →</Link>}
                        {u.status === "vacant" && u.listed && <Link href={u.mode === "short" ? `/stays/${u.id}` : `/listings/${u.id}`} className="link">View listing →</Link>}
                      </div>
                      {m && <p className="text-[11px] text-stone-500">Similar {u.bedrooms}-bed units {m.scope} let for about {ugx(m.median)}.</p>}
                      <form action={updateUnit} className="grid grid-cols-[1.3fr_0.6fr_1.2fr] items-end gap-2">
                        <input type="hidden" name="id" value={u.id} />
                        <label className="min-w-0"><span className="label">Unit</span><input name="label" defaultValue={u.label} className="input py-2" /></label>
                        <label className="min-w-0"><span className="label">Beds</span><input name="bedrooms" type="number" min={0} defaultValue={u.bedrooms} className="input py-2" /></label>
                        <label className="min-w-0"><span className="label">Rent (UGX)</span><input name="rent" type="number" min={0} defaultValue={u.rent} className="input py-2" /></label>
                        <label className="col-span-full flex items-center gap-2 text-sm text-stone-600"><input name="listed" type="checkbox" defaultChecked={u.listed} className="h-4 w-4 accent-brand-700" disabled={u.status === "occupied"} /> {u.status === "occupied" ? "Let — not listed" : "Listed publicly"}</label>
                        <UnitFields u={u} />
                        <div className="col-span-full"><Submit className="btn-primary btn-sm">Save {u.label}</Submit></div>
                      </form>
                      {!used.has(u.id) && (
                        <form action={removeUnit} className="text-right">
                          <input type="hidden" name="id" value={u.id} />
                          <ConfirmSubmit message={`Delete ${u.label}? This can't be undone.`} className="text-xs font-semibold text-maroon-600 hover:underline">Delete this unit</ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </details>
                );
              })}
              {p.units.length === 0 && <div className="px-4 py-4 text-sm text-stone-500">No units yet.</div>}
            </div>
            {!p.archivedAt && <details className="border-t border-stone-100" open={p.units.length === 0}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700"><Plus className="h-4 w-4" /> Add units</summary>
              <form action={addUnit} className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-4">
                <input type="hidden" name="propertyId" value={p.id} />
                <label className="col-span-2 min-w-0"><span className="label">Name</span><input name="label" className="input" placeholder="e.g. Apt B" required /></label>
                <label className="min-w-0"><span className="label">How many</span><input name="count" type="number" min={1} max={50} className="input" defaultValue={1} /></label>
                <label className="min-w-0"><span className="label">Beds</span><input name="bedrooms" type="number" min={0} className="input" defaultValue={1} /></label>
                <label className="col-span-2 min-w-0"><span className="label">Rent / month (UGX)</span><input name="rent" type="number" min={0} className="input" placeholder="e.g. 800000" required /></label>
                <label className="col-span-2 flex items-center gap-2 self-end pb-3 text-sm text-stone-600"><input type="checkbox" name="listed" defaultChecked className="h-4 w-4 accent-brand-700" /> List publicly</label>
                <p className="col-span-full text-[11px] text-stone-500">Several at once are numbered: Apt B 1, Apt B 2…</p>
                <UnitFields />
                <div className="col-span-full"><Submit className="btn-primary btn-sm">Add</Submit></div>
              </form>
            </details>}
          </div>
        </div>
        <div className="space-y-6">
          <PhotoSummary base={base} propertyId={p.id} photos={photos} units={p.units} />
          <Documents propertyId={p.id} viewerId={viewer.id} />
        </div>
      </div>
    </div>
  );
}

/** Remove a property: says up front whether it will be deleted, archived, or can't be removed yet. */
async function RemoveProperty({ id, name }: { id: number; name: string }) {
  const plan = await propertyRemoval(id);
  return (
    <details className="card mt-6 border-maroon-100">
      <summary className="cursor-pointer list-none text-sm font-semibold text-maroon-600">Remove this property</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-stone-600">{plan.reason}</p>
        {plan.mode !== "blocked" && (
          <form action={removeProperty} className="space-y-2">
            <input type="hidden" name="id" value={id} />
            <label className="block"><span className="label">Type <b>{name}</b> to confirm</span><input name="confirm" required autoComplete="off" className="input" /></label>
            <ConfirmSubmit message={plan.mode === "delete" ? `Delete ${name} for good?` : `Archive ${name}?`} className="btn-outline btn-sm border-maroon-200 text-maroon-600">
              {plan.mode === "delete" ? "Delete property" : "Archive property"}
            </ConfirmSubmit>
          </form>
        )}
      </div>
    </details>
  );
}

/** Editing a property's name, type, description and location. */
export async function PropertyEdit({ id, viewer, base }: { id: number; viewer: User; base: string }) {
  const p = await db.property.findUnique({ where: { id } });
  if (!p || (viewer.role !== "manager" && p.landlordId !== viewer.id)) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`${base}/${p.id}`} className="link text-sm">← {p.name}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold text-brand-950">Edit property</h1>
      <PropertyForm p={p} />
      {!p.archivedAt && <RemoveProperty id={p.id} name={p.name} />}
    </div>
  );
}

/** Compact photo card on the property page: progress, a strip of thumbnails, and one way in. */
function PhotoSummary({ base, propertyId, photos, units }: { base: string; propertyId: number; photos: { id: number; fileId: number; label: string; unitId: number | null; isCover: boolean }[]; units: { id: number; label: string; bedrooms: number; bathrooms: number }[] }) {
  const req = shotList(units, units.length > 1).filter((s) => s.required);
  const done = req.filter((s) => photos.some((x) => x.label.replace(/ · \d+$/, "") === s.label && x.unitId === s.unitId)).length;
  const href = `${base}/${propertyId}/photos`;
  const sorted = [...photos].sort((a, b) => Number(b.isCover) - Number(a.isCover));
  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-brand-950">Photos</div>
          <div className="text-xs text-stone-500">{photos.length ? `${photos.length} photo${photos.length === 1 ? "" : "s"} · ${done} of ${req.length} must-have rooms` : "No photos yet — listings with photos fill much faster"}</div>
        </div>
        <Link href={href} className={photos.length ? "btn-outline btn-sm shrink-0" : "btn-primary btn-sm shrink-0"}>{photos.length ? "Manage" : "Add photos"}</Link>
      </div>
      {req.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.round((done / req.length) * 100)}%` }} /></div>}
      {sorted.length > 0 && (
        <Link href={href} className="mt-3 flex gap-2 overflow-hidden">
          {sorted.slice(0, 5).map((x) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={x.id} src={`/api/files/${x.fileId}`} alt={x.label} className="h-16 w-20 shrink-0 rounded-lg object-cover" />
          ))}
          {sorted.length > 5 && <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm font-semibold text-stone-600">+{sorted.length - 5}</span>}
        </Link>
      )}
    </div>
  );
}

/** Dedicated photos screen for one property. */
export async function PropertyPhotos({ id, viewer, base, fresh }: { id: number; viewer: User; base: string; fresh?: boolean }) {
  const p = await db.property.findUnique({ where: { id }, include: { units: { orderBy: { label: "asc" }, select: { id: true, label: true, bedrooms: true, bathrooms: true } } } });
  if (!p || (viewer.role !== "manager" && p.landlordId !== viewer.id)) notFound();
  const photos = await db.propertyPhoto.findMany({ where: { propertyId: p.id }, orderBy: [{ sort: "asc" }] });
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`${base}/${p.id}`} className="link text-sm">← {p.name}</Link>
      <h1 className="mt-2 text-xl font-bold text-brand-950">Photos</h1>
      <p className="muted mb-4">{p.name} · {p.location}</p>
      {fresh && (
        <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
          <b>{p.name} is added with {p.units.length} unit{p.units.length === 1 ? "" : "s"}.</b> Last step: photos. Pick several at once — we'll match each to a room. You can also <Link href={`${base}/${p.id}`} className="link">skip for now</Link>.
        </div>
      )}
      <PhotoStudio propertyId={p.id} units={p.units}
        photos={photos.map((x) => ({ id: x.id, fileId: x.fileId, room: x.room, label: x.label, unitId: x.unitId, isCover: x.isCover, quality: x.quality }))} />
    </div>
  );
}

export async function ApplicationsTable({ where }: { where: Prisma.ApplicationWhereInput }) {
  const rows = await db.application.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { unit: { include: { property: { select: { name: true } } } }, tenant: { select: { name: true, phone: true, email: true } } },
  });
  if (!rows.length) return <Empty title="No applications">When tenants apply for your listed units, they show up here.</Empty>;
  const today = kampalaToday();
  const pending = rows.filter((a) => a.status === "pending");
  const tenantIds = [...new Set(pending.map((a) => a.tenantId))];
  const [scores, housed] = await Promise.all([
    Promise.all(tenantIds.map(async (t) => [t, await tenantScore(t)] as const)).then((x) => new Map(x)),
    db.lease.findMany({ where: { tenantId: { in: tenantIds }, status: "active" }, select: { tenantId: true, unit: { select: { label: true, property: { select: { name: true } } } } } }),
  ]);
  // Best applicant per unit: highest reliability score among those with a history.
  const best = new Map<number, number>();
  for (const a of pending) {
    const sc = scores.get(a.tenantId)?.score;
    if (sc == null) continue;
    const cur = best.get(a.unitId);
    if (cur === undefined || sc > (scores.get(pending.find((x) => x.id === cur)!.tenantId)?.score ?? -1)) best.set(a.unitId, a.id);
  }
  const rivals = (unitId: number) => pending.filter((x) => x.unitId === unitId).length;
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;
  return (
    <div className="space-y-4">
      {rows.map((a) => (
        <div key={a.id} className="card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{a.tenant.name} <span className="font-normal text-stone-500">→ {a.unit.property.name} · {a.unit.label}</span></div>
              <div className="text-sm text-stone-500">{a.tenant.phone} · {a.tenant.email} · applied {fmtDate(a.createdAt)}{a.moveIn && ` · wants to move in ${fmtDate(a.moveIn)}`}</div>
              {a.message && <p className="mt-2 text-sm text-stone-700">“{a.message}”</p>}
              {a.status === "pending" && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {scores.get(a.tenantId) && <ScorePill s={scores.get(a.tenantId)!} />}
                  {best.get(a.unitId) === a.id && rivals(a.unitId) > 1 && <span className="pill bg-gold-100 text-gold-700">★ Most reliable of {rivals(a.unitId)} applicants</span>}
                  {housed.find((h) => h.tenantId === a.tenantId) && (() => { const h = housed.find((x) => x.tenantId === a.tenantId)!; return <span className="pill bg-amber-50 text-amber-700">Currently renting {h.unit.property.name} · {h.unit.label} — that lease must end first</span>; })()}
                </div>
              )}
            </div>
            <Badge>{a.status}</Badge>
          </div>
          {a.status === "pending" && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-stone-100 pt-4">
              <form action={decideApplication} className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-7">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="approve" />
                <div className="col-span-2 sm:col-span-1"><Field label="Start"><input type="date" name="startDate" defaultValue={a.moveIn ? ymd(a.moveIn) : today} className="input" required /></Field></div>
                <div className="col-span-2 sm:col-span-1"><Field label="End"><input type="date" name="endDate" defaultValue={nextYear} className="input" required /></Field></div>
                <Field label="Rent / month"><input type="number" name="rent" defaultValue={a.unit.rent} className="input" /></Field>
                <Field label="Deposit (max 1 month)"><input type="number" name="deposit" defaultValue={a.unit.rent} max={a.unit.rent} className="input" /></Field>
                <Field label="Due day"><input type="number" name="dueDay" min={1} max={28} defaultValue={5} className="input" /></Field>
                <Field label="Late fee %"><input type="number" name="lateFeePct" min={0} max={50} defaultValue={0} className="input" title="Added once rent is 7+ days late. 0 = off" /></Field>
                <div className="col-span-2 sm:col-span-7"><Field label="Special terms for the tenancy agreement (optional)"><textarea name="specialTerms" rows={2} maxLength={3000} className="input" placeholder="e.g. No pets. Parking for one car included. Tenant maintains the garden." /></Field></div>
                <div className="flex items-end"><Submit className="btn-primary w-full">Approve & create lease</Submit></div>
              </form>
              <form action={decideApplication}>
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="reject" />
                <ConfirmSubmit message="Decline this application?" className="btn-outline">Decline</ConfirmSubmit>
              </form>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Leases with balances. `only` narrows to leases that owe anything, or that have overdue charges. */
export async function TenantsTable({ where, base, only }: { where: Prisma.LeaseWhereInput; base: string; only?: "owing" | "overdue" }) {
  const today = kampalaToday();
  const leases = await db.lease.findMany({
    where, orderBy: [{ status: "asc" }, { unit: { property: { name: "asc" } } }, { unit: { label: "asc" } }],
    include: {
      tenant: { select: { name: true, phone: true } }, landlord: { select: { name: true } },
      unit: { select: { label: true, property: { select: { name: true } } } },
      charges: { where: { status: { not: "paid" } }, select: { amount: true, paid: true, dueDate: true } },
    },
  });
  const rows = leases.map((l) => ({
    l,
    owed: l.charges.reduce((s, c) => s + c.amount - c.paid, 0),
    overdue: l.charges.filter((c) => ymd(c.dueDate) < today).reduce((s, c) => s + c.amount - c.paid, 0),
  })).filter((r) => (only === "owing" ? r.owed > 0 : only === "overdue" ? r.overdue > 0 : true));
  if (!rows.length) return <Empty title={only ? "Nobody owes anything right now" : "No tenants yet"}>{only ? undefined : "Approve an application to create a lease."}</Empty>;
  return (
    <>
    <div className="card divide-y divide-stone-100 p-0 lg:hidden">
      {rows.map(({ l, owed, overdue }) => (
        <Link key={l.id} href={`${base}/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
          <Avatar name={l.tenant.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-800">{l.tenant.name}</div>
            <div className="truncate text-xs text-stone-500">{l.unit.property.name} · {l.unit.label} · {ugx(l.rent)}/mo</div>
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${overdue > 0 ? "text-maroon-600" : owed > 0 ? "text-stone-800" : "text-brand-700"}`}>{ugx(owed)}</div>
            {overdue > 0 ? <Badge>overdue</Badge> : <Badge>{l.status}</Badge>}
          </div>
        </Link>
      ))}
    </div>
    <div className="card hidden overflow-x-auto p-0 lg:block">
      <table className="table">
        <thead><tr><th>Tenant</th><th>Unit</th><th>Rent</th><th>Lease</th><th className="text-right">Overdue</th><th className="text-right">Balance</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(({ l, owed, overdue }) => (
            <tr key={l.id}>
              <td><Link href={`${base}/${l.id}`} className="link">{l.tenant.name}</Link><div className="text-xs text-stone-500">{l.tenant.phone}</div></td>
              <td>{l.unit.property.name} · {l.unit.label}<div className="text-xs text-stone-500">{l.landlord.name}</div></td>
              <td>{ugx(l.rent)}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
              <td className={`text-right ${overdue > 0 ? "font-semibold text-maroon-600" : ""}`}>{ugx(overdue)}</td>
              <td className="text-right">{ugx(owed)}</td>
              <td><Badge>{l.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}

export async function LeaseDetail({ id, viewer, base }: { id: number; viewer: User; base: string }) {
  const l = await db.lease.findUnique({
    where: { id },
    include: { tenant: { select: { name: true, phone: true, email: true } }, unit: { select: { label: true, bedrooms: true, property: { select: { name: true, location: true, locationId: true } } } } },
  });
  if (!l || (viewer.role !== "manager" && l.landlordId !== viewer.id)) notFound();
  if (l.status === "active") await ensureCharges(l);
  const active = l.status === "active";
  return (
    <div>
      <Link href={base} className="link hidden text-sm lg:inline">← Tenants</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{l.tenant.name}</h1>
          <div className="muted break-words">{l.unit.property.name} · {l.unit.label} · <a href={`tel:${l.tenant.phone}`} className="hover:underline">{l.tenant.phone}</a> · {l.tenant.email}</div>
        </div>
        <Badge>{l.status}</Badge>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-5 lg:col-span-2">
          <Ledger leaseId={id} manage recordCash={<><CashForm l={l} />{active && <ChargeForm leaseId={l.id} />}</>} />
        </div>
        <div className="space-y-5">
          <LeaseFacts l={l} />
          <AgreementCard l={l} />
          <TenantScoreCard tenantId={l.tenantId} />
          {active && <RenewForm l={l} location={l.unit.property} bedrooms={l.unit.bedrooms} />}
          <InspectionsCard leaseId={l.id} viewer={viewer} manage />
          {active && <MoveOutForm l={l} moveOut={await db.inspection.findFirst({ where: { leaseId: l.id, kind: "move_out" }, select: { status: true, deductions: true } })} />}
          <Documents leaseId={id} viewerId={viewer.id} />
        </div>
      </div>
    </div>
  );
}

/** Headline numbers for one landlord, or for everyone when landlordId is omitted. */
export async function portfolioStats(landlordId?: number) {
  const today = kampalaToday();
  const month = today.slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00+03:00`);
  const byProp: Prisma.UnitWhereInput = { property: { archivedAt: null, ...(landlordId ? { landlordId } : {}) } };
  const byLease: Prisma.LeaseWhereInput = landlordId ? { landlordId } : {};
  const [units, occupied, properties, collected, overdueCharges, dueMonth] = await Promise.all([
    db.unit.count({ where: byProp }),
    db.unit.count({ where: { ...byProp, status: "occupied" } }),
    db.property.count({ where: { archivedAt: null, ...(landlordId ? { landlordId } : {}) } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "success", paidAt: { gte: monthStart }, lease: byLease } }),
    db.charge.findMany({ where: { status: { not: "paid" }, dueDate: { lt: new Date(`${today}T00:00:00Z`) }, lease: byLease }, select: { amount: true, paid: true } }),
    db.charge.aggregate({ _sum: { amount: true }, where: { period: month, lease: byLease } }),
  ]);
  return {
    units, occupied, properties,
    collected: collected._sum.amount ?? 0,
    arrears: overdueCharges.reduce((s, c) => s + c.amount - c.paid, 0),
    due_month: dueMonth._sum.amount ?? 0,
  };
}
