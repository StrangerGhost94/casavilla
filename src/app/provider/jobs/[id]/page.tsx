import { requireUser } from "@/lib/auth";
import { JobDetail } from "@/components/Jobs";

export default async function ProviderJob({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("provider");
  const { id } = await params;
  return <JobDetail id={Number(id)} viewer={u} back="/provider/jobs" />;
}
