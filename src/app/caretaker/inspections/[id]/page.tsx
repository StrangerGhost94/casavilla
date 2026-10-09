import { requireUser } from "@/lib/auth";
import { InspectionPage } from "@/components/Inspections";

export default async function CaretakerInspection({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("caretaker");
  return <InspectionPage id={Number((await params).id)} viewer={u} />;
}
