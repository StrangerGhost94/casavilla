import Link from "next/link";
import { AlertCircle, CalendarClock, CheckCircle2, ClipboardList, FileText, Search, Wallet, Wrench } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Badge, Photo, SectionTitle } from "@/components/ui";
import { chargesSummary } from "@/components/Ledger";
import { CategoryIcon } from "@/lib/icons";
import { activeLease } from "./lib";
import { ConnectLandlordCard } from "@/components/Links";

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

const shortcuts = [
  { href: "/tenant/rent", label: "Rent", icon: Wallet },
  { href: "/tenant/requests", label: "Maintenance", icon: Wrench },
  { href: "/tenant/lease", label: "Lease", icon: FileText },
  { href: "/tenant/applications", label: "Applications", icon: ClipboardList },
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
        <div className="card">
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">My home</div>
          <div className="mt-2 text-lg font-semibold text-brand-950">You don&apos;t have an active lease yet</div>
          <p className="muted mt-1">Browse vacant homes and apply to the landlord you choose.{apps > 0 && ` ${apps} application${apps > 1 ? "s" : ""} waiting for an answer.`}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/listings" className="btn-primary">Browse homes</Link>
            <Link href="/tenant/applications" className="btn-outline">Applications</Link>
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
  const payments = await db.payment.findMany({ where: { leaseId: lease.l.id, status: "success" }, orderBy: { paidAt: "desc" }, take: 3 });

  return (
    <div className="mx-auto max-w-2xl">
      {/* My Home */}
      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Photo id={lease.l.unit.property.photoId} alt={lease.property} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">My home</div>
              <div className="truncate font-semibold text-brand-950">{lease.property}</div>
              <div className="text-xs text-stone-500">Unit {lease.unit}</div>
            </div>
          </div>
          <Badge color="green">Current</Badge>
        </div>
        <div className="mt-4 flex items-end justify-between rounded-xl bg-cream p-3.5">
          <div>
            <div className="text-xs text-stone-500">{owed > 0 ? "Balance due" : "Monthly rent"}</div>
            <div className={`text-xl font-bold ${owed > 0 && days !== null && days < 0 ? "text-maroon-600" : "text-brand-950"}`}>{ugx(owed > 0 ? owed : lease.l.rent)}</div>
          </div>
          <div className="text-right text-xs">
            {next && days !== null ? (
              days < 0
                ? <span className="flex items-center gap-1 font-semibold text-maroon-600"><AlertCircle className="h-3.5 w-3.5" /> Overdue by {-days} day{days === -1 ? "" : "s"}</span>
                : <span className="flex items-center gap-1 text-stone-600"><CalendarClock className="h-3.5 w-3.5 text-gold-600" /> Due in {days} day{days === 1 ? "" : "s"}</span>
            ) : <span className="flex items-center gap-1 font-semibold text-brand-700"><CheckCircle2 className="h-3.5 w-3.5" /> All paid up</span>}
            {next && <div className="mt-0.5 text-stone-400">{fmtDate(next.dueDate)}</div>}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {next ? <Link href={`/tenant/pay/${next.id}`} className="btn-primary">Pay rent</Link> : <Link href="/tenant/rent" className="btn-primary">Receipts</Link>}
          <Link href="/tenant/requests/new" className="btn-outline">Report issue</Link>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {shortcuts.map((s) => (
          <Link key={s.href} href={s.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/70 bg-white py-3 text-[11px] font-medium text-stone-700 shadow-card hover:border-brand-200">
            <s.icon className="h-5 w-5 text-brand-700" /> {s.label}
          </Link>
        ))}
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
                  <div className="font-medium text-stone-800">Rent payment received</div>
                  <div className="text-xs text-stone-500">{fmtDate(p.paidAt)} · {p.receiptNo}</div>
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

      <FindHome />
    </div>
  );
}
