import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { PageHeader } from "@/components/ui";
import { TenantsSections } from "@/components/Portfolio";
import { InviteTenants } from "@/components/InviteTenants";

export default async function LandlordTenants({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const u = await requireUser("landlord");
  await ensureChargesFor("landlord", u.id);
  return (
    <>
      <PageHeader title="Tenants & rent" subtitle="Who has paid, who owes, and every receipt." />
      <InviteTenants landlord={u} />
      <TenantsSections where={{ landlordId: u.id }} base="/landlord/tenants" show={(await searchParams).show} />
    </>
  );
}
