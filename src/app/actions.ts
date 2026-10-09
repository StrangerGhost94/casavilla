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

/** WhatsApp/SMS preferences from the profile. */
export async function saveMessagePrefs(fd: FormData) {
  const u = await requireUser();
  await db.user.update({
    where: { id: u.id },
    data: { messageOptIn: fd.get("messageOptIn") === "on", ...(u.role === "landlord" ? { remindTenants: fd.get("remindTenants") === "on" } : {}) },
  });
  revalidatePath("/profile");
}
