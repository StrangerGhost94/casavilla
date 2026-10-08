import { requireUser } from "@/lib/auth";
import { JobDetail } from "@/components/Jobs";

export default async function LandlordJob({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  return <JobDetail id={Number(id)} viewer={u} back="/landlord/maintenance" />;
}
