import { requireUser } from "@/lib/auth";
import { InspectionList } from "@/components/Inspections";

export const metadata = { title: "Inspections" };

export default async function CaretakerInspections() {
  const u = await requireUser("caretaker");
  return <InspectionList viewer={u} />;
}
