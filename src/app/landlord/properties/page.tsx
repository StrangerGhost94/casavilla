import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";

export default async function LandlordProperties() {
  const u = await requireUser("landlord");
  return (
    <>
      <PageHeader title="Properties & units" actions={<Link href="/landlord/properties/new" className="btn-primary">Add property</Link>} />
      <PropertyList where={{ landlordId: u.id }} base="/landlord/properties" />
    </>
  );
}
