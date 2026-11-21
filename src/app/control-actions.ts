"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getUser, homeFor, requireSuperAdmin } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { requireSignature } from "@/lib/signature";
import { requireChecklist } from "@/lib/checklist";
import { cashFor } from "@/lib/controls";
import { kampalaToday, ugx } from "@/lib/format";
import { OFFICE_RULES } from "@/lib/office-rules";

/** A super admin signs off one day's cash and bank receipts after counting them. */
export async function closeCashDay(fd: FormData) {
  const me = await requireSuperAdmin();
  const day = String(fd.get("day") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > kampalaToday()) return fail("Choose a day");
  if (await db.cashClose.findUnique({ where: { day: new Date(`${day}T00:00:00Z`) } })) return fail("That day is already closed");
  const checklist = await requireChecklist(fd, "cash");
  const reason = await requireSignature(fd, me);
  const pays = await cashFor(day);
  if (!pays.length) return fail("There's nothing to close on that day");
  const byStaff: Record<string, { name: string; count: number; total: number }> = {};
  for (const p of pays) {
    const k = String(p.recordedBy?.id ?? 0);
    byStaff[k] ??= { name: p.recordedBy?.name ?? "Not recorded", count: 0, total: 0 };
    byStaff[k].count++; byStaff[k].total += p.amount;
  }
  const total = pays.reduce((n, p) => n + p.amount, 0);
  await db.cashClose.create({ data: { day: new Date(`${day}T00:00:00Z`), closedById: me.id, count: pays.length, total, byStaff, note: reason } });
  await audit(me.id, "cash.closed", "cash_close", null, `${day}: ${pays.length} payment(s), ${ugx(total)}`, db, { reason, signed: true, after: { day, count: pays.length, total, checklist } });
  revalidatePath("/", "layout");
  redirect(`/manager/cash?day=${day}`);
}

/** The monthly check that only the right people have office accounts. */
export async function completeAccessReview(fd: FormData) {
  const me = await requireSuperAdmin();
  const checklist = await requireChecklist(fd, "access");
  const reason = await requireSignature(fd, me);
  const staff = await db.user.findMany({ where: { role: "manager" }, select: { name: true, superAdmin: true, status: true } });
  await audit(me.id, "access.reviewed", "system", null, `${kampalaToday().slice(0, 7)}: ${staff.filter((s) => s.status === "active").length} active office account(s), ${staff.filter((s) => s.status === "active" && s.superAdmin).length} super admin(s)`, db,
    { reason, signed: true, after: { checklist, accounts: staff.map((s) => `${s.name} (${s.superAdmin ? "super admin" : "staff"}, ${s.status})`) } });
  revalidatePath("/", "layout");
  redirect("/manager/access-review");
}

/** First sign-in for an office account: replace the temporary password (new staff) and accept the office rules. */
export async function completeOnboarding(fd: FormData) {
  const me = await getUser();
  if (!me) redirect("/login");
  if (me.role !== "manager") redirect(homeFor(me.role));
  const data: { passwordHash?: string; mustChangePassword?: boolean; rulesAcceptedAt?: Date } = {};
  if (me.mustChangePassword) {
    const next = String(fd.get("next") || "");
    if (next.length < 8) return fail("The new password must be at least 8 characters");
    if (next !== String(fd.get("confirm") || "")) return fail("The two passwords don't match");
    if (await bcrypt.compare(next, me.passwordHash)) return fail("Choose a new password, not the temporary one");
    data.passwordHash = await bcrypt.hash(next, 10);
    data.mustChangePassword = false;
  }
  if (!me.rulesAcceptedAt) {
    if (OFFICE_RULES.some((_, i) => fd.get(`rule_${i}`) !== "on")) return fail("Tick every office rule to accept it");
    data.rulesAcceptedAt = new Date();
  }
  await db.user.update({ where: { id: me.id }, data });
  await audit(me.id, "user.onboarded", "user", me.id, data.passwordHash ? "Changed the temporary password and accepted the office rules" : "Accepted the office rules", db, { after: { rules: [...OFFICE_RULES] } });
  redirect("/manager");
}

/**
 * While CasaVilla is still testing (payments in test mode): deletes all test accounts and records in one go.
 * Super admins only, typed confirmation and a password signature. Office accounts stay unless ticked.
 */
export async function clearTestDataNow(fd: FormData) {
  const me = await requireSuperAdmin();
  const { provider } = await import("@/lib/momo");
  if (provider !== "sandbox") return fail("Real payments are switched on, so test data can no longer be cleared from here");
  if (String(fd.get("confirm") || "").trim().toUpperCase() !== "DELETE EVERYTHING") return fail("Type DELETE EVERYTHING to confirm");
  await requireSignature(fd, me);
  const { clearTestData, keptAccounts } = await import("@/lib/handover");
  const keep = await keptAccounts(me.id, fd.get("officeToo") === "on");
  try {
    await clearTestData(me.id, keep);
  } catch (e) {
    console.error("clear test data", e);
    return fail("Nothing was deleted: the clean-up stopped and everything was put back.");
  }
  revalidatePath("/", "layout");
  redirect(`/manager/health?ok=${encodeURIComponent(`Test data cleared. ${keep.length === 1 ? "Only your account remains." : `${keep.length} office accounts kept.`}`)}`);
}
