import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma, Property } from "@prisma/client";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Avatar, Badge, Empty, Field, Photo } from "./ui";
import { Submit, ConfirmSubmit } from "./client";
import { Documents } from "./Documents";
import { Ledger } from "./Ledger";
import { saveProperty, addUnit, updateUnit, decideApplication, recordCashPayment, endLease } from "@/app/landlord/actions";

export const PROPERTY_TYPES = ["Apartments", "Standalone house", "Rentals (row houses)", "Commercial / shops", "Hostel", "Office"];

export function PropertyForm({ p, landlords }: { p?: Property; landlords?: { id: number; name: string }[] }) {
  return (
    <form action={saveProperty} className="card space-y-4">
      {p && <input type="hidden" name="id" value={p.id} />}
      {landlords && !p && (
        <Field label="Landlord">
          <select name="landlordId" className="input" required>{landlords.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Property name"><input name="name" defaultValue={p?.name} className="input" required placeholder="e.g. Rubaga Court" /></Field>
        <Field label="Type">
          <select name="type" defaultValue={p?.type} className="input">{PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </Field>
      </div>
      <Field label="Location"><input name="location" defaultValue={p?.location} className="input" required placeholder="e.g. Rubaga Road, Kampala" /></Field>
      <Field label="Description"><textarea name="description" defaultValue={p?.description ?? ""} rows={3} className="input" placeholder="Water, power, parking, security, nearby…" /></Field>
      <Field label={p?.photoId ? "Replace photo" : "Photo"}><input type="file" name="photo" accept="image/*" className="input py-1.5" /></Field>
      <Submit>{p ? "Save changes" : "Add property"}</Submit>
    </form>
  );
}

export async function PropertyList({ where, base }: { where: Prisma.PropertyWhereInput; base: string }) {
  const rows = await db.property.findMany({
    where, orderBy: { createdAt: "desc" },
    include: { landlord: { select: { name: true } }, units: { select: { status: true } } },
  });
  if (!rows.length) return <Empty title="No properties yet">Add your first property, then its units.</Empty>;
  return (
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
  );
}

export async function PropertyDetail({ id, viewer, base }: { id: number; viewer: User; base: string }) {
  const p = await db.property.findUnique({
    where: { id },
    include: { units: { orderBy: { label: "asc" }, include: { leases: { where: { status: "active" }, include: { tenant: { select: { name: true } } } } } } },
  });
  if (!p || (viewer.role !== "manager" && p.landlordId !== viewer.id)) notFound();
  const tenantsBase = base.replace("/properties", "/tenants");
  return (
    <div>
      <Link href={base} className="link text-sm">← Properties</Link>
      <div className="mt-3 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="card overflow-hidden p-0">
            <Photo id={p.photoId} alt={p.name} className="h-36 w-full" />
            <div className="p-4 pb-2"><div className="text-xl font-bold text-brand-950">{p.name}</div><div className="muted">{p.location} · {p.type}</div></div>
            <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Units</div>
            <div className="divide-y divide-stone-100">
              {p.units.map((u) => {
                const lease = u.leases[0];
                return (
                  <div key={u.id} className="px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                      {lease ? <Link href={`${tenantsBase}/${lease.id}`} className="link truncate">{lease.tenant.name}</Link> : <Badge>{u.status}</Badge>}
                      {u.status === "vacant" && u.listed && <Link href={`/listings/${u.id}`} className="text-xs text-stone-500 hover:underline">View listing</Link>}
                    </div>
                    <form action={updateUnit} className="grid grid-cols-[1.3fr_0.7fr_1.2fr] items-end gap-2 sm:grid-cols-[1.3fr_0.6fr_1fr_auto_auto]">
                      <input type="hidden" name="id" value={u.id} />
                      <label className="min-w-0"><span className="label">Unit</span><input name="label" defaultValue={u.label} className="input py-2" /></label>
                      <label className="min-w-0"><span className="label">Beds</span><input name="bedrooms" type="number" min={0} defaultValue={u.bedrooms} className="input py-2" /></label>
                      <label className="min-w-0"><span className="label">Rent (UGX)</span><input name="rent" type="number" min={0} defaultValue={u.rent} className="input py-2" /></label>
                      <label className="col-span-2 flex items-center gap-2 py-2 text-sm text-stone-600 sm:col-span-1"><input name="listed" type="checkbox" defaultChecked={u.listed} className="h-4 w-4 accent-brand-700" disabled={u.status === "occupied"} /> Listed</label>
                      <Submit className="btn-outline btn-sm py-2">Save</Submit>
                    </form>
                  </div>
                );
              })}
              {p.units.length === 0 && <div className="px-4 py-3 text-sm text-stone-500">No units yet — add them below.</div>}
            </div>
            <form action={addUnit} className="grid grid-cols-2 gap-2 border-t border-stone-100 bg-stone-50/50 p-4 sm:grid-cols-6">
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-500 sm:col-span-6">Add units</div>
              <input type="hidden" name="propertyId" value={p.id} />
              <input name="label" className="input col-span-2" placeholder="Unit name, e.g. Apt A1" required />
              <label className="min-w-0"><span className="label">Beds</span><input name="bedrooms" type="number" min={0} className="input" defaultValue={1} /></label>
              <label className="min-w-0"><span className="label">Rent (UGX)</span><input name="rent" type="number" min={0} className="input" placeholder="e.g. 800000" required /></label>
              <label className="min-w-0"><span className="label">How many</span><input name="count" type="number" min={1} max={50} className="input" defaultValue={1} title="Add several identical units at once" /></label>
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-stone-600"><input type="checkbox" name="listed" defaultChecked className="h-4 w-4 accent-brand-700" /> List publicly</label>
              <div className="col-span-2 sm:col-span-6"><Submit className="btn-primary btn-sm">Add unit(s)</Submit></div>
            </form>
          </div>
          <Documents propertyId={p.id} viewerId={viewer.id} />
        </div>
        <div><PropertyForm p={p} /></div>
      </div>
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
            </div>
            <Badge>{a.status}</Badge>
          </div>
          {a.status === "pending" && (
            <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-stone-100 pt-4">
              <form action={decideApplication} className="grid flex-1 gap-2 sm:grid-cols-6">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="decision" value="approve" />
                <Field label="Start"><input type="date" name="startDate" defaultValue={a.moveIn ? ymd(a.moveIn) : today} className="input" required /></Field>
                <Field label="End"><input type="date" name="endDate" defaultValue={nextYear} className="input" required /></Field>
                <Field label="Rent / month"><input type="number" name="rent" defaultValue={a.unit.rent} className="input" /></Field>
                <Field label="Deposit"><input type="number" name="deposit" defaultValue={a.unit.rent} className="input" /></Field>
                <Field label="Due day"><input type="number" name="dueDay" min={1} max={28} defaultValue={5} className="input" /></Field>
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
    include: { tenant: { select: { name: true, phone: true, email: true } }, unit: { select: { label: true, property: { select: { name: true } } } } },
  });
  if (!l || (viewer.role !== "manager" && l.landlordId !== viewer.id)) notFound();
  const open = await db.charge.findMany({ where: { leaseId: id, status: { not: "paid" } }, orderBy: { dueDate: "asc" } });
  const cash = l.status === "active" && open.length > 0 && (
    <form action={recordCashPayment} className="card grid gap-2 sm:grid-cols-5">
      <div className="h2 sm:col-span-5">Record a cash or bank payment</div>
      <select name="chargeId" className="input sm:col-span-2">{open.map((c) => <option key={c.id} value={c.id}>{c.description} — owes {ugx(c.amount - c.paid)}</option>)}</select>
      <input name="amount" type="number" min={1} className="input" placeholder="Amount" required />
      <select name="method" className="input"><option value="cash">Cash</option><option value="bank">Bank</option></select>
      <input name="reference" className="input" placeholder="Ref (optional)" />
      <div className="sm:col-span-5"><Submit className="btn-outline btn-sm">Record & issue receipt</Submit></div>
    </form>
  );
  return (
    <div>
      <Link href={base} className="link text-sm">← Tenants</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{l.tenant.name}</h1>
          <div className="muted">{l.unit.property.name} · {l.unit.label} · {l.tenant.phone} · {l.tenant.email}</div>
        </div>
        <Badge>{l.status}</Badge>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2"><Ledger leaseId={id} recordCash={cash} /></div>
        <div className="space-y-6">
          <div className="card space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">Lease</span><span>{fmtDate(l.startDate)} – {fmtDate(l.endDate)}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Rent</span><span>{ugx(l.rent)} / month</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Due day</span><span>{l.dueDay}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Deposit</span><span>{ugx(l.deposit)}</span></div>
            {l.status === "active" && (
              <form action={endLease} className="space-y-2 border-t border-stone-100 pt-3">
                <input type="hidden" name="id" value={l.id} />
                <label className="flex items-center gap-2"><input type="checkbox" name="relist" defaultChecked className="accent-brand-500" /> Re-list the unit as vacant</label>
                <ConfirmSubmit message="End this lease? The tenant will be notified." className="btn-outline btn-sm w-full text-maroon-600">End lease / move out</ConfirmSubmit>
              </form>
            )}
          </div>
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
  const byProp: Prisma.UnitWhereInput = landlordId ? { property: { landlordId } } : {};
  const byLease: Prisma.LeaseWhereInput = landlordId ? { landlordId } : {};
  const [units, occupied, properties, collected, overdueCharges, dueMonth] = await Promise.all([
    db.unit.count({ where: byProp }),
    db.unit.count({ where: { ...byProp, status: "occupied" } }),
    db.property.count({ where: landlordId ? { landlordId } : {} }),
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
