import { requireUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { Documents } from "@/components/Documents";
import { AgreementCard, LeaseFacts } from "@/components/LeaseTools";
import { activeLease } from "../lib";
import { InspectionsCard } from "@/components/Inspections";
import { TenantMeters } from "@/components/Utilities";

export default async function TenantLease() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id, true);
  if (!lease) return <><PageHeader title="My lease" /><Empty title="No active lease" /></>;
  const l = lease.l;
  return (
    <>
      <PageHeader title="My lease" subtitle={`${lease.property} · ${lease.unit}`} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <LeaseFacts l={l} manage={false} />
          <AgreementCard l={l} manage={false} />
          <InspectionsCard leaseId={l.id} viewer={u} manage={false} />
          <TenantMeters unitId={l.unitId} propertyId={lease.propertyId} />
          <div className="card text-sm">
            <div className="text-stone-500">Landlord</div>
            <div className="font-semibold text-stone-800">{lease.landlord}</div>
            <a href={`tel:${lease.landlordPhone}`} className="link text-sm">{lease.landlordPhone}</a>
          </div>
        </div>
        <div className="lg:col-span-2"><Documents leaseId={l.id} viewerId={u.id} /></div>
      </div>
    </>
  );
}
