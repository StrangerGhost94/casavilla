"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { date, id, isUniqueViolation, oneOf, reqText } from "@/lib/validate";
import { payoutMode, sendPayout } from "@/lib/payouts";
import { kampalaToday, networkFor, normalizePhone, ugx } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** Where a landlord receives their money. A manager can set it for a landlord. */
export async function savePayoutAccount(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const landlordId = u.role === "manager" ? id(fd, "landlordId") : u.id;
  if (!(await db.user.findFirst({ where: { id: landlordId, role: "landlord" }, select: { id: true } }))) return fail("Landlord not found");
  const method = await oneOf(fd, "method", ["mtn", "airtel", "bank"] as const, "how to receive money");
  const accountName = await reqText(fd, "accountName", "the name on the account", { max: 100 });
  let data: { method: string; accountName: string; phone: string | null; bankCode: string | null; bankName: string | null; accountNumber: string | null };
  if (method === "bank") {
    const bankName = await reqText(fd, "bankName", "the bank", { max: 80 });
    const bankCode = String(fd.get("bankCode") ?? "").trim();
    const accountNumber = String(fd.get("accountNumber") ?? "").replace(/\s/g, "");
    if (!/^\d{6,20}$/.test(accountNumber)) return fail("Enter the bank account number (numbers only)");
    data = { method, accountName, phone: null, bankName, bankCode: bankCode || null, accountNumber };
  } else {
    const phone = normalizePhone(String(fd.get("phone") ?? ""));
    if (!/^\+256\d{9}$/.test(phone)) return fail("Enter a Ugandan Mobile Money number, e.g. 0772 123456");
    const net = networkFor(phone);
    if (net && net !== method) return fail(`That looks like ${net === "mtn" ? "an MTN" : "an Airtel"} number — choose ${net === "mtn" ? "MTN" : "Airtel"} Mobile Money`);
    data = { method, accountName, phone, bankName: null, bankCode: null, accountNumber: null };
  }
  await db.payoutAccount.upsert({ where: { landlordId }, create: { landlordId, ...data }, update: data });
  await audit(u.id, "payout.account", "user", landlordId, method === "bank" ? `bank ${data.bankName} ••${data.accountNumber!.slice(-4)}` : `${method} ${data.phone}`);
  // Anything waiting can go now.
  await db.payout.updateMany({ where: { landlordId, status: { in: ["queued", "failed"] } }, data: { attempts: 0, error: null } });
  for (const q of await db.payout.findMany({ where: { landlordId, status: { in: ["queued", "failed"] }, amount: { gt: 0 } }, select: { id: true } })) await sendPayout(q.id);
  refresh();
}

async function managerPayout(fd: FormData) {
  const u = await requireUser("manager");
  const po = await db.payout.findUnique({ where: { id: id(fd, "payoutId") } });
  if (!po) return fail("Payout not found");
  return { u, po };
}

/** Try a waiting or failed payout again now (also releases one held by the daily limit). */
export async function retryPayout(fd: FormData) {
  const { u, po } = await managerPayout(fd);
  if (!["queued", "failed"].includes(po.status)) return fail("Only waiting or failed payouts can be sent again");
  await db.payout.update({ where: { id: po.id }, data: { attempts: 0, error: null } });
  await audit(u.id, "payout.retry", "payment", po.paymentId, ugx(po.amount));
  if (payoutMode() === "off") return fail("Payouts are switched off (PAYOUT_MODE). Use “Paid outside the app” if you paid the landlord yourself.");
  await sendPayout(po.id, { byManager: true });
  refresh();
}

/** The landlord was paid outside the app (e.g. a bank transfer from the office): record it. */
export async function markPayoutPaid(fd: FormData) {
  const { u, po } = await managerPayout(fd);
  if (!["queued", "failed"].includes(po.status)) return fail("Only waiting or failed payouts can be marked as paid");
  const ref = await reqText(fd, "ref", "the transfer reference", { max: 80 });
  await db.payout.update({ where: { id: po.id }, data: { status: "paid", providerRef: `MANUAL ${ref}`, method: "manual", destination: "Paid by CasaVilla outside the app", sentAt: new Date(), error: null } });
  await notify(po.landlordId, `${ugx(po.amount)} has been paid to you (ref ${ref}).`, "/landlord/payouts");
  await audit(u.id, "payout.manual", "payment", po.paymentId, `${ugx(po.amount)} ref ${ref}`);
  refresh();
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
