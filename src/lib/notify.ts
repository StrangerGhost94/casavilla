import "server-only";
import { db } from "@/db";

export async function notify(userId: number | null | undefined, message: string, link?: string) {
  if (!userId) return;
  await db.notification.create({ data: { userId, message, link } });
}

/** Sends a reminder only once per key (e.g. "due:42"), however many times housekeeping runs. Returns true when sent. */
export async function notifyOnce(key: string, userId: number | null | undefined, message: string, link?: string) {
  if (!userId) return false;
  const r = await db.notification.createMany({ data: [{ key: `${key}#${userId}`, userId, message, link }], skipDuplicates: true });
  return r.count > 0;
}

export async function managerIds() {
  return (await db.user.findMany({ where: { role: "manager", status: "active" }, select: { id: true } })).map((m) => m.id);
}

export async function notifyManagers(message: string, link?: string, key?: string) {
  for (const id of await managerIds()) {
    if (key) await notifyOnce(key, id, message, link);
    else await notify(id, message, link);
  }
}
