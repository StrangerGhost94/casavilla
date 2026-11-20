import { AsyncLocalStorage } from "node:async_hooks";
import type { PrismaClient } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

/**
 * Automatic audit trail: every database change an office account makes from a button or form is recorded with
 * its before and after values, on top of the plain-language entries the actions write themselves.
 * Background work (rent charges, reminders) runs inside `systemScope` and isn't attributed to whoever opened a page.
 */
export const systemScope = new AsyncLocalStorage<true>();

const WRITES = new Set(["create", "update", "upsert", "delete", "createMany", "createManyAndReturn", "updateMany", "updateManyAndReturn", "deleteMany"]);
// Logs, caches and outboxes: their changes aren't decisions anyone makes.
const SKIP = new Set(["AuditLog", "Notification", "PushSubscription", "FileVariant", "Marker", "MessageOutbox", "EmailOutbox", "PhoneCode", "Location", "LocationAlias", "LocationDataset"]);
const IGNORE_FIELDS = new Set(["updatedAt", "createdAt", "lastLoginAt"]);
const ENTITY: Record<string, string> = { SaleListing: "sale" };

export const tracked = (model: string | undefined, operation: string) => !!model && WRITES.has(operation) && !SKIP.has(model);
const entityOf = (model: string) => ENTITY[model] ?? model.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
const delegate = (model: string) => model[0].toLowerCase() + model.slice(1);

/** The office account behind this request, only when it is a button or form (a server action), not a page view. */
async function officeActor(): Promise<number | null> {
  if (systemScope.getStore()) return null;
  try {
    const { headers, cookies } = await import("next/headers");
    if (!(await headers()).get("next-action")) return null;
    const s = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    return s?.role === "manager" ? s.uid : null;
  } catch {
    return null; // scripts, tests and background jobs
  }
}

/** Makes a value safe and small for the log: no file bytes or password hashes, long text shortened. */
function clean(v: unknown, depth = 0): unknown {
  if (v == null || typeof v === "boolean" || typeof v === "number") return v;
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return v.length > 300 ? `${v.slice(0, 300)}…` : v;
  if (v instanceof Date) return v.toISOString();
  if (v instanceof Uint8Array) return "[file]";
  if (depth > 3) return "[…]";
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => clean(x, depth + 1));
  if (typeof v === "object") {
    if ("toFixed" in (v as object) && typeof (v as { toString: () => string }).toString === "function" && !(v as object).constructor?.name?.startsWith("Object")) return String(v);
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = /password/i.test(k) ? "[hidden]" : clean(x, depth + 1);
    return out;
  }
  return String(v);
}
const same = (a: unknown, b: unknown) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));

// Entries are written one after another, after the response, so they never hold up (or deadlock with) the change itself.
let chain: Promise<unknown> = Promise.resolve();
async function write(base: PrismaClient, row: Parameters<PrismaClient["auditLog"]["create"]>[0]["data"]) {
  const run = () => { chain = chain.then(() => base.auditLog.create({ data: row })).catch((e) => console.error("audit change", e)); return chain; };
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    await run();
  }
}

export async function trackChange(base: PrismaClient, model: string, operation: string, args: Record<string, unknown>, query: (a: unknown) => Promise<unknown>) {
  const actorId = await officeActor();
  if (!actorId) return query(args);
  const entity = entityOf(model);
  const d = (base as unknown as Record<string, { findUnique: (a: unknown) => Promise<Record<string, unknown> | null> }>)[delegate(model)];
  const single = operation === "update" || operation === "delete" || operation === "upsert";
  const before = single && args.where ? await d.findUnique({ where: args.where }).catch(() => null) : null;
  const result = (await query(args)) as Record<string, unknown> | null;

  if (!single && operation !== "create") {
    const count = typeof result?.count === "number" ? result.count : Array.isArray(result) ? result.length : null;
    if (count === 0) return result;
    await write(base, { actorId, action: `data.${operation}`, entity, detail: `${count ?? "Some"} record(s)`, before: clean({ where: args.where }) as object, after: args.data ? clean(args.data) as object : undefined });
    return result;
  }
  const row = (result && typeof result === "object" ? result : {}) as Record<string, unknown>;
  const entityId = typeof (row.id ?? before?.id) === "number" ? Number(row.id ?? before?.id) : null;
  if (operation === "delete") {
    await write(base, { actorId, action: "data.delete", entity, entityId, before: clean(before) as object });
    return result;
  }
  const isNew = operation === "create" || (operation === "upsert" && !before);
  if (isNew) {
    const after: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) if (!IGNORE_FIELDS.has(k) && k !== "id" && v != null) after[k] = v;
    await write(base, { actorId, action: "data.create", entity, entityId, after: clean(after) as object });
    return result;
  }
  const data = ((operation === "upsert" ? args.update : args.data) ?? {}) as Record<string, unknown>;
  const b: Record<string, unknown> = {}, a: Record<string, unknown> = {};
  for (const k of Object.keys(data)) {
    if (IGNORE_FIELDS.has(k)) continue;
    const now = k in row ? row[k] : data[k];
    if (!same(before?.[k], now)) { b[k] = before?.[k] ?? null; a[k] = now; }
  }
  if (Object.keys(a).length) await write(base, { actorId, action: "data.update", entity, entityId, before: clean(b) as object, after: clean(a) as object });
  return result;
}
