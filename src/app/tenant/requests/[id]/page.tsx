import { requireUser } from "@/lib/auth";
import { JobDetail } from "@/components/Jobs";

export default async function TenantRequest({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("tenant");
  const { id } = await params;
  return <JobDetail id={Number(id)} viewer={u} back="/tenant/requests" />;
}
