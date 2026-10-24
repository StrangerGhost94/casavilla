import Link from "next/link";
import { BadgeCheck, Check, ChevronDown, Plus, ShieldCheck } from "lucide-react";
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
import { saveProperty, addUnit, updateUnit, decideApplication, removeProperty, restoreProperty, removeUnit, verifyProperty } from "@/app/landlord/actions";
import { propertyRemoval } from "@/lib/removal";
import { AgreementCard, CashForm, ChargeForm, LeaseFacts, MoveOutForm, RenewForm, ScorePill, TenantScoreCard } from "./LeaseTools";
import { ensureCharges } from "@/lib/billing";
import { crumbText, trailFor } from "@/lib/geo";
import { marketRent, tenantScore } from "@/lib/insights";

import { PROPERTY_TYPES } from "@/lib/property-types";
import { fileUrl } from "@/lib/file-url";
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
      include: { landlord: { select: { name: true } }, units: { select: { status: true, rent: true, mode: true, listed: true } }, _count: { select: { photos: true } } },
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
  const units = rows.flatMap((p) => p.units);
  const occ = units.filter((u) => u.status === "occupied");
  const roll = occ.reduce((t, u) => t + (u.mode === "short" ? 0 : u.rent), 0);
  const vacant = units.length - occ.length;
  return (
    <>
    <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="card p-4"><div className="text-xl font-bold text-brand-950">{rows.length}</div><div className="text-xs text-stone-500">Propert{rows.length === 1 ? "y" : "ies"} · {units.length} units</div></div>
      <div className="card p-4"><div className="text-xl font-bold text-brand-950">{units.length ? Math.round((occ.length / units.length) * 100) : 0}%</div><div className="text-xs text-stone-500">Let · {occ.length} of {units.length}</div></div>
      <div className="card p-4"><div className={`text-xl font-bold ${vacant ? "text-gold-700" : "text-brand-950"}`}>{vacant}</div><div className="text-xs text-stone-500">Vacant unit{vacant === 1 ? "" : "s"}</div></div>
      <div className="card p-4"><div className="truncate text-base font-bold text-brand-950 sm:text-xl">{ugx(roll)}</div><div className="text-xs text-stone-500">Rent from let units / month</div></div>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((p) => {
        const total = p.units.length;
        const occupied = p.units.filter((u) => u.status === "occupied").length;
        const free = total - occupied;
        const listed = p.units.filter((u) => u.status === "vacant" && u.listed).length;
        const rent = p.units.filter((u) => u.status === "occupied" && u.mode !== "short").reduce((t, u) => t + u.rent, 0);
        return (
          <Link key={p.id} href={`${base}/${p.id}`} className="card group overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-float">
            <div className="relative h-40 overflow-hidden">
              <Photo id={p.photoId} alt={p.name} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.04]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              <span className={`pill absolute left-3 top-3 shadow-sm ${free ? "bg-gold-400 text-brand-950" : "bg-white/95 text-brand-800"}`}>{free ? `${free} vacant` : "Fully let"}</span>
              {p._count.photos > 0 && <span className="pill absolute bottom-3 right-3 bg-black/55 text-[11px] text-white">{p._count.photos} photo{p._count.photos === 1 ? "" : "s"}</span>}
              <div className="absolute bottom-3 left-3 right-16 truncate text-lg font-bold text-white drop-shadow">{p.name}</div>
            </div>
            <div className="p-4">
              <div className="truncate text-xs text-stone-500">{p.location} · {p.type}</div>
              {!p.locationId && <div className="mt-1 text-[11px] font-semibold text-gold-700">Location not verified</div>}
              <div className="mt-3 flex items-end justify-between gap-2">
                <div><div className="text-sm font-semibold text-stone-800">{occupied} of {total} let</div><div className="text-[11px] text-stone-500">{listed ? `${listed} listed for tenants` : free ? "Vacant units not listed" : p.landlord.name}</div></div>
                <div className="text-right"><div className="text-sm font-bold text-brand-800">{ugx(rent)}</div><div className="text-[11px] text-stone-500">/ month</div></div>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-stone-100"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${total ? (occupied / total) * 100 : 0}%` }} /></div>
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

          {!p.archivedAt && <ListingStrength p={p} photos={photos} base={base} editHref={editHref} />}

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
          {!p.archivedAt && <VerifyCard p={p} manager={viewer.role === "manager"} />}
          <PhotoSummary base={base} propertyId={p.id} photos={photos} units={p.units} />
          <Documents propertyId={p.id} viewerId={viewer.id} />
        </div>
      </div>
    </div>
  );
}

/** CasaVilla verification: a manager visits and checks ownership; only then do listings show "Verified". */
async function VerifyCard({ p, manager }: { p: Property; manager: boolean }) {
  if (p.verifiedAt) {
    const by = p.verifiedBy ? await db.user.findUnique({ where: { id: p.verifiedBy }, select: { name: true } }) : null;
    return (
      <div className="card flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BadgeCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-brand-950">Verified by CasaVilla</div>
          <div className="text-xs text-stone-500">{fmtDate(p.verifiedAt)}{by ? ` · ${by.name}` : ""}. Its listings show the Verified badge.</div>
          {manager && <form action={verifyProperty} className="mt-2"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="undo" value="1" /><ConfirmSubmit message="Remove the Verified badge from this property?" className="text-xs font-semibold text-maroon-600 hover:underline">Remove verification</ConfirmSubmit></form>}
        </div>
      </div>
    );
  }
  if (!manager) {
    const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, please visit ${p.name} (${p.location}) to verify it.`)}`;
    return (
      <div className="card flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-500"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-semibold text-brand-950">Not verified yet</div>
          <div className="text-xs text-stone-500">Verified homes get the badge buyers and tenants look for. CasaVilla visits, checks ownership and photos.</div>
          <a href={wa} className="link mt-1.5 inline-block text-xs">Ask CasaVilla to visit →</a>
        </div>
      </div>
    );
  }
  return (
    <form action={verifyProperty} className="card space-y-2.5 text-sm">
      <input type="hidden" name="id" value={p.id} />
      <div className="flex items-center gap-2 font-semibold text-brand-950"><ShieldCheck className="h-5 w-5 text-brand-700" /> Verify this property</div>
      {!p.locationId && <p className="text-xs text-gold-700">Confirm its location first (Edit).</p>}
      {[["visited", "I visited it and it matches the address"], ["owner", "I checked the landlord owns it or may let it"], ["photos", "The photos are of this property"]].map(([k, t]) => (
        <label key={k} className="flex items-start gap-2 text-stone-700"><input type="checkbox" name={k} required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" /> {t}</label>
      ))}
      <Submit className="btn-primary btn-sm">Mark as verified</Submit>
    </form>
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

/**
 * How complete the property looks to tenants, as a score with the next things to do, and a link to see the
 * public page. Mirrors what the listing pages show: photo count, rooms, description, map pin, features, badge.
 */
function ListingStrength({ p, photos, base, editHref }: {
  p: Property & { units: { id: number; label: string; bedrooms: number; bathrooms: number; status: string; listed: boolean; mode: string; amenities: string[] }[] };
  photos: { label: string; unitId: number | null }[]; base: string; editHref: string;
}) {
  const req = shotList(p.units, p.units.length > 1).filter((s) => s.required);
  const rooms = req.filter((s) => photos.some((x) => x.label.replace(/ · \d+$/, "") === s.label && x.unitId === s.unitId)).length;
  const open = p.units.filter((u) => u.status === "vacant" && u.listed);
  const featured = open.length > 0 && open.every((u) => u.amenities.length >= 3);
  const photosHref = `${base}/${p.id}/photos`;
  const checks: { ok: boolean; label: string; why: string; href?: string; cta: string }[] = [
    { ok: photos.length >= 5, label: "At least 5 photos", why: `${photos.length} so far. Listings with 5+ photos get the photo count and full gallery.`, href: photosHref, cta: "Add photos" },
    { ok: req.length > 0 && rooms === req.length, label: "Every must-have room photographed", why: `${rooms} of ${req.length} rooms covered.`, href: photosHref, cta: "See which" },
    { ok: (p.description ?? "").trim().length >= 80, label: "A good description", why: "Water, power, parking, security and what's nearby. A few lines is enough.", href: editHref, cta: "Write it" },
    { ok: p.lat != null, label: "Exact spot on the map", why: "Pinned homes show up in “Near me” searches.", href: editHref, cta: "Pin it" },
    { ok: featured, label: "Features ticked on vacant units", why: "Wi-Fi, parking, water tank… shown as a checklist to tenants. Open a unit below to tick them.", cta: "" },
    { ok: !!p.verifiedAt, label: "Verified by CasaVilla", why: "The Verified badge on every card. Ask us to visit below.", cta: "" },
  ];
  const score = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const preview = open[0];
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-stone-100" />
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score / 100) * 97.4} 97.4`} className={score >= 80 ? "stroke-brand-600" : score >= 50 ? "stroke-gold-500" : "stroke-maroon-500"} /></svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-brand-950">{score}%</span>
        </div>
        <div className="min-w-[10rem] flex-1">
          <div className="font-semibold text-brand-950">Listing strength</div>
          <div className="text-xs text-stone-500">{score === 100 ? "Looks great to tenants." : "Complete listings get more enquiries. Next steps below."}</div>
        </div>
        {preview && <Link href={preview.mode === "short" ? `/stays/${preview.id}` : `/listings/${preview.id}`} className="btn-outline btn-sm w-full sm:w-auto">See it as tenants do</Link>}
      </div>
      <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100">
        {[...checks].sort((a, b) => Number(a.ok) - Number(b.ok)).map((c) => (
          <li key={c.label} className="flex items-start gap-3 py-2.5">
            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-brand-600 text-white" : "border-2 border-stone-300"}`}>{c.ok && <Check className="h-3 w-3" />}</span>
            <div className="min-w-0 flex-1">
              <div className={`text-sm ${c.ok ? "text-stone-500 line-through decoration-stone-300" : "font-medium text-stone-800"}`}>{c.label}</div>
              {!c.ok && <div className="text-xs text-stone-500">{c.why}</div>}
            </div>
            {!c.ok && c.href && <Link href={c.href} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">{c.cta}</Link>}
          </li>
        ))}
      </ul>
      {!open.length && <p className="mt-2 text-[11px] text-stone-400">No vacant listed units right now, so nothing is showing to tenants.</p>}
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
            <img key={x.id} src={fileUrl(x.fileId, 320)} loading="lazy" alt={x.label} className="h-16 w-20 shrink-0 rounded-lg object-cover" />
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

