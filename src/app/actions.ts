"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { endSession, requireUser } from "@/lib/auth";

export async function logout() {
  await endSession();
  redirect("/login");
}

export async function markAllRead() {
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id }, data: { read: true } });
  revalidatePath("/", "layout");
}

/** Saves this phone/browser so notifications pop up on it. Called from the "Turn on" button with the browser's subscription. */
export async function savePushSubscription(sub: { endpoint: string; keys?: { p256dh?: string; auth?: string } }, device?: string) {
  const u = await requireUser();
  const { endpoint, keys } = sub ?? {};
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !keys?.p256dh || !keys?.auth) return { ok: false as const };
  const data = { userId: u.id, p256dh: String(keys.p256dh).slice(0, 200), auth: String(keys.auth).slice(0, 100), device: device ? String(device).slice(0, 40) : null };
  await db.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
  return { ok: true as const };
}

/** Stops notifications on this phone/browser. */
export async function removePushSubscription(endpoint: string) {
  const u = await requireUser();
  await db.pushSubscription.deleteMany({ where: { endpoint: String(endpoint), userId: u.id } });
  return { ok: true as const };
}

/** Sends a test notification to all of your phones. */
export async function testPush() {
  const u = await requireUser();
  const { sendPush } = await import("@/lib/push");
  const n = await sendPush(u.id, { body: "Phone notifications are on. You'll get rent reminders and updates here.", url: "/notifications" });
  return { sent: n };
}

/** Removes one of your own notifications. */
export async function deleteNotification(fd: FormData) {
  const u = await requireUser();
  await db.notification.deleteMany({ where: { id: Number(fd.get("id")) || 0, userId: u.id } });
  revalidatePath("/", "layout");
}

/** Removes every notification you've already read (unread ones stay). */
export async function clearReadNotifications() {
  const u = await requireUser();
  await db.notification.deleteMany({ where: { userId: u.id, read: true } });
  revalidatePath("/", "layout");
}

/** WhatsApp/SMS preferences from the profile. */
export async function saveMessagePrefs(fd: FormData) {
  const u = await requireUser();
  await db.user.update({
    where: { id: u.id },
    data: { messageOptIn: fd.get("messageOptIn") === "on", ...(u.role === "landlord" ? { remindTenants: fd.get("remindTenants") === "on" } : {}) },
  });
  revalidatePath("/profile");
}
