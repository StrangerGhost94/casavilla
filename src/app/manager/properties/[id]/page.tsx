import { requireUser } from "@/lib/auth";
import { PropertyDetail } from "@/components/Portfolio";

export default async function ManagerProperty({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const { id } = await params;
  return <PropertyDetail id={Number(id)} viewer={u} base="/manager/properties" />;
}
