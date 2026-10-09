"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { workableProperty } from "@/lib/access";
import { EXPENSE_CATEGORIES } from "@/lib/rules";
import { date, id, int, oneOf, reqText } from "@/lib/validate";
import { kampalaToday, ugx } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** Landlords and managers record expenses directly; a caretaker's expense waits for the landlord to approve. */
export async function addExpense(fd: FormData) {
  const u = await requireUser("landlord", "manager", "caretaker");
  const propertyId = id(fd, "propertyId") || null;
  const p = propertyId ? await workableProperty(u, propertyId) : null;
  if (propertyId && !p) return fail("Property not found");
  if (!p && u.role !== "landlord") return fail("Choose the property this was for");
  const landlordId = p?.landlordId ?? u.id;
  const category = await oneOf(fd, "category", EXPENSE_CATEGORIES, "category");
  const description = await reqText(fd, "description", "what it was for", { max: 160 });
  const amount = await int(fd, "amount", "the amount", { min: 100, max: 500_000_000 });
  const spentOn = (await date(fd, "spentOn", "the date", true)) || kampalaToday();
  if (spentOn > kampalaToday()) return fail("The date can't be in the future");
  const receiptFileId = await saveUpload(fd.get("receipt"), u.id, false);
  const pending = u.role === "caretaker";
  const e = await db.expense.create({
    data: { landlordId, propertyId: p?.id ?? null, category, description, amount, spentOn: new Date(`${spentOn}T00:00:00Z`), receiptFileId, createdById: u.id, status: pending ? "pending" : "approved" },
  });
  await audit(u.id, "expense.added", "expense", e.id, `${category}: ${ugx(amount)}${pending ? " (awaiting approval)" : ""}`);
  if (pending) await notify(landlordId, `${u.name} (caretaker) recorded an expense: ${description} — ${ugx(amount)}. Approve it to include it in your statement.`, "/landlord/statements");
  refresh();
}

export async function decideExpense(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const e = await db.expense.findUnique({ where: { id: id(fd) } });
  if (!e || (u.role !== "manager" && e.landlordId !== u.id)) return fail("Expense not found");
  const d = fd.get("decision");
  if (d !== "approve" && d !== "reject") return fail("Choose approve or reject");
  const status = d === "approve" ? "approved" : "rejected";
  await db.expense.update({ where: { id: e.id }, data: { status } });
  await audit(u.id, `expense.${status}`, "expense", e.id, `${e.description}: ${ugx(e.amount)}`);
  if (e.createdById !== u.id) await notify(e.createdById, `Your expense "${e.description}" (${ugx(e.amount)}) was ${status}.`, "/caretaker/expenses");
  refresh();
}

export async function deleteExpense(fd: FormData) {
  const u = await requireUser("landlord", "manager", "caretaker");
  const e = await db.expense.findUnique({ where: { id: id(fd) } });
  const mine = e && (u.role === "manager" || e.landlordId === u.id || (u.role === "caretaker" && e.createdById === u.id && e.status === "pending"));
  if (!e || !mine) return fail("Expense not found");
  await db.expense.delete({ where: { id: e.id } });
  await audit(u.id, "expense.deleted", "expense", e.id, `${e.description}: ${ugx(e.amount)}`);
  refresh();
}

/** CasaVilla's management commission for a landlord (shown as a line on their statements). */
export async function setCommission(fd: FormData) {
  const u = await requireUser("manager");
  const landlordId = id(fd, "landlordId");
  const pct = Number(String(fd.get("pct") ?? "").replace("%", ""));
  if (!Number.isFinite(pct) || pct < 0 || pct > 50) return fail("Enter a commission between 0 and 50%");
  const l = await db.user.findFirst({ where: { id: landlordId, role: "landlord" } });
  if (!l) return fail("Landlord not found");
  await db.user.update({ where: { id: l.id }, data: { commissionPct: Math.round(pct * 100) / 100 } });
  await audit(u.id, "landlord.commission", "user", l.id, `${l.commissionPct}% → ${pct}%`);
  refresh();
}
