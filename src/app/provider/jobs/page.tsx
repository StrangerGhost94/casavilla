import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

export default async function ProviderJobs() {
  const u = await requireUser("provider");
  return <><PageHeader title="Jobs" subtitle="Assigned by landlords, CasaVilla, or booked directly by customers." /><JobList where={jobsFor.provider(u)} base="/provider/jobs" /></>;
}
