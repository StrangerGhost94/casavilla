import { requireUser } from "@/lib/auth";
import { PropertyEdit } from "@/components/Portfolio";

export default async function ManagerPropertyEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const { id } = await params;
  return <PropertyEdit id={Number(id)} viewer={u} base="/manager/properties" />;
}
