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
