"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { endSession, requireUser } from "@/lib/auth";

export async function logout() {
  await endSession();
  redirect("/");
}

export async function markAllRead() {
  const u = await requireUser();
  await db.notification.updateMany({ where: { userId: u.id }, data: { read: true } });
  revalidatePath("/", "layout");
}
