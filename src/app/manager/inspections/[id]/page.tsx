import { requireUser } from "@/lib/auth";
import { InspectionPage } from "@/components/Inspections";

export default async function ManagerInspection({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  return <InspectionPage id={Number((await params).id)} viewer={u} />;
}
