import "server-only";
import { db } from "@/db";

export async function notify(userId: number | null | undefined, message: string, link?: string) {
  if (!userId) return;
  await db.notification.create({ data: { userId, message, link } });
}
