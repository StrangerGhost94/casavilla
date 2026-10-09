import { requireUser } from "@/lib/auth";
import { PropertyPhotos } from "@/components/Portfolio";

export default async function LandlordPropertyPhotos({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  return <PropertyPhotos id={Number(id)} viewer={u} base="/landlord/properties" />;
}
