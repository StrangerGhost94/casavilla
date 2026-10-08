import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

export default async function LandlordMaintenance() {
  const u = await requireUser("landlord");
  return (
    <>
      <PageHeader title="Maintenance" subtitle="Repair requests from your tenants and jobs you've raised. Assign each to a provider."
        actions={<Link href="/landlord/maintenance/new" className="btn-primary">New job</Link>} />
      <JobList where={jobsFor.landlord(u)} base="/landlord/maintenance" empty="No maintenance jobs" />
    </>
  );
}
