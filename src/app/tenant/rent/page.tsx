import { requireUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { Ledger } from "@/components/Ledger";
import { activeLease } from "../lib";

export default async function TenantRent() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id, true);
  if (!lease) return <><PageHeader title="Rent & receipts" /><Empty title="No active lease">Rent appears here once a landlord approves your application.</Empty></>;
  const ended = lease.l.status === "ended";
  return (
    <>
      <PageHeader title="Rent & receipts" subtitle={`${lease.property} · ${lease.unit}${ended ? " (moved out)" : ""}`} />
      {lease.l.credit > 0 && !ended && (
        <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">You have <span className="font-bold">{lease.l.credit.toLocaleString("en-UG")} UGX</span> credit from paying ahead — it is used automatically on your next charges.</div>
      )}
      {ended && lease.l.settlement != null && lease.l.settlement < 0 && (
        <div className="mb-4 rounded-2xl bg-maroon-50 p-4 text-sm text-maroon-700">Your lease has ended with <span className="font-bold">{(-lease.l.settlement).toLocaleString("en-UG")} UGX</span> still owed. You can clear it below with Mobile Money.</div>
      )}
      {ended && lease.l.settlement != null && lease.l.settlement > 0 && (
        <div className="mb-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">Your landlord owes you a refund of <span className="font-bold">{lease.l.settlement.toLocaleString("en-UG")} UGX</span> from your deposit. You'll be notified when it's paid.</div>
      )}
      <Ledger leaseId={lease.l.id} payHref={(id) => `/tenant/pay/${id}`} />
    </>
  );
}
