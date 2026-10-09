import { requireUser } from "@/lib/auth";
import { InspectionList } from "@/components/Inspections";

export const metadata = { title: "Inspections" };

export default async function ManagerInspections() {
  const u = await requireUser("manager");
  return <InspectionList viewer={u} />;
}
