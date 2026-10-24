import { MessageCircle, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ymd } from "@/lib/format";
import { Avatar, PageHeader, Empty } from "@/components/ui";
import { Documents } from "@/components/Documents";
import { AgreementCard, LeaseFacts } from "@/components/LeaseTools";
import { activeLease } from "../lib";
import { InspectionsCard } from "@/components/Inspections";
import { TenantMeters } from "@/components/Utilities";

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export default async function TenantLease() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id, true);
  if (!lease) return <><PageHeader title="My lease" /><Empty title="No active lease">Your lease, agreement and documents appear here once you move in.</Empty></>;
  const l = lease.l;
  const today = kampalaToday(), start = ymd(l.startDate), end = ymd(l.endDate);
  const total = Math.max(1, daysBetween(start, end));
  const gone = Math.min(total, Math.max(0, daysBetween(start, today)));
  const left = daysBetween(today, end);
  const months = Math.round(total / 30.4);
  const phone = (lease.landlordPhone ?? "").replace(/\D/g, "");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My lease" subtitle={`${lease.property} · ${lease.unit}`} />

      {/* Where I am in the lease */}
      <div className="rounded-3xl bg-brand-900 p-5 text-white shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-xs text-white/60">{l.status === "ended" ? "Lease ended" : left < 0 ? "Lease ended" : "Time left on your lease"}</div>
            <div className="text-2xl font-bold">{l.status === "ended" || left < 0 ? fmtDate(l.endDate) : `${left} day${left === 1 ? "" : "s"}`}</div>
          </div>
          <div className="text-right text-xs text-white/70">{months}-month lease</div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-white/10"><div className={`h-2 rounded-full ${left <= 60 ? "bg-gold-400" : "bg-brand-300"}`} style={{ width: `${Math.round((gone / total) * 100)}%` }} /></div>
        <div className="mt-2 flex justify-between text-[11px] text-white/60"><span>Started {fmtDate(l.startDate)}</span><span>Ends {fmtDate(l.endDate)}</span></div>
        {left <= 60 && left >= 0 && l.status !== "ended" && <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/85">Ending soon. Talk to {lease.landlord} about renewing, or give notice as your agreement says.</p>}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <div className="card flex items-center gap-3 p-4">
            <Avatar name={lease.landlord} className="h-11 w-11 text-sm" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-stone-500">Your landlord</div>
              <div className="truncate font-semibold text-brand-950">{lease.landlord}</div>
              {lease.landlordPhone && <div className="text-xs text-stone-500">{lease.landlordPhone}</div>}
            </div>
            {phone && <a href={`tel:+${phone}`} aria-label={`Call ${lease.landlord}`} className="btn-outline btn-sm px-2.5"><Phone className="h-4 w-4" /></a>}
            {phone && <a href={`https://wa.me/${phone}`} aria-label={`WhatsApp ${lease.landlord}`} className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>}
          </div>
          <LeaseFacts l={l} manage={false} />
          <AgreementCard l={l} manage={false} />
          <InspectionsCard leaseId={l.id} viewer={u} manage={false} />
          <TenantMeters unitId={l.unitId} propertyId={lease.propertyId} />
        </div>
        <div className="lg:col-span-2"><Documents leaseId={l.id} viewerId={u.id} /></div>
      </div>
    </div>
  );
}
