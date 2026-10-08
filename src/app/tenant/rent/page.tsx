import { requireUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { Ledger } from "@/components/Ledger";
import { activeLease } from "../lib";

export default async function TenantRent() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  if (!lease) return <><PageHeader title="Rent & receipts" /><Empty title="No active lease">Rent appears here once a landlord approves your application.</Empty></>;
  return (
    <>
      <PageHeader title="Rent & receipts" subtitle={`${lease.property} · ${lease.unit}`} />
      <Ledger leaseId={lease.l.id} payHref={(id) => `/tenant/pay/${id}`} />
    </>
  );
}
