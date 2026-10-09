import { requireUser } from "@/lib/auth";
import { JobDetail } from "@/components/Jobs";

export default async function CaretakerJob({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("caretaker");
  return <JobDetail id={Number((await params).id)} viewer={u} back="/caretaker/repairs" />;
}
