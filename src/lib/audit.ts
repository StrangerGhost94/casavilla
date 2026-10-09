import "server-only";
import { db } from "@/db";
import type { Prisma } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof db;

/** Records who did what. Never blocks the action it describes. */
export async function audit(
  actorId: number | null | undefined, action: string, entity: string, entityId?: number | null, detail?: string, client: Client = db,
) {
  try {
    await client.auditLog.create({ data: { actorId: actorId ?? null, action, entity, entityId: entityId ?? null, detail: detail?.slice(0, 500) } });
  } catch (e) {
    console.error("audit failed", e);
  }
}
