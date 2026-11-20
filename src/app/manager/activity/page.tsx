import Link from "next/link";
import { PenLine, ShieldAlert, ShieldCheck } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { actionLabel, auditWhere, changes, verifyTrail, type AuditFilter } from "@/lib/audit-view";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Activity & audit trail" };
const PER_PAGE = 50;

type SP = { who?: string; q?: string; from?: string; to?: string; signed?: string; all?: string; page?: string };

/** Super admins see everyone's activity; office staff see their own. */
export default async function Activity({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireUser("manager");
  const sp = await searchParams;
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const f: AuditFilter = {
    actorId: me.superAdmin ? Number(sp.who) || undefined : me.id,
    q: sp.q?.trim().slice(0, 80) || undefined, from: date(sp.from), to: date(sp.to), signed: sp.signed === "1", all: sp.all === "1",
  };
  const page = Math.max(1, Number(sp.page) || 1);
  const where = auditWhere(f);
  const [rows, total, staff, trail] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { seq: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    db.auditLog.count({ where }),
    me.superAdmin ? db.user.findMany({ where: { role: "manager" }, orderBy: { name: "asc" }, select: { id: true, name: true, superAdmin: true } }) : [],
    me.superAdmin ? verifyTrail() : null,
  ]);
  const qs = (o: Partial<SP>) => {
    const v = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, x]) => x) as [string, string][]);
    return `?${v}`;
  };
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader title="Activity & audit trail" subtitle={me.superAdmin ? "Everything done in the office: who, when, why and what changed." : "Everything you have done in the app."} />

      {trail && (
        <div className={`card flex items-center gap-3 text-sm ${trail.ok ? "border-brand-100 bg-brand-50/60" : "border-maroon-200 bg-maroon-50"}`}>
          {trail.ok ? <ShieldCheck className="h-7 w-7 shrink-0 text-brand-700" /> : <ShieldAlert className="h-7 w-7 shrink-0 text-maroon-600" />}
          <div>
            <div className="font-semibold text-brand-950">{trail.ok ? "The trail is intact" : "The trail has been tampered with"}</div>
            <div className="text-xs text-stone-600">{trail.ok
              ? `All ${trail.total.toLocaleString()} entries checked: none edited, none missing. Entries can't be changed or deleted.`
              : `${trail.bad} entr${trail.bad === 1 ? "y doesn't" : "ies don't"} match${trail.gaps ? ` and ${trail.gaps} are missing` : ""}${trail.firstBad ? `, starting at #${trail.firstBad}` : ""}. Tell Eliherd Engineers straight away.`}</div>
          </div>
        </div>
      )}

      <form className="card grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
        {me.superAdmin && (
          <select name="who" defaultValue={sp.who ?? ""} className="input col-span-2 py-2" aria-label="Person">
            <option value="">Everyone</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}{s.superAdmin ? " (super admin)" : ""}</option>)}
          </select>
        )}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search: waived, commission, a name…" className={`input py-2 ${me.superAdmin ? "col-span-2" : "col-span-2 sm:col-span-4"}`} aria-label="Search" />
        <input name="from" type="date" defaultValue={sp.from ?? ""} className="input py-2" aria-label="From" />
        <input name="to" type="date" defaultValue={sp.to ?? ""} className="input py-2" aria-label="To" />
        <label className="col-span-1 flex items-center gap-1.5 sm:col-span-2"><input type="checkbox" name="signed" value="1" defaultChecked={f.signed} className="h-4 w-4" /> Signed actions only</label>
        <label className="col-span-1 flex items-center gap-1.5 sm:col-span-2"><input type="checkbox" name="all" value="1" defaultChecked={f.all} className="h-4 w-4" /> Include every field change</label>
        <div className="col-span-2 flex gap-2 sm:col-span-2 sm:justify-end">
          <button className="btn-primary btn-sm">Show</button>
          <a href={`/manager/activity/export${qs({ page: undefined })}`} className="btn-outline btn-sm">Download Excel</a>
        </div>
      </form>

      <div className="text-xs text-stone-500">{total.toLocaleString()} entr{total === 1 ? "y" : "ies"}{total > PER_PAGE ? ` · page ${page} of ${Math.ceil(total / PER_PAGE)}` : ""}</div>
      <div className="card divide-y divide-stone-100 p-0">
        {rows.length === 0 && <div className="muted p-4">Nothing matches.</div>}
        {rows.map((r) => {
          const diff = changes(r.before, r.after);
          return (
            <div key={r.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-stone-800">{actionLabel(r.action, r.entity)}{r.entityId ? <span className="text-stone-400"> #{r.entityId}</span> : null}</span>
                {r.signed && <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700"><PenLine className="h-3 w-3" /> signed</span>}
                <span className="ml-auto text-xs text-stone-500">{fmtDateTime(r.createdAt)} · <span className="font-mono">#{String(r.seq ?? "")}</span></span>
              </div>
              <div className="text-xs text-stone-600"><b>{r.actorName ?? "System"}</b>{r.actorRole ? ` · ${r.actorRole}` : ""}</div>
              {r.detail && <div className="break-words text-xs text-stone-600">{r.detail}</div>}
              {r.reason && <div className="break-words text-xs text-stone-700">Reason: {r.reason}</div>}
              {diff.length > 0 && <div className="mt-0.5 break-words text-[11px] text-stone-500">{diff.map((d) => `${d.field}: ${d.from} → ${d.to}`).join(" · ")}</div>}
            </div>
          );
        })}
      </div>
      {total > PER_PAGE && (
        <div className="flex justify-between">
          {page > 1 ? <Link href={qs({ page: String(page - 1) })} className="btn-outline btn-sm">← Newer</Link> : <span />}
          {page * PER_PAGE < total ? <Link href={qs({ page: String(page + 1) })} className="btn-outline btn-sm">Older →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
