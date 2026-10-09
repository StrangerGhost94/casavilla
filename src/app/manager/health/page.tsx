import { CheckCircle2, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { runChecks } from "@/lib/integrity";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ConfirmSubmit, Submit } from "@/components/client";
import { repairCheck, runMaintenance } from "../actions";

export const metadata = { title: "System health" };

export default async function SystemHealth() {
  await requireUser("manager");
  const [checks, lastSweep, log] = await Promise.all([
    runChecks(),
    db.marker.findFirst({ where: { key: { startsWith: "sweep:" } }, orderBy: { createdAt: "desc" } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { actor: { select: { name: true } } } }),
  ]);
  const ds = await db.locationDataset.findFirst();
  const problems = checks.filter((c) => c.count > 0);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="System health" subtitle="Automatic checks that every balance, unit and job agrees with its records." />

      <div className={`card flex items-center gap-3 ${problems.length ? "border-gold-200 bg-gold-50/50" : "border-brand-100 bg-brand-50/60"}`}>
        {problems.length ? <ShieldAlert className="h-8 w-8 shrink-0 text-gold-600" /> : <CheckCircle2 className="h-8 w-8 shrink-0 text-brand-700" />}
        <div className="flex-1">
          <div className="font-semibold text-brand-950">{problems.length ? `${problems.length} check${problems.length > 1 ? "s need" : " needs"} attention` : "All records are consistent"}</div>
          <div className="text-xs text-stone-500">{checks.length} checks run just now · reminders &amp; rent last processed {lastSweep ? fmtDateTime(lastSweep.createdAt) : "never"}</div>
        </div>
        <form action={runMaintenance}><Submit className="btn-outline btn-sm" doneText="Done">Run now</Submit></form>
      </div>

      <div className="card mt-4 divide-y divide-stone-100 p-0">
        {checks.map((c) => (
          <div key={c.id} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${c.count ? "bg-gold-400 text-brand-950" : "bg-brand-50 text-brand-700"}`}>{c.count || "✓"}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-stone-800">{c.title}</div>
              <div className="text-xs text-stone-500">{c.why}</div>
              {c.samples.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-stone-600">{c.samples.map((s, i) => <li key={i} className="break-words">{s}</li>)}</ul>}
            </div>
            {c.count > 0 && c.fixable && (
              <form action={repairCheck}><input type="hidden" name="check" value={c.id} /><ConfirmSubmit message="Repair these records from their source of truth?" className="btn-primary btn-sm">Fix</ConfirmSubmit></form>
            )}
            {c.count > 0 && !c.fixable && <span className="text-[11px] text-stone-400">Review by hand</span>}
          </div>
        ))}
      </div>

      <SectionTitle title="Location dataset" />
      <div className="card text-sm">
        {ds ? (
          <div className="space-y-1">
            <div className="font-semibold text-brand-950">Uganda administrative areas · v{ds.version} <span className="font-mono text-[11px] font-normal text-stone-400">{ds.checksum}</span></div>
            <div className="text-xs text-stone-600">{ds.source}</div>
            <div className="text-xs text-stone-500">Licence: {ds.licence} · source updated {ds.sourceUpdated} · loaded {fmtDateTime(ds.importedAt)}</div>
            <div className="text-xs text-stone-500">{Object.entries(ds.counts as Record<string, number>).map(([k, v]) => `${v.toLocaleString("en-UG")} ${k}`).join(" · ")}</div>
          </div>
        ) : <div className="text-maroon-600">Not loaded yet.</div>}
      </div>

      <SectionTitle title="Activity log" />
      <div className="card divide-y divide-stone-100 p-0">
        {log.length === 0 && <div className="muted p-4">No activity recorded yet.</div>}
        {log.map((a) => (
          <div key={a.id} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-stone-800">{a.actor?.name ?? "System"} · <span className="font-mono text-xs text-brand-700">{a.action}</span></span>
              <span className="text-[11px] text-stone-400">{fmtDateTime(a.createdAt)}</span>
            </div>
            {a.detail && <div className="break-words text-xs text-stone-500">{a.detail}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
