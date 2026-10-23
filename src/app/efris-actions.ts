"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { date, id, isUniqueViolation, oneOf } from "@/lib/validate";
import { cleanFdn, docName, efrisProfile, validCode, validFdn, validTin } from "@/lib/efris";
import { chargeLabel } from "@/lib/rules";
import { kampalaToday } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** A landlord sets up their own EFRIS details; a manager can do it for any landlord. */
export async function saveEfrisProfile(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const landlordId = u.role === "manager" ? id(fd, "landlordId") : u.id;
  const landlord = await db.user.findFirst({ where: { id: landlordId, role: "landlord" }, select: { id: true, name: true } });
  if (!landlord) return fail("Landlord not found");
  const status = await oneOf(fd, "status", ["registered", "exempt"] as const, "whether EFRIS applies");
  const tin = String(fd.get("tin") ?? "").replace(/\s/g, "");
  if (status === "registered" && !validTin(tin)) return fail("Enter the landlord's 10-digit URA TIN");
  if (tin && !validTin(tin)) return fail("A URA TIN has 10 digits");
  const since = (await date(fd, "since", "the date EFRIS receipts start", true)) ?? kampalaToday();
  if (since > kampalaToday()) return fail("The start date can't be in the future");
  if (since < "2020-01-01") return fail("Choose a start date from 2020 onwards");
  const taxMode = await oneOf(fd, "taxMode", ["individual", "none"] as const, "how tax is handled", "individual");
  const data = {
    tin: tin || null, status, vatRegistered: status === "registered" && fd.get("vat") === "on", since: new Date(`${since}T00:00:00Z`),
    taxMode, mode: status === "registered" && fd.get("auto") === "on" ? "api" : "record",
  };
  await db.efrisProfile.upsert({ where: { landlordId }, create: { landlordId, ...data }, update: data });
  // Keep the TIN printed on CasaVilla receipts in step.
  if (tin) await db.brandProfile.updateMany({ where: { ownerId: landlordId }, data: { tin } });
  await audit(u.id, "efris.profile", "user", landlordId, `${status}${tin ? ` · TIN ${tin}` : ""}${data.vatRegistered ? " · VAT" : ""} · from ${since} · tax ${taxMode} · ${data.mode}`);
  refresh();
}

/** Who may record or remove the EFRIS document for a payment: CasaVilla, or that payment's landlord. */
async function paymentFor(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const p = await db.payment.findUnique({
    where: { id: id(fd, "paymentId") },
    include: { efris: true, charge: { select: { kind: true, period: true } }, lease: { select: { landlordId: true } } },
  });
  if (!p || p.status !== "success" || (u.role !== "manager" && p.lease.landlordId !== u.id)) return fail("Payment not found");
  return { u, p };
}

/** Records the EFRIS e-receipt / e-invoice issued for a payment (in URA's EFRIS app, desktop client or portal). */
export async function recordEfris(fd: FormData) {
  const { u, p } = await paymentFor(fd);
  if (p.efris) return fail("This payment already has an EFRIS receipt");
  const fdn = cleanFdn(String(fd.get("fdn") ?? ""));
  if (!validFdn(fdn)) return fail("Enter the Fiscal Document Number (FDN) exactly as it appears on the EFRIS receipt — numbers only");
  const code = String(fd.get("code") ?? "").replace(/\s/g, "");
  if (code && !validCode(code)) return fail("The verification code should be letters and numbers only");
  const issuedOn = (await date(fd, "issuedOn", "the date on the EFRIS receipt")) as string;
  if (issuedOn > kampalaToday()) return fail("The EFRIS receipt date can't be in the future");
  const paidOn = (p.paidAt ?? p.createdAt).toISOString().slice(0, 10);
  if (issuedOn < paidOn) return fail("The EFRIS receipt can't be dated before the payment was made");
  const prof = await efrisProfile(p.lease.landlordId);
  const fileId = await saveUpload(fd.get("file"), p.lease.landlordId, false);
  try {
    await db.efrisReceipt.create({
      data: { paymentId: p.id, fdn, verificationCode: code || null, issuedOn: new Date(`${issuedOn}T00:00:00Z`), kind: prof.vatRegistered ? "invoice" : "receipt", tin: prof.tin, fileId, recordedById: u.id },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail(`FDN ${fdn} is already recorded on another payment — check the number`);
    throw e;
  }
  const what = chargeLabel(p.charge.kind, p.charge.period);
  await notify(p.tenantId, `Your ${docName(prof.vatRegistered ? "invoice" : "receipt")} for ${what} is ready (FDN ${fdn}).`, `/receipts/${p.id}`);
  await audit(u.id, "efris.recorded", "payment", p.id, `FDN ${fdn}`);
  refresh();
}

/** Takes off a wrongly entered EFRIS record so the right one can be added. */
export async function removeEfris(fd: FormData) {
  const { u, p } = await paymentFor(fd);
  if (!p.efris) return;
  await db.efrisReceipt.delete({ where: { id: p.efris.id } });
  await audit(u.id, "efris.removed", "payment", p.id, `FDN ${p.efris.fdn}`);
  refresh();
}
