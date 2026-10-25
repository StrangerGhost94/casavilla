import Link from "next/link";
import { AlertCircle, CalendarClock, CalendarDays, CheckCircle2, ClipboardList, FileText, MessageCircle, Phone, Search, ShoppingBag, Wallet, Wrench } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Avatar, Badge, Photo, SectionTitle } from "@/components/ui";
import { chargesSummary } from "@/components/Ledger";
import { CategoryIcon } from "@/lib/icons";
import { activeLease } from "./lib";
import { ConnectLandlordCard } from "@/components/Links";
import { chargeLabel, payLabel } from "@/lib/rules";
import { EfrisBadge } from "@/components/Efris";
import { PushToggle } from "@/components/PushToggle";
import { pushPublicKey } from "@/lib/push";

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const shortcuts = [
  { href: "/tenant/rent", label: "Rent & receipts", icon: Wallet },
  { href: "/tenant/requests", label: "Repairs", icon: Wrench },
  { href: "/tenant/lease", label: "Lease", icon: FileText },
  { href: "/tenant/applications", label: "Applications", icon: ClipboardList },
  { href: "/tenant/stays", label: "Bookings", icon: CalendarDays },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
];

function FindHome() {
  return (
    <>
      <SectionTitle title="Find your next home" href="/listings" cta="Browse" />
      <form action="/listings" className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
        <input name="q" className="input pl-11" placeholder="Search location, property or neighbourhood" />
      </form>
    </>
  );
}

