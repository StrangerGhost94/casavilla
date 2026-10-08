import { requireUser } from "@/lib/auth";
import { JobDetail } from "@/components/Jobs";

export default async function ManagerJob({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const { id } = await params;
  return <JobDetail id={Number(id)} viewer={u} back="/manager/jobs" />;
}
