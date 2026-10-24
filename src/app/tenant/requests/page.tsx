import Link from "next/link";
import { ChevronRight, Wrench } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

export default async function TenantRequests() {
  const u = await requireUser("tenant");
  const mine = jobsFor.tenant(u);
  const [open, done] = await Promise.all([
    db.job.count({ where: { AND: [mine, { status: { notIn: ["done", "cancelled"] } }] } }),
    db.job.count({ where: { AND: [mine, { status: "done" }] } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Repairs" subtitle="Report a problem and follow it until it's fixed." />
      <Link href="/tenant/requests/new" className="flex items-center gap-4 rounded-3xl bg-brand-900 p-5 text-white shadow-card transition hover:bg-brand-950">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><Wrench className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Something broken?</span>
          <span className="block text-sm text-white/70">Report it with a photo. Your landlord sends a vetted provider.</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/60" />
      </Link>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="card p-4"><div className="text-xl font-bold text-brand-950">{open}</div><div className="text-xs text-stone-500">In progress</div></div>
        <div className="card p-4"><div className="text-xl font-bold text-brand-950">{done}</div><div className="text-xs text-stone-500">Fixed</div></div>
      </div>
      <h2 className="h2 mb-2 mt-6">Your requests</h2>
      <JobList where={mine} base="/tenant/requests" empty="You haven't reported any repairs" />
    </div>
  );
}
