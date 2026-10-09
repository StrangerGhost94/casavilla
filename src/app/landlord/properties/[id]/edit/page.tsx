import { requireUser } from "@/lib/auth";
import { PropertyEdit } from "@/components/Portfolio";

export default async function LandlordPropertyEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  return <PropertyEdit id={Number(id)} viewer={u} base="/landlord/properties" />;
}
