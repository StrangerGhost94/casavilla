"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { normalizePhone } from "@/lib/format";
import { ensureChargesFor } from "@/lib/billing";

export async function setUserStatus(fd: FormData) {
  const me = await requireUser("manager");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["active", "suspended", "pending"].includes(status)) throw new Error("Bad status");
  if (id === me.id) throw new Error("You can't change your own status");
  const u = await db.user.update({ where: { id }, data: { status: status as "active" } });
  if (status === "active") {
    const link = { tenant: "/tenant", landlord: "/landlord", provider: "/provider", manager: "/manager" }[u.role];
    await notify(u.id, "Your CasaVilla account has been approved. Welcome aboard!", link);
  }
  revalidatePath("/manager", "layout");
}

export async function createStaff(fd: FormData) {
  await requireUser("manager");
  const email = String(fd.get("email")).trim().toLowerCase();
  const password = String(fd.get("password"));
  if (password.length < 8) throw new Error("Password must be at least 8 characters");
  await db.user.create({
    data: {
      name: String(fd.get("name")).trim(), email, phone: normalizePhone(String(fd.get("phone"))),
      passwordHash: await bcrypt.hash(password, 10), role: "manager", status: "active",
    },
  });
  revalidatePath("/manager/people");
}

export async function generateCharges() {
  await requireUser("manager");
  await ensureChargesFor("all");
  revalidatePath("/manager", "layout");
}
