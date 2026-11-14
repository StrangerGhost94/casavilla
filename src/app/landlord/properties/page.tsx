import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";

export default async function LandlordProperties() {
  const u = await requireUser("landlord");
  return (
    <>
      <PageHeader title="My properties" subtitle="Your buildings and units. CasaVilla manages them for you." />
      <PropertyList where={{ landlordId: u.id }} base="/landlord/properties" />
    </>
  );
}
