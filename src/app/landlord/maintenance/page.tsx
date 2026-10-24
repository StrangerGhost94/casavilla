import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList, jobsFor } from "@/components/Jobs";

const closed = ["done", "cancelled"];
const views: [string, string, Prisma.JobWhereInput][] = [
  ["open", "Open", { status: { notIn: closed } }],
  ["unassigned", "Needs a provider", { providerId: null, status: { notIn: closed } }],
  ["working", "In progress", { providerId: { not: null }, status: { notIn: closed } }],
  ["closed", "Done", { status: { in: closed } }],
];

export default async function LandlordMaintenance({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const u = await requireUser("landlord");
  const mine = jobsFor.landlord(u);
  const asked = (await searchParams).view ?? "open";
  const view = views.find(([k]) => k === asked) ?? views[0];
  const [counts, urgent] = await Promise.all([
    Promise.all(views.map(([, , w]) => db.job.count({ where: { AND: [mine, w] } }))),
    db.job.count({ where: { AND: [mine, { priority: "urgent", status: { notIn: closed } }] } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Maintenance" subtitle="Repair requests from your tenants and jobs you've raised. Assign each to a provider."
        actions={<Link href="/landlord/maintenance/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New job</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4"><div className="text-xl font-bold text-brand-950">{counts[0]}</div><div className="text-xs text-stone-500">Open jobs</div></div>
        <div className={`card p-4 ${counts[1] ? "border-gold-200 bg-gold-50/50" : ""}`}><div className={`text-xl font-bold ${counts[1] ? "text-gold-700" : "text-brand-950"}`}>{counts[1]}</div><div className="text-xs text-stone-500">Need a provider</div></div>
        <div className={`card p-4 ${urgent ? "border-maroon-100 bg-maroon-50/40" : ""}`}><div className={`text-xl font-bold ${urgent ? "text-maroon-600" : "text-brand-950"}`}>{urgent}</div><div className="text-xs text-stone-500">Urgent</div></div>
        <div className="card p-4"><div className="text-xl font-bold text-brand-700">{counts[3]}</div><div className="text-xs text-stone-500">Done</div></div>
      </div>
      <div className="-mx-4 my-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        {views.map(([k, label], i) => (
          <Link key={k} href={`/landlord/maintenance?view=${k}`} className={view[0] === k ? "chip-active" : "chip"}>{label} <span className="opacity-60">{counts[i]}</span></Link>
        ))}
      </div>
      <JobList where={{ AND: [mine, view[2]] }} base="/landlord/maintenance" urgentFirst={view[0] !== "closed"}
        empty={view[0] === "closed" ? "No finished jobs yet" : view[0] === "unassigned" ? "Every open job has a provider" : "No open jobs. All quiet!"} />
    </div>
  );
}
