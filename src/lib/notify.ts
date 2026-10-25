import "server-only";
import { db } from "@/db";
import { sendPush } from "./push";

export async function notify(userId: number | null | undefined, message: string, link?: string) {
  if (!userId) return;
  const n = await db.notification.create({ data: { userId, message, link } });
  await pushFor(userId, n.id, message, link);
}

/** Also pops up on the person's phone, opening the notification (which marks it read and follows its link). */
async function pushFor(userId: number, id: number | undefined, message: string, link?: string) {
  await sendPush(userId, { body: message, url: id ? `/notifications/${id}` : link }).catch((e) => console.error("push", e));
}

/** Sends a reminder only once per key (e.g. "due:42"), however many times housekeeping runs. Returns true when sent. */
export async function notifyOnce(key: string, userId: number | null | undefined, message: string, link?: string) {
  if (!userId) return false;
  const r = await db.notification.createMany({ data: [{ key: `${key}#${userId}`, userId, message, link }], skipDuplicates: true });
  if (r.count > 0) {
    const n = await db.notification.findUnique({ where: { key: `${key}#${userId}` }, select: { id: true } });
    await pushFor(userId, n?.id, message, link);
  }
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
