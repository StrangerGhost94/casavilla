"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSuperAdmin, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { requireSignature } from "@/lib/signature";
import { saveUpload } from "@/lib/uploads";
import { workableProperty } from "@/lib/access";
import { EXPENSE_CATEGORIES } from "@/lib/rules";
import { date, id, int, oneOf, reqText } from "@/lib/validate";
import { kampalaToday, ugx } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** The CasaVilla office records expenses on landlords' statements. */
export async function addExpense(fd: FormData) {
  const u = await requireUser("manager");
  const propertyId = id(fd, "propertyId") || null;
  const p = propertyId ? await workableProperty(u, propertyId) : null;
  if (propertyId && !p) return fail("Property not found");
  if (!p) return fail("Choose the property this was for");
  const landlordId = p?.landlordId ?? u.id;
  const category = await oneOf(fd, "category", EXPENSE_CATEGORIES, "category");
  const description = await reqText(fd, "description", "what it was for", { max: 160 });
  const amount = await int(fd, "amount", "the amount", { min: 100, max: 500_000_000 });
  const spentOn = (await date(fd, "spentOn", "the date", true)) || kampalaToday();
  if (spentOn > kampalaToday()) return fail("The date can't be in the future");
  const receiptFileId = await saveUpload(fd.get("receipt"), u.id, false);
  // Entered by the CasaVilla office, so it counts on the statement straight away.
  const e = await db.expense.create({
    data: { landlordId, propertyId: p?.id ?? null, category, description, amount, spentOn: new Date(`${spentOn}T00:00:00Z`), receiptFileId, createdById: u.id, status: "approved" },
  });
  await audit(u.id, "expense.added", "expense", e.id, `${category}: ${ugx(amount)}`);
  refresh();
}

export async function deleteExpense(fd: FormData) {
  const u = await requireUser("manager");
  const e = await db.expense.findUnique({ where: { id: id(fd) } });
  if (!e) return fail("Expense not found");
  await db.expense.delete({ where: { id: e.id } });
  await audit(u.id, "expense.deleted", "expense", e.id, `${e.description}: ${ugx(e.amount)}`);
  refresh();
}

/** CasaVilla's management commission for a landlord (shown as a line on their statements). */
export async function setCommission(fd: FormData) {
  const u = await requireSuperAdmin();
  const landlordId = id(fd, "landlordId");
  const pct = Number(String(fd.get("pct") ?? "").replace("%", ""));
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return fail("Enter a commission between 0 and 50%");
  const l = await db.user.findFirst({ where: { id: landlordId, role: { in: ["landlord", "agent"] } } });
  if (!l) return fail("Landlord not found");
  const reason = await requireSignature(fd, u);
  const next = Math.round(pct * 100) / 100;
  await db.user.update({ where: { id: l.id }, data: { commissionPct: next } });
  await audit(u.id, "landlord.commission", "user", l.id, `${l.name}: ${l.commissionPct}% → ${next}%`, db, { reason, signed: true, before: { commissionPct: l.commissionPct }, after: { commissionPct: next } });
  refresh();
}