export default async function TenantHome() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  const job = await db.job.findFirst({
    where: { requesterId: u.id, status: { notIn: ["done", "cancelled"] } }, orderBy: { updatedAt: "desc" },
    include: { provider: { select: { name: true, businessName: true } } },
  });
  const apps = await db.application.count({ where: { tenantId: u.id, status: "pending" } });

  if (!lease) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl bg-brand-900 p-5 text-white shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">My home</div>
          <div className="mt-1 text-xl font-bold">Let&apos;s find your next home</div>
          <p className="mt-1 text-sm text-white/70">Browse vacant homes and apply in a minute. Once a landlord accepts, rent, receipts and repairs all live here.</p>
          {apps > 0 && <Link href="/tenant/applications" className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300"><ClipboardList className="h-3.5 w-3.5" /> {apps} application{apps > 1 ? "s" : ""} waiting for an answer</Link>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/listings" className="btn-gold"><Search className="h-4 w-4" /> Browse homes</Link>
            <Link href="/tenant/applications" className="btn border border-white/20 text-white hover:bg-white/10">Applications</Link>
          </div>
        </div>
        <ConnectLandlordCard tenantId={u.id} />
        <FindHome />
      </div>
    );
  }

  const { owed, next } = await chargesSummary(lease.l.id);
  const today = kampalaToday();
  const days = next ? daysBetween(today, ymd(next.dueDate)) : null;
  const payments = await db.payment.findMany({ where: { leaseId: lease.l.id, status: "success" }, orderBy: { paidAt: "desc" }, take: 3, include: { charge: { select: { kind: true, period: true } }, efris: { select: { id: true } } } });
  const efrisProf = await db.efrisProfile.findUnique({ where: { landlordId: lease.l.landlordId } });
  const efrisState = (p: (typeof payments)[number]) => (p.efris ? "done" : p.charge.kind !== "deposit" && efrisProf?.status === "registered" && p.paidAt && p.paidAt >= efrisProf.since ? "missing" : null);
  const leaseDays = daysBetween(today, ymd(lease.l.endDate));

  const start = ymd(lease.l.startDate), end = ymd(lease.l.endDate);
  const total = Math.max(1, daysBetween(start, end));
  const gone = Math.min(total, Math.max(0, daysBetween(start, today)));
  const late = owed > 0 && days !== null && days < 0;
  const phone = (lease.landlordPhone ?? "").replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-2xl">
      {/* My home: what I owe and when, with the one thing to do */}
      <div className="overflow-hidden rounded-3xl bg-brand-900 text-white shadow-card">
        <div className="flex items-center gap-3 p-4 pb-0">
          <Photo id={lease.l.unit.property.photoId} alt={lease.property} className="h-12 w-12 shrink-0 rounded-xl ring-2 ring-white/10" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold">{lease.property}</div>
            <div className="truncate text-xs text-white/60">Unit {lease.unit}</div>
          </div>
          <span className={`pill shrink-0 ${late ? "bg-maroon-500 text-white" : owed > 0 ? "bg-gold-400 text-brand-950" : "bg-white/10 text-gold-300"}`}>
            {late ? <><AlertCircle className="h-3.5 w-3.5" /> Overdue</> : owed > 0 ? <><CalendarClock className="h-3.5 w-3.5" /> Due soon</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Paid up</>}
          </span>
        </div>
        <div className="p-4">
          <div className="text-xs text-white/60">{owed > 0 ? "Balance due" : "Monthly rent"}</div>
          <div className="text-3xl font-bold tracking-tight">{ugx(owed > 0 ? owed : lease.l.rent)}</div>
          <div className={`mt-1 text-xs ${late ? "font-semibold text-maroon-100" : "text-white/70"}`}>
            {next && days !== null
              ? `${chargeLabel(next.kind, next.period)} · ${days < 0 ? `overdue by ${-days} day${days === -1 ? "" : "s"}` : days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`} (${fmtDate(next.dueDate)})`
              : "Nothing to pay right now. Thank you!"}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {next ? <Link href={`/tenant/pay/${next.id}`} className="btn-gold"><Wallet className="h-4 w-4" /> {payLabel(next.kind)}</Link> : <Link href="/tenant/rent" className="btn-gold"><Wallet className="h-4 w-4" /> Receipts</Link>}
            <Link href="/tenant/requests/new" className="btn border border-white/20 text-white hover:bg-white/10"><Wrench className="h-4 w-4" /> Report issue</Link>
          </div>
        </div>
        {/* Lease timeline */}
        <Link href="/tenant/lease" className="block border-t border-white/10 px-4 py-3 hover:bg-white/5">
          <div className="flex justify-between text-[11px] text-white/60"><span>Lease {fmtDate(lease.l.startDate)}</span><span>{leaseDays < 0 ? "Ended" : `${leaseDays} days left`} · {fmtDate(lease.l.endDate)}</span></div>
          <div className="mt-1.5 h-1.5 rounded-full bg-white/10"><div className={`h-1.5 rounded-full ${leaseDays <= 60 ? "bg-gold-400" : "bg-brand-300"}`} style={{ width: `${Math.round((gone / total) * 100)}%` }} /></div>
        </Link>
      </div>

      <div className="mt-3 empty:hidden"><PushToggle publicKey={pushPublicKey()} variant="card" /></div>

      {/* Lease end: a nudge two months ahead */}
      {leaseDays <= 60 && (
        <Link href="/tenant/lease" className={`mt-3 flex items-center gap-3 rounded-2xl border p-3.5 text-sm ${leaseDays < 0 ? "border-maroon-100 bg-maroon-50 text-maroon-700" : "border-gold-200 bg-gold-50/70 text-stone-700"}`}>
          <CalendarClock className="h-5 w-5 shrink-0 text-gold-600" />
          <span className="min-w-0 flex-1">{leaseDays < 0 ? <>Your lease ended on <b>{fmtDate(lease.l.endDate)}</b>. Talk to {lease.landlord} about renewing.</> : <>Your lease ends in <b>{leaseDays} day{leaseDays === 1 ? "" : "s"}</b>. Agree a renewal with {lease.landlord} in good time.</>}</span>
          <span className="shrink-0 text-xs font-semibold text-brand-700">Lease</span>
        </Link>
      )}

      {/* Shortcuts */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/70 bg-white py-3 text-[11px] font-medium text-stone-700 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><s.icon className="h-[18px] w-[18px]" /></span> {s.label}
          </Link>
        ))}
      </div>

      {/* Landlord, one tap away */}
      <div className="card mt-4 flex items-center gap-3 p-4">
        <Avatar name={lease.landlord} className="h-10 w-10 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-stone-500">Your landlord</div>
          <div className="truncate text-sm font-semibold text-brand-950">{lease.landlord}</div>
        </div>
        {phone && <a href={`tel:+${phone}`} aria-label={`Call ${lease.landlord}`} className="btn-outline btn-sm px-2.5"><Phone className="h-4 w-4" /></a>}
        {phone && <a href={`https://wa.me/${phone}`} aria-label={`WhatsApp ${lease.landlord}`} className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>}
      </div>

      {/* Maintenance update */}
      {job && (
        <Link href={`/tenant/requests/${job.id}`} className="card mt-4 flex items-start gap-3 p-4 hover:border-brand-200">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600"><CategoryIcon category={job.category} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-stone-500">Maintenance update</div>
            <div className="truncate text-sm font-semibold text-brand-950">{job.title}</div>
            <div className="text-xs text-stone-500">{job.provider ? `Assigned to ${job.provider.businessName || job.provider.name}` : "Waiting for a provider"}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge>{job.status}</Badge>
            <span className="text-xs font-semibold text-brand-700">View details</span>
          </div>
        </Link>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <>
          <SectionTitle title="Recent payments" href="/tenant/rent" />
          <div className="card divide-y divide-stone-100 p-0">
            {payments.map((p) => (
              <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-stone-50">
                <div>
                  <div className="font-medium text-stone-800">{chargeLabel(p.charge.kind, p.charge.period)}</div>
                  <div className="text-xs text-stone-500">{fmtDate(p.paidAt)} · {p.receiptNo}</div>
                  <div className="mt-0.5 empty:hidden"><EfrisBadge state={efrisState(p)} /></div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-stone-800">{ugx(p.amount)}</div>
                  <Badge>paid</Badge>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
