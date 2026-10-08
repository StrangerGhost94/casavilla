import { requireUser } from "@/lib/auth";
import { PropertyDetail } from "@/components/Portfolio";

export default async function LandlordProperty({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  return <PropertyDetail id={Number(id)} viewer={u} base="/landlord/properties" />;
}
