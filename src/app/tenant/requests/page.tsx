import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

export default async function TenantRequests() {
  const u = await requireUser("tenant");
  return (
    <>
      <PageHeader title="Repairs & bookings" subtitle="Track every request from report to done."
        actions={<Link href="/tenant/requests/new" className="btn-maroon">Report a repair</Link>} />
      <JobList where={jobsFor.tenant(u)} base="/tenant/requests" empty="You haven't reported any repairs" />
    </>
  );
}
