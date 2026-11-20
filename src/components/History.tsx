import { PenLine } from "lucide-react";
import { db } from "@/db";
import { fmtDateTime } from "@/lib/format";
import { actionLabel, auditWhere, changes } from "@/lib/audit-view";
import { SectionTitle } from "@/components/ui";

/** Who changed this record, when, why and what: the audit trail for one tenant, lease, property or listing. Office only. */
export async function History({ refs, title = "History", limit = 30 }: { refs: { entity: string; ids: number[] }[]; title?: string; limit?: number }) {
  const rows = await db.auditLog.findMany({ where: auditWhere({ refs, all: true }), orderBy: { seq: "desc" }, take: limit });
  return (
    <section>
      <SectionTitle title={title} />
      {rows.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {rows.map((r) => {
            const diff = changes(r.before, r.after);
            return (
              <div key={r.id} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-stone-800">{actionLabel(r.action, r.entity)}</span>
                  {r.signed && <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700"><PenLine className="h-3 w-3" /> signed</span>}
                  <span className="ml-auto text-xs text-stone-500">{r.actorName ?? "System"}{r.actorRole ? ` · ${r.actorRole}` : ""} · {fmtDateTime(r.createdAt)}</span>
                </div>
                {r.detail && <div className="text-xs text-stone-600">{r.detail}</div>}
                {r.reason && <div className="text-xs text-stone-600">Reason: {r.reason}</div>}
                {diff.length > 0 && <div className="mt-0.5 text-[11px] text-stone-500">{diff.map((d) => `${d.field}: ${d.from} → ${d.to}`).join(" · ")}</div>}
              </div>
            );
          })}
        </div>
      ) : <p className="card text-sm text-stone-500">Nothing recorded yet.</p>}
    </section>
  );
}