/**
 * The tenants page: current tenants first; then former tenants who still owe (debts don't disappear when
 * someone moves out); then every past tenancy, folded away.
 */
export async function TenantsSections({ where, base, show }: { where: Prisma.LeaseWhereInput; base: string; show?: string }) {
  const pastWhere: Prisma.LeaseWhereInput = { ...where, status: { not: "active" } };
  const today = kampalaToday();
  const [pastOwing, pastCount, current] = await Promise.all([
    db.lease.count({ where: { ...pastWhere, charges: { some: { status: { not: "paid" } } } } }),
    db.lease.count({ where: pastWhere }),
    db.lease.findMany({ where: { ...where, status: "active" }, select: { rent: true, charges: { where: { status: { not: "paid" } }, select: { amount: true, paid: true, dueDate: true } } } }),
  ]);
  // One pass over current tenants for the summary and the filter counts.
  const sums = current.map((l) => ({
    owed: l.charges.reduce((t, c) => t + c.amount - c.paid, 0),
    overdue: l.charges.filter((c) => ymd(c.dueDate) < today).reduce((t, c) => t + c.amount - c.paid, 0),
  }));
  const n = { all: current.length, overdue: sums.filter((x) => x.overdue > 0).length, owing: sums.filter((x) => x.owed > 0).length, paid: sums.filter((x) => x.owed === 0).length };
  const overdueTotal = sums.reduce((t, x) => t + x.overdue, 0);
  const roll = current.reduce((t, l) => t + l.rent, 0);
  const only = show === "overdue" || show === "owing" || show === "paid" ? show : undefined;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4"><div className="text-xl font-bold text-brand-950">{n.all}</div><div className="text-xs text-stone-500">Current tenants</div></div>
        <div className="card p-4"><div className="truncate text-base font-bold text-brand-950 sm:text-xl">{ugx(roll)}</div><div className="text-xs text-stone-500">Rent per month</div></div>
        <Link href={`${base}?show=overdue`} className={`card p-4 transition hover:-translate-y-0.5 ${overdueTotal ? "border-maroon-100 bg-maroon-50/40" : ""}`}><div className={`truncate text-base font-bold sm:text-xl ${overdueTotal ? "text-maroon-600" : "text-brand-950"}`}>{ugx(overdueTotal)}</div><div className="text-xs text-stone-500">Overdue · {n.overdue} tenant{n.overdue === 1 ? "" : "s"}</div></Link>
        <Link href={`${base}?show=paid`} className="card p-4 transition hover:-translate-y-0.5"><div className="text-xl font-bold text-brand-700">{n.paid}</div><div className="text-xs text-stone-500">Paid up</div></Link>
      </div>
      <div className="-mx-4 my-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {([["", "All", n.all], ["overdue", "Overdue", n.overdue], ["owing", "Owing", n.owing], ["paid", "Paid up", n.paid]] as const).map(([k, label, c]) => (
          <Link key={label} href={k ? `${base}?show=${k}` : base} className={(only ?? "") === k ? "chip-active" : "chip"}>{label} <span className="opacity-60">{c}</span></Link>
        ))}
      </div>
      <TenantsTable where={{ ...where, status: "active" }} base={base} only={only} />
      {pastOwing > 0 && (
        <section id="former" className="scroll-mt-24">
          <h2 className="h2 mb-1 mt-8">Former tenants who still owe</h2>
          <p className="muted mb-3">They have moved out but left a balance. Open one to record a payment or settle it.</p>
          <TenantsTable where={pastWhere} base={base} only="owing" />
        </section>
      )}
      {pastCount > 0 && (
        <details className="mt-8">
          <summary className="cursor-pointer list-none text-sm font-semibold text-stone-600">Past tenancies ({pastCount})</summary>
          <div className="mt-3"><TenantsTable where={pastWhere} base={base} /></div>
        </details>
      )}
    </>
  );
}

