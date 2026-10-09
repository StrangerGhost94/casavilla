import { requireUser } from "@/lib/auth";
import { PropertyPhotos } from "@/components/Portfolio";

export default async function LandlordPropertyPhotos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  const sp = await searchParams;
  return <PropertyPhotos id={Number(id)} viewer={u} base="/landlord/properties" fresh={sp.new === "1"} />;
}
