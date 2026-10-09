import { requireUser } from "@/lib/auth";
import { TenantInspectionPage } from "@/components/Inspections";

export default async function TenantInspection({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("tenant");
  return <TenantInspectionPage id={Number((await params).id)} viewer={u} />;
}
