import "server-only";
import { db } from "@/db";
import type { Prisma } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof db;
/** A reason, a password signature, and the values before and after the change. */
export type AuditExtra = { reason?: string | null; signed?: boolean; before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue };

/** Records who did what. Never blocks the action it describes. The database adds the person's name, level and the chain hash. */
export async function audit(
  actorId: number | null | undefined, action: string, entity: string, entityId?: number | null, detail?: string, client: Client = db, extra: AuditExtra = {},
) {
  try {
    await client.auditLog.create({ data: { actorId: actorId ?? null, action, entity, entityId: entityId ?? null, detail: detail?.slice(0, 500), reason: extra.reason?.slice(0, 300) ?? null, signed: !!extra.signed, before: extra.before, after: extra.after } });
  } catch (e) {
    console.error("audit failed", e);
  }
}
