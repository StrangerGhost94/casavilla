import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { JobList } from "@/components/Jobs";

export default async function ManagerJobs({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireUser("manager");
  const { view = "open" } = await searchParams;
  const closed = ["done", "cancelled"];
  const where: Prisma.JobWhereInput = view === "unassigned" ? { providerId: null, status: { notIn: closed } }
    : view === "closed" ? { status: { in: closed } }
    : { status: { notIn: closed } };
  return (
    <>
      <PageHeader title="Maintenance jobs" />
      <div className="mb-4 flex gap-2">
        {[["open", "Open"], ["unassigned", "No provider"], ["closed", "Closed"]].map(([k, l]) => (
          <Link key={k} href={`/manager/jobs?view=${k}`} className={`rounded-full border px-3 py-1.5 text-sm ${view === k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-stone-200 bg-white"}`}>{l}</Link>
        ))}
      </div>
      <JobList where={where} base="/manager/jobs" />
    </>
  );
}
