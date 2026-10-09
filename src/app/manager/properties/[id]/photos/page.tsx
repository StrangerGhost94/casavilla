import { requireUser } from "@/lib/auth";
import { PropertyPhotos } from "@/components/Portfolio";

export default async function ManagerPropertyPhotos({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const { id } = await params;
  return <PropertyPhotos id={Number(id)} viewer={u} base="/manager/properties" />;
}
