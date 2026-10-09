import { requireUser } from "@/lib/auth";
import { InspectionList } from "@/components/Inspections";

export const metadata = { title: "Inspections" };

export default async function LandlordInspections() {
  const u = await requireUser("landlord");
  return <InspectionList viewer={u} />;
}
