import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Stat, Empty } from "@/components/ui";
import { chargesSummary } from "@/components/Ledger";
import { activeLease } from "./lib";

export default async function TenantHome() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  const open = await db.job.count({ where: { requesterId: u.id, status: { notIn: ["done", "cancelled"] } } });
  const apps = await db.application.count({ where: { tenantId: u.id, status: "pending" } });

  if (!lease) {
    return (
      <>
        <PageHeader title={`Welcome, ${u.name.split(" ")[0]}`} subtitle="You don't have an active lease yet." />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="h2">Find your next home</div>
            <p className="muted mt-1">Browse vacant units and apply to the landlord you choose.</p>
            <Link href="/listings" className="btn-primary mt-4">Browse homes</Link>
          </div>
          <div className="card">
            <div className="h2">Applications</div>
            <p className="muted mt-1">{apps ? `${apps} waiting for a landlord's answer.` : "No pending applications."}</p>
            <Link href="/tenant/applications" className="btn-outline mt-4">View applications</Link>
          </div>
        </div>
      </>
    );
  }
  const { owed, next } = await chargesSummary(lease.l.id);
  return (
    <>
      <PageHeader title={`Welcome, ${u.name.split(" ")[0]}`} subtitle={`${lease.property} · ${lease.unit} — ${lease.location}`}
        actions={next ? <Link href={`/tenant/pay/${next.id}`} className="btn-primary">Pay rent with Mobile Money</Link> : undefined} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Balance due" value={<span className={owed ? "text-maroon-600" : "text-brand-600"}>{ugx(owed)}</span>} hint={owed ? "Across all unpaid charges" : "You're all paid up"} href="/tenant/rent" />
        <Stat label="Next due" value={next ? fmtDate(next.dueDate) : "—"} hint={next?.description} />
        <Stat label="Monthly rent" value={ugx(lease.l.rent)} hint={`Due on day ${lease.l.dueDay} each month`} />
        <Stat label="Open repairs" value={open} href="/tenant/requests" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <div className="h2">Something broken?</div>
          <p className="muted mt-1">Report it with a photo. Your landlord and CasaVilla will send the right provider.</p>
          <Link href="/tenant/requests/new" className="btn-maroon mt-4">Report a repair</Link>
        </div>
        <div className="card">
          <div className="h2">Your landlord</div>
          <p className="mt-1 text-sm">{lease.landlord} · {lease.landlordPhone}</p>
          <p className="muted mt-1">Lease ends {fmtDate(lease.l.endDate)}</p>
          <Link href="/tenant/lease" className="btn-outline mt-4">Lease & documents</Link>
        </div>
      </div>
    </>
  );
}
