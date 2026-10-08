import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { TenantsTable } from "@/components/Portfolio";

export default async function LandlordTenants() {
  const u = await requireUser("landlord");
  await ensureChargesFor("landlord", u.id);
  return (
    <>
      <PageHeader title="Tenants & rent" subtitle="Who has paid, who owes, and every receipt." />
      <TenantsTable where={{ landlordId: u.id }} base="/landlord/tenants" />
    </>
  );
}
