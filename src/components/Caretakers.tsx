import Link from "next/link";
import { CheckCircle2, ClipboardCheck, MessageCircle, Phone, Receipt, UserCog, Wallet, Wrench, Zap } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { caretakerPropertyIds } from "@/lib/access";
import { leaseBalance } from "@/lib/billing";
import { Avatar, Badge, Empty, Field, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { CashForm } from "./LeaseTools";
import { JobList, jobsFor } from "./Jobs";
import { addCaretaker, caretakerJob, updateCaretaker } from "@/app/caretaker-actions";

/** Landlord's page: who looks after which property, what they may do, and adding someone new. */
export async function CaretakerAdmin({ landlordId }: { landlordId: number }) {
  const [props, rows] = await Promise.all([
    db.property.findMany({ where: { landlordId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.caretakerAssignment.findMany({ where: { landlordId }, orderBy: [{ caretakerId: "asc" }], include: { caretaker: { select: { name: true, phone: true, phoneVerifiedAt: true, passwordHash: true } }, property: { select: { name: true } } } }),
  ]);
  const people = [...new Map(rows.map((r) => [r.caretakerId, r.caretaker])).entries()];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Caretakers" subtitle="The person on the ground: they can record cash, report repairs, do inspections and read meters — but never see your statements." />
      {people.length ? (
        <div className="space-y-3">
          {people.map(([cid, c]) => (
            <div key={cid} className="card space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-brand-950">{c.name}</div>
                  <a href={`tel:${c.phone}`} className="text-xs text-stone-500 hover:underline">{c.phone}</a>
                </div>
              </div>
              {(
                <a className="link text-xs" href={`https://wa.me/${c.phone.replace("+", "")}?text=${encodeURIComponent(`Hello ${c.name.split(" ")[0]}, I've added you as caretaker on CasaVilla. Sign in at ${process.env.APP_URL || "https://casavilla-production.up.railway.app"}/login with your phone number and the password I gave you.`)}`}>
                  Send them how to sign in (opens WhatsApp) →
                </a>
              )}
              {rows.filter((r) => r.caretakerId === cid).map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-stone-50 px-3 py-2 text-sm">
                  <form action={updateCaretaker} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1">
                    <input type="hidden" name="id" value={r.id} />
                    <span className="min-w-0 flex-1 font-medium">{r.property.name}</span>
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="canCollect" defaultChecked={r.canCollect} className="accent-brand-700" /> Record cash</label>
                    <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="canSeeBalances" defaultChecked={r.canSeeBalances} className="accent-brand-700" /> See who owes</label>
                    <Submit className="btn-ghost btn-sm">Save</Submit>
                  </form>
                  <form action={updateCaretaker}>
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="remove" value="1" />
                    <ConfirmSubmit message={`Remove ${c.name} from ${r.property.name}?`} className="btn-ghost btn-sm text-maroon-600">Remove</ConfirmSubmit>
                  </form>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : <Empty title="No caretakers yet">Add the person who looks after your building below.</Empty>}

      {props.length > 0 ? (
        <form action={addCaretaker} className="card mt-6 space-y-3">
          <div className="flex items-center gap-2 font-semibold text-brand-950"><UserCog className="h-4 w-4 text-brand-700" /> Add a caretaker</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Field label="Name"><input name="name" required maxLength={80} className="input" placeholder="e.g. Ssemakula John" /></Field>
            <Field label="Phone"><input name="phone" required inputMode="tel" className="input" placeholder="0772 123 456" /></Field>
          </div>
          <div>
            <div className="label">Looks after</div>
            <div className="flex flex-wrap gap-1.5">
              {props.map((p) => (
                <label key={p.id} className="chip cursor-pointer has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800">
                  <input type="checkbox" name="propertyId" value={p.id} defaultChecked={props.length === 1} className="sr-only" />{p.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-stone-700">
            <label className="flex items-center gap-2"><input type="checkbox" name="canCollect" defaultChecked className="h-4 w-4 accent-brand-700" /> May record cash rent</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="canSeeBalances" defaultChecked className="h-4 w-4 accent-brand-700" /> May see who owes</label>
          </div>
          <Field label="First password for them"><input name="tempPassword" type="text" required minLength={8} maxLength={60} autoComplete="off" className="input" placeholder="At least 8 characters" /></Field>
          <p className="text-[11px] text-stone-500">Give them this password; they sign in with their phone number and it. Every payment they record is sent to you straight away.</p>
          <Submit className="btn-primary btn-sm">Add caretaker</Submit>
        </form>
      ) : <p className="mt-6 text-sm text-stone-500">Add a property first.</p>}
    </div>
  );
}

async function scope(u: User) {
  const as = await db.caretakerAssignment.findMany({ where: { caretakerId: u.id }, include: { property: { select: { id: true, name: true, location: true, landlord: { select: { name: true, phone: true } } } } } });
  return as;
}

/** Caretaker home: what needs doing today across the buildings they look after. */
export async function CaretakerHome({ viewer }: { viewer: User }) {
  const as = await scope(viewer);
  if (!as.length) return <Empty title="No properties yet">Your landlord hasn&apos;t assigned you a property yet.</Empty>;
  const ids = as.map((a) => a.propertyId);
  const balanceIds = as.filter((a) => a.canSeeBalances).map((a) => a.propertyId);
  const monthStart = new Date(`${kampalaToday().slice(0, 7)}-01T00:00:00Z`);
  const [overdue, jobs, drafts, toRead] = await Promise.all([
    balanceIds.length ? db.charge.findMany({
      where: { status: { not: "paid" }, dueDate: { lt: new Date() }, kind: { not: "deposit" }, lease: { status: "active", unit: { propertyId: { in: balanceIds } } } },
      include: { lease: { select: { id: true, tenant: { select: { name: true, phone: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } } },
      orderBy: { dueDate: "asc" },
    }) : [],
    db.job.count({ where: { propertyId: { in: ids }, status: { notIn: ["done", "cancelled"] } } }),
    db.inspection.count({ where: { status: "draft", unit: { propertyId: { in: ids } } } }),
    // Meters with no reading yet this month (sub-meter bills depend on these).
    db.meter.count({ where: { active: true, propertyId: { in: ids }, readings: { none: { readOn: { gte: monthStart } } } } }),
  ]);
  const owing = new Map<number, { name: string; phone: string; where: string; owed: number }>();
  for (const c of overdue) {
    const o = owing.get(c.lease.id) ?? { name: c.lease.tenant.name, phone: c.lease.tenant.phone, where: `${c.lease.unit.property.name} · ${c.lease.unit.label}`, owed: 0 };
    o.owed += c.amount - c.paid; owing.set(c.lease.id, o);
  }
  const tiles = [
    { href: "/caretaker/rent", label: "Record cash", icon: Wallet, show: as.some((a) => a.canCollect) },
    { href: "/caretaker/repairs#new", label: "Report repair", icon: Wrench, show: true },
    { href: "/caretaker/meters", label: "Read meters", icon: Zap, show: true },
    { href: "/caretaker/inspections", label: "Inspection", icon: ClipboardCheck, show: true },
    { href: "/caretaker/expenses", label: "Add expense", icon: Receipt, show: true },
  ].filter((t) => t.show);
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" });
  const owedTotal = [...owing.values()].reduce((t, o) => t + o.owed, 0);
  const tel = (p: string) => p.replace(/\D/g, "");
  const landlords = [...new Map(as.map((a) => [a.property.landlord.phone, a.property.landlord])).values()];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Today at a glance */}
      <div className="rounded-3xl bg-brand-900 p-5 text-white shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">{today}</div>
        <div className="mt-1 text-xl font-bold">Hello {viewer.name.split(" ")[0]}</div>
        <div className="truncate text-sm text-white/70">{as.map((a) => a.property.name).join(" · ")}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {([["/caretaker/repairs", jobs, "Open repairs", false], ["/caretaker/meters", toRead, "Meters to read", toRead > 0], ["/caretaker/inspections", drafts, "Unfinished inspections", drafts > 0]] as const).map(([href, n, label, warn]) => (
            <Link key={href} href={href} className="rounded-2xl bg-white/5 px-2 py-3 transition hover:bg-white/10">
              <div className={`text-xl font-bold ${warn ? "text-gold-300" : ""}`}>{n}</div>
              <div className="text-[10px] leading-tight text-white/60">{label}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/70 bg-white p-3 text-center text-[11px] font-semibold text-brand-950 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><t.icon className="h-5 w-5" /></span>{t.label}
          </Link>
        ))}
      </div>

      {balanceIds.length > 0 && (
        <div className="card p-0">
          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <div className="font-semibold text-brand-950">Behind on rent</div>
            {owedTotal > 0 && <span className="text-sm font-bold text-maroon-600">{ugx(owedTotal)}</span>}
          </div>
          {owing.size ? (
            <div className="divide-y divide-stone-100 border-t border-stone-100">
              {[...owing.entries()].sort((a, b) => b[1].owed - a[1].owed).map(([lid, o]) => (
                <div key={lid} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Avatar name={o.name} className="h-9 w-9 text-xs" />
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{o.name}</div><div className="truncate text-xs text-stone-500">{o.where}</div></div>
                  <span className="font-semibold text-maroon-600">{ugx(o.owed)}</span>
                  <a href={`tel:+${tel(o.phone)}`} aria-label={`Call ${o.name}`} className="btn-outline btn-sm px-2.5"><Phone className="h-4 w-4" /></a>
                  <a href={`https://wa.me/${tel(o.phone)}`} aria-label={`WhatsApp ${o.name}`} className="btn-outline btn-sm hidden px-2.5 sm:inline-flex"><MessageCircle className="h-4 w-4" /></a>
                </div>
              ))}
            </div>
          ) : <p className="flex items-center gap-2 px-4 pb-4 text-sm text-brand-700"><CheckCircle2 className="h-4 w-4" /> Everyone is up to date.</p>}
        </div>
      )}

      {landlords.map((l) => (
        <div key={l.phone} className="card flex items-center gap-3 p-4">
          <Avatar name={l.name} className="h-10 w-10 text-xs" />
          <div className="min-w-0 flex-1"><div className="text-[11px] text-stone-500">Landlord</div><div className="truncate text-sm font-semibold text-brand-950">{l.name}</div></div>
          <a href={`tel:+${tel(l.phone)}`} aria-label={`Call ${l.name}`} className="btn-outline btn-sm px-2.5"><Phone className="h-4 w-4" /></a>
          <a href={`https://wa.me/${tel(l.phone)}`} aria-label={`WhatsApp ${l.name}`} className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>
        </div>
      ))}
    </div>
  );
}

/** Tenants on the caretaker's buildings, with balances (if allowed) and the cash form (if allowed). */
export async function CaretakerRent({ viewer }: { viewer: User }) {
  const as = await scope(viewer);
  const leases = await db.lease.findMany({
    where: { status: "active", unit: { propertyId: { in: as.map((a) => a.propertyId) } } },
    orderBy: [{ unit: { property: { name: "asc" } } }, { unit: { label: "asc" } }],
    include: { tenant: { select: { name: true, phone: true } }, unit: { select: { label: true, propertyId: true, property: { select: { name: true } } } } },
  });
  const rule = new Map(as.map((a) => [a.propertyId, a]));
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <PageHeader title="Rent & cash" subtitle="Record cash you collect — the tenant gets a receipt and the landlord is told straight away." />
      {!leases.length && <Empty title="No tenants yet" />}
      {await Promise.all(leases.map(async (l) => {
        const a = rule.get(l.unit.propertyId)!;
        const owed = a.canSeeBalances ? await leaseBalance(l.id) : null;
        return (
          <details key={l.id} className="card group p-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><div className="truncate font-medium text-stone-900">{l.tenant.name}</div><div className="truncate text-xs text-stone-500">{l.unit.property.name} · {l.unit.label} · rent {ugx(l.rent)} due day {l.dueDay}</div></div>
              {owed != null && <span className={`text-sm font-semibold ${owed > 0 ? "text-maroon-600" : "text-brand-700"}`}>{owed > 0 ? ugx(owed) : "Paid up"}</span>}
            </summary>
            <div className="space-y-2 border-t border-stone-100 p-3">
              <a href={`tel:${l.tenant.phone}`} className="link text-sm">Call {l.tenant.phone}</a>
              {a.canCollect ? <CashForm l={l} /> : <p className="text-xs text-stone-500">Your landlord hasn&apos;t allowed you to record payments here.</p>}
            </div>
          </details>
        );
      }))}
    </div>
  );
}

export async function CaretakerRepairs({ viewer }: { viewer: User }) {
  const ids = await caretakerPropertyIds(viewer.id);
  const props = await db.property.findMany({ where: { id: { in: ids } }, orderBy: { name: "asc" }, select: { id: true, name: true, units: { orderBy: { label: "asc" }, select: { id: true, label: true } } } });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Repairs" subtitle="Report problems on site. Your landlord and CasaVilla are told, and a provider is found." />
      <a href="#new" className="flex items-center gap-4 rounded-3xl bg-brand-900 p-4 text-white shadow-card transition hover:bg-brand-950">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><Wrench className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className="block font-semibold">Report a repair</span><span className="block text-xs text-white/70">Take a photo on site. It goes straight to the landlord.</span></span>
      </a>
      <JobList where={jobsFor.caretaker(ids)} base="/caretaker/repairs" empty="No repairs reported" />
      <form id="new" action={caretakerJob} encType="multipart/form-data" className="card scroll-mt-20 space-y-2.5">
        <div className="font-semibold text-brand-950">Report a repair</div>
        <Field label="Where">
          <select name="unitId" className="input" defaultValue="">
            <option value="">Whole building / common area</option>
            {props.map((p) => <optgroup key={p.id} label={p.name}>{p.units.map((u) => <option key={u.id} value={u.id}>{p.name} · {u.label}</option>)}</optgroup>)}
          </select>
        </Field>
        {props.length > 1
          ? <Field label="Property"><select name="propertyId" className="input">{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          : <input type="hidden" name="propertyId" value={props[0]?.id ?? ""} />}
        <Field label="What's wrong"><input name="title" required maxLength={120} className="input" placeholder="e.g. Water tank leaking" /></Field>
        <Field label="Details"><textarea name="description" required rows={3} maxLength={3000} className="input" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="How urgent"><select name="priority" defaultValue="normal" className="input"><option value="low">Can wait</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select></Field>
          <Field label="Photo"><input name="photo" type="file" accept="image/*" capture="environment" className="input py-2 text-sm" /></Field>
        </div>
        <Submit className="btn-primary btn-sm">Report</Submit>
      </form>
    </div>
  );
}

export async function CaretakerExpenses({ viewer }: { viewer: User }) {
  const { ExpenseForm } = await import("./Statements");
  const ids = await caretakerPropertyIds(viewer.id);
  const mine = await db.expense.findMany({ where: { createdById: viewer.id }, orderBy: { createdAt: "desc" }, take: 40, include: { property: { select: { name: true } } } });
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Expenses" subtitle="Money you spent on the building. The landlord approves each one." />
      {ids.length > 0 && <ExpenseForm propertyIds={ids} />}
      <div className="card divide-y divide-stone-100 p-0">
        {mine.map((e) => (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1"><div className="truncate font-medium">{e.description}</div><div className="truncate text-xs text-stone-500">{e.property?.name} · {e.category} · {fmtDate(e.spentOn)}</div></div>
            <span className="font-semibold">{ugx(e.amount)}</span>
            <Badge color={e.status === "approved" ? "green" : e.status === "rejected" ? "red" : "gold"}>{e.status}</Badge>
          </div>
        ))}
        {!mine.length && <div className="px-4 py-6 text-center text-sm text-stone-500">Nothing yet.</div>}
      </div>
    </div>
  );
}
