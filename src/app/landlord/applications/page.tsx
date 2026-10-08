import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ApplicationsTable } from "@/components/Portfolio";

export default async function LandlordApplications() {
  const u = await requireUser("landlord");
  return (
    <>
      <PageHeader title="Applications" subtitle="Tenants who chose your homes. Approving creates the lease and starts rent billing." />
      <ApplicationsTable where={{ unit: { property: { landlordId: u.id } } }} />
    </>
  );
}
