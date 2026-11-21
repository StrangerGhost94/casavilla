import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/db";
import { kampalaStart } from "./format";

/** "lease.refund_paid" → "Lease refund paid"; automatic entries read "Changed", "Created" or "Deleted". */
export function actionLabel(action: string, entity: string) {
  const what = entity.replace(/_/g, " ");
  if (action === "data.update") return `Changed ${what}`;
  if (action === "data.create") return `Created ${what}`;
  if (action === "data.delete") return `Deleted ${what}`;
  if (action.startsWith("data.")) return `${action.slice(5).replace(/Many.*/, "")} several ${what}s`.replace(/^./, (c) => c.toUpperCase());
  const s = action.replace(/[._]/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const field = (k: string) => k.replace(/Id$/, "").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
const show = (v: unknown): string => v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v).slice(0, 120);

/** The fields an entry changed, as "rent: 800000 → 900000". */
export function changes(before: unknown, after: unknown): { field: string; from: string; to: string }[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<string, unknown>;
  const a = (after && typeof after === "object" ? after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== "where");
  return keys.slice(0, 12).map((k) => ({ field: field(k), from: show(b[k]), to: show(a[k]) }));
}

export type AuditFilter = { actorId?: number; q?: string; from?: string; to?: string; signed?: boolean; all?: boolean; refs?: { entity: string; ids: number[] }[] };

export function auditWhere(f: AuditFilter): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.actorId) and.push({ actorId: f.actorId });
  if (f.signed) and.push({ signed: true });
  if (!f.all) and.push({ NOT: { action: { startsWith: "data." } } });
  if (f.from) and.push({ createdAt: { gte: kampalaStart(f.from) } });
  if (f.to) and.push({ createdAt: { lt: new Date(kampalaStart(f.to).getTime() + 86400000) } });
  if (f.q) {
    const q = { contains: f.q, mode: "insensitive" as const };
    and.push({ OR: [{ action: q }, { entity: q }, { detail: q }, { reason: q }, { actorName: q }] });
  }
  if (f.refs) and.push({ OR: f.refs.filter((r) => r.ids.length).map((r) => ({ entity: r.entity, entityId: { in: r.ids } })) });
  return and.length ? { AND: and } : {};
}

/** Checks the whole chain: every entry's hash matches its contents and links to the one before, with no gaps. */
export async function verifyTrail() {
  const [r] = await db.$queryRawUnsafe<{ total: number; bad: number; gaps: number; first_bad: bigint | null }[]>(`
    WITH w AS (SELECT id, lag(hash) OVER (ORDER BY seq) AS prev FROM audit_logs)
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE a.hash IS DISTINCT FROM audit_row_hash(a) OR a.prev_hash IS DISTINCT FROM w.prev)::int AS bad,
      (coalesce(max(a.seq), 0) - count(*))::int AS gaps,
      min(a.seq) FILTER (WHERE a.hash IS DISTINCT FROM audit_row_hash(a) OR a.prev_hash IS DISTINCT FROM w.prev) AS first_bad
    FROM audit_logs a JOIN w USING (id)`);
  return { total: r.total, ok: r.bad === 0 && r.gaps === 0, bad: r.bad, gaps: r.gaps, firstBad: r.first_bad == null ? null : Number(r.first_bad) };
}
