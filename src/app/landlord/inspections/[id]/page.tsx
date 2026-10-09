import { requireUser } from "@/lib/auth";
import { InspectionPage } from "@/components/Inspections";

export default async function LandlordInspection({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  return <InspectionPage id={Number((await params).id)} viewer={u} />;
}
