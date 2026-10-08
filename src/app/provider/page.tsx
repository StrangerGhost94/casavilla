import Link from "next/link";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { PageHeader, Stat } from "@/components/ui";
import { JobList } from "@/components/Jobs";

export default async function ProviderHome() {
  const u = await requireUser("provider");
  const count = (statuses: string[]) => db.job.count({ where: { providerId: u.id, status: { in: statuses } } });
  const [newJobs, active, done] = await Promise.all([count(["assigned"]), count(["accepted", "in_progress"]), count(["done"])]);
  const agg = await db.order.aggregate({ _count: true, _sum: { total: true }, where: { providerId: u.id, status: { in: ["placed", "confirmed"] } } });
  const o = { n: agg._count, total: agg._sum.total ?? 0 };
  const svc = await db.service.count({ where: { providerId: u.id } });
  return (
    <>
      <PageHeader title={`Welcome, ${u.businessName || u.name}`} subtitle="Your jobs and sales." />
      {svc === 0 && (
        <div className="mb-6 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm">
          Start by listing what you do — cleaning, plumbing, pest control… <Link href="/provider/services" className="link">Add your services →</Link>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="New jobs" value={newJobs} hint="Waiting for you to accept" href="/provider/jobs" />
        <Stat label="In progress" value={active} href="/provider/jobs" />
        <Stat label="Completed" value={done} />
        <Stat label="Open orders" value={o.n} hint={ugx(o.total)} href="/provider/orders" />
      </div>
      <h2 className="h2 mb-3 mt-8">Jobs needing action</h2>
      <JobList where={{ providerId: u.id, status: { in: ["assigned", "accepted", "in_progress"] } }} base="/provider/jobs" empty="No active jobs right now" />
    </>
  );
}