/** Leases with balances. `only` narrows to leases that owe anything, or that have overdue charges. */
export async function TenantsTable({ where, base, only }: { where: Prisma.LeaseWhereInput; base: string; only?: "owing" | "overdue" | "paid" }) {
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
  })).filter((r) => (only === "owing" ? r.owed > 0 : only === "overdue" ? r.overdue > 0 : only === "paid" ? r.owed === 0 : true));
  if (!rows.length) return <Empty title={only === "paid" ? "Nobody is fully paid up yet" : only ? "Nobody owes anything right now" : "No current tenants"}>{only ? undefined : "Approve an application to create a lease."}</Empty>;
  const pill = (owed: number, overdue: number, status: string) =>
    status !== "active" ? <Badge>{status}</Badge>
      : overdue > 0 ? <span className="pill bg-maroon-50 text-maroon-600">Overdue</span>
      : owed > 0 ? <span className="pill bg-gold-50 text-gold-700">Due</span>
      : <span className="pill bg-brand-50 text-brand-700">Paid up</span>;
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
            {pill(owed, overdue, l.status)}
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
              <td><Link href={`${base}/${l.id}`} className="flex items-center gap-2.5"><Avatar name={l.tenant.name} className="h-8 w-8 text-[10px]" /><span><span className="link block">{l.tenant.name}</span><span className="block text-xs text-stone-500">{l.tenant.phone}</span></span></Link></td>
              <td>{l.unit.property.name} · {l.unit.label}<div className="text-xs text-stone-500">{l.landlord.name}</div></td>
              <td>{ugx(l.rent)}</td>
              <td className="whitespace-nowrap text-xs">{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</td>
              <td className={`text-right ${overdue > 0 ? "font-semibold text-maroon-600" : ""}`}>{ugx(overdue)}</td>
              <td className="text-right">{ugx(owed)}</td>
              <td>{pill(owed, overdue, l.status)}</td>
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

/**
 * Headline numbers for one landlord, or for everyone when landlordId is omitted. Everything about "due" and
 * "overdue" is for current tenants, so it matches the breakdowns (by age, by area, tenants list). What tenants
 * who have moved out still owe is counted separately (`pastArrears`) instead of being mixed in.
 */
export async function portfolioStats(landlordId?: number) {
  const today = kampalaToday();
  const month = today.slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00+03:00`);
  const byProp: Prisma.UnitWhereInput = { property: { archivedAt: null, ...(landlordId ? { landlordId } : {}) } };
  const byLease: Prisma.LeaseWhereInput = landlordId ? { landlordId } : {};
  const current: Prisma.LeaseWhereInput = { ...byLease, status: "active" };
  const past: Prisma.LeaseWhereInput = { ...byLease, status: { not: "active" } };
  const late = { status: { not: "paid" }, dueDate: { lt: new Date(`${today}T00:00:00Z`) } };
  const [units, occupied, properties, collected, overdueCharges, dueMonth, pastCharges] = await Promise.all([
    db.unit.count({ where: byProp }),
    db.unit.count({ where: { ...byProp, status: "occupied" } }),
    db.property.count({ where: { archivedAt: null, ...(landlordId ? { landlordId } : {}) } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { status: "success", paidAt: { gte: monthStart }, lease: byLease } }),
    db.charge.findMany({ where: { ...late, lease: current }, select: { amount: true, paid: true, leaseId: true } }),
    db.charge.aggregate({ _sum: { amount: true, paid: true }, where: { period: month, lease: current } }),
    db.charge.findMany({ where: { status: { not: "paid" }, lease: past }, select: { amount: true, paid: true, leaseId: true } }),
  ]);
  const sum = (cs: { amount: number; paid: number }[]) => cs.reduce((t, c) => t + c.amount - c.paid, 0);
  return {
    units, occupied, properties,
    collected: collected._sum.amount ?? 0,
    arrears: sum(overdueCharges),
    lateTenants: new Set(overdueCharges.map((c) => c.leaseId)).size,
    due_month: dueMonth._sum.amount ?? 0,
    left_month: (dueMonth._sum.amount ?? 0) - (dueMonth._sum.paid ?? 0),
    pastArrears: sum(pastCharges),
    pastTenants: new Set(pastCharges.map((c) => c.leaseId)).size,
  };
}
