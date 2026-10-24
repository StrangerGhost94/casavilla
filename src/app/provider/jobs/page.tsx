import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

const views: [string, string, Prisma.JobWhereInput, string][] = [
  ["new", "New", { status: "assigned" }, "No new jobs. They show up here the moment someone books you."],
  ["active", "In progress", { status: { in: ["accepted", "quoted", "in_progress"] } }, "Nothing in progress right now."],
  ["done", "Done", { status: "done" }, "No finished jobs yet."],
  ["all", "All", {}, "No jobs yet."],
];

export default async function ProviderJobs({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const u = await requireUser("provider");
  const mine = jobsFor.provider(u);
  const counts = await Promise.all(views.map(([, , w]) => db.job.count({ where: { AND: [mine, w] } })));
  // Open on new jobs when there are any, otherwise on what's in progress.
  const asked = (await searchParams).view ?? (counts[0] ? "new" : "active");
  const i = Math.max(0, views.findIndex(([k]) => k === asked));
  const [, , where, empty] = views[i];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Jobs" subtitle="Assigned by landlords, CasaVilla, or booked directly by customers." />
      {counts[0] > 0 && i !== 0 && (
        <Link href="/provider/jobs?view=new" className="mb-4 block rounded-2xl border border-gold-200 bg-gold-50/70 p-3.5 text-sm text-stone-700">
          <b>{counts[0]} new job{counts[0] === 1 ? "" : "s"}</b> waiting for your answer. Quick replies keep you at the top of the list →
        </Link>
      )}
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {views.map(([k, label], j) => (
          <Link key={k} href={`/provider/jobs?view=${k}`} className={i === j ? "chip-active" : "chip"}>{label} <span className="opacity-60">{counts[j]}</span></Link>
        ))}
      </div>
      <JobList where={{ AND: [mine, where] }} base="/provider/jobs" urgentFirst={i < 2} empty={empty} />
    </div>
  );
}
