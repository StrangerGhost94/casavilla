import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Empty, Badge } from "@/components/ui";
import { Documents } from "@/components/Documents";
import { activeLease } from "../lib";

export default async function TenantLease() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  if (!lease) return <><PageHeader title="My lease" /><Empty title="No active lease" /></>;
  const l = lease.l;
  const daysLeft = Math.ceil((new Date(l.endDate).getTime() - Date.now()) / 86400000);
  return (
    <>
      <PageHeader title="My lease" subtitle={`${lease.property} · ${lease.unit}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-stone-500">Status</span><Badge>{l.status}</Badge></div>
          <div className="flex justify-between"><span className="text-stone-500">Start</span><span>{fmtDate(l.startDate)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">End</span><span>{fmtDate(l.endDate)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Rent</span><span className="font-semibold">{ugx(l.rent)} / month</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Due day</span><span>{l.dueDay} of each month</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Deposit</span><span>{ugx(l.deposit)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Landlord</span><span>{lease.landlord}</span></div>
          {daysLeft <= 60 && daysLeft > 0 && <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">Your lease ends in {daysLeft} days. Talk to your landlord about renewing.</div>}
        </div>
        <div className="lg:col-span-2"><Documents leaseId={l.id} viewerId={u.id} /></div>
      </div>
    </>
  );
}
