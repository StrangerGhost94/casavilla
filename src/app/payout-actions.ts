"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { date, id, isUniqueViolation, oneOf } from "@/lib/validate";
import { kampalaToday, ugx } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** Landlords are paid by CasaVilla's finance department outside the app, so these payout actions are switched off. */
export async function savePayoutAccount(_fd: FormData) {
  return fail("Landlord payouts are handled by CasaVilla's finance department, outside the app");
}

export async function retryPayout(_fd: FormData) {
  return fail("Landlord payouts are handled by CasaVilla's finance department, outside the app");
}

export async function markPayoutPaid(_fd: FormData) {
  return fail("Landlord payouts are handled by CasaVilla's finance department, outside the app");
}

/** Tax paid to URA from the money set aside, with its PRN. */
export async function recordTaxPayment(fd: FormData) {
  const u = await requireUser("manager");
  const landlordId = id(fd, "landlordId");
  if (!(await db.user.findFirst({ where: { id: landlordId, role: "landlord" }, select: { id: true } }))) return fail("Choose the landlord");
  const kind = await oneOf(fd, "kind", ["rental", "vat"] as const, "which tax");
  const amount = Number(String(fd.get("amount") ?? "").replace(/[,\s]/g, ""));
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000_000) return fail("Enter the amount paid in UGX");
  const prn = String(fd.get("prn") ?? "").replace(/\s/g, "");
  if (!/^\d{8,20}$/.test(prn)) return fail("Enter the URA PRN (payment registration number) — numbers only");
  const paidOn = (await date(fd, "paidOn", "the date it was paid")) as string;
  if (paidOn > kampalaToday()) return fail("The payment date can't be in the future");
  const note = String(fd.get("note") ?? "").trim().slice(0, 200) || null;
  try {
    await db.taxRemittance.create({ data: { landlordId, kind, amount, prn, paidOn: new Date(`${paidOn}T00:00:00Z`), note, recordedById: u.id } });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(`PRN ${prn} is already recorded`);
    throw e;
  }
  await notify(landlordId, `CasaVilla paid ${ugx(amount)} ${kind === "vat" ? "VAT" : "rental income tax"} to URA for you (PRN ${prn}).`, "/landlord/payouts");
  await audit(u.id, "tax.paid", "user", landlordId, `${kind} ${ugx(amount)} PRN ${prn}`);
  refresh();
}
