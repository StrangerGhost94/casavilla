"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { date, id, isUniqueViolation, oneOf } from "@/lib/validate";
import { autoIssueEfris, cleanFdn, docName, efrisMode, efrisProfile, validCode, validFdn, validTin } from "@/lib/efris";
import { canStoreKeys, keyFingerprint, newKeyPair, normalizePrivateKey, sealKey } from "@/lib/efris-crypto";
import { testConnection } from "@/lib/efris-ura";
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
  await db.efrisAttempt.deleteMany({ where: { paymentId: p.id } });
  const what = chargeLabel(p.charge.kind, p.charge.period);
  await notify(p.tenantId, `Your ${docName(prof.vatRegistered ? "invoice" : "receipt")} for ${what} is ready (FDN ${fdn}).`, `/receipts/${p.id}`);
  await audit(u.id, "efris.recorded", "payment", p.id, `FDN ${fdn}`);
  refresh();
}

/** Takes off a wrongly entered EFRIS record so the right one can be added. */
export async function removeEfris(fd: FormData) {
  const { u, p } = await paymentFor(fd);
  if (!p.efris) return;
  if (p.efris.source === "api" && !p.efris.test) return fail("This document was issued through URA. Removing it here wouldn't cancel it at URA — raise a credit note in EFRIS instead.");
  // Don't let automatic issuing send a second one for this payment.
  await db.efrisAttempt.upsert({ where: { paymentId: p.id }, create: { paymentId: p.id, status: "stopped", error: "EFRIS record removed by hand" }, update: { status: "stopped", error: "EFRIS record removed by hand" } });
  await db.efrisReceipt.delete({ where: { id: p.efris.id } });
  await audit(u.id, "efris.removed", "payment", p.id, `FDN ${p.efris.fdn}`);
  refresh();
}

// ---------------------------------------------------------------------------------------------------------------
// URA system-to-system connection (CasaVilla managers only). The private key is sealed with EFRIS_KEY_SECRET and
// never shown again; only its fingerprint and public key are displayed.

async function managerLandlord(fd: FormData) {
  const u = await requireUser("manager");
  const landlordId = id(fd, "landlordId");
  const prof = await db.efrisProfile.findUnique({ where: { landlordId } });
  if (!prof || prof.status !== "registered" || !prof.tin) return fail("Save the landlord's EFRIS details (registered, with TIN) first");
  return { u, landlordId, prof };
}

const clip = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max) || null;

export async function saveEfrisConnection(fd: FormData) {
  const { u, landlordId, prof } = await managerLandlord(fd);
  const deviceNo = String(fd.get("deviceNo") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(deviceNo)) return fail("Enter the EFRIS device number URA issued for this TIN (letters, numbers, _ or -)");
  const environment = await oneOf(fd, "environment", ["test", "production"] as const, "the URA environment");
  const code = (k: string) => { const v = clip(fd, k, 20); return v && /^\d{6,12}$/.test(v) ? v : v ? "bad" : null; };
  const res = code("commodityResidential"), com = code("commodityCommercial");
  if (res === "bad" || com === "bad") return fail("EFRIS commodity codes are numbers (e.g. 8 digits)");
  const unitCode = clip(fd, "unitCode", 10);
  if (unitCode && !/^[A-Za-z0-9]{1,10}$/.test(unitCode)) return fail("The measure unit is a short code from URA's list");
  let keyData = {};
  const file = fd.get("keyFile");
  if (file instanceof File && file.size > 0) {
    if (!canStoreKeys()) return fail("Add EFRIS_KEY_SECRET in Railway first (a long random value of at least 32 characters) so keys can be stored encrypted");
    if (file.size > 20_000) return fail("That file is too big to be a key file");
    let pem: string;
    try { pem = normalizePrivateKey(Buffer.from(await file.arrayBuffer()), String(fd.get("keyPassword") ?? "")); }
    catch (e) { return fail((e as Error).message); }
    keyData = { keyEnc: sealKey(pem), keyFingerprint: keyFingerprint(pem), keyAddedAt: new Date() };
  }
  const changed = deviceNo !== prof.deviceNo || environment !== prof.environment || "keyEnc" in keyData;
  await db.efrisProfile.update({
    where: { landlordId },
    data: {
      deviceNo, environment, unitCode,
      commodityResidential: res, commodityResidentialName: clip(fd, "commodityResidentialName"),
      commodityCommercial: com, commodityCommercialName: clip(fd, "commodityCommercialName"),
      legalName: clip(fd, "legalName"), businessName: clip(fd, "businessName"), sellerAddress: clip(fd, "sellerAddress", 300),
      ...keyData,
      // A new device, key or environment must be tested again before automatic issuing uses it.
      ...(changed ? { checkOk: null, checkMessage: null, checkedAt: null } : {}),
    },
  });
  await audit(u.id, "efris.connection", "user", landlordId, `device ${deviceNo} · ${environment}${"keyEnc" in keyData ? " · new key" : ""}`);
  refresh();
}

/** Makes a key pair here: the private key is sealed straight away; the public key is shown for upload to URA. */
export async function generateEfrisKey(fd: FormData) {
  const { u, landlordId } = await managerLandlord(fd);
  if (!canStoreKeys()) return fail("Add EFRIS_KEY_SECRET in Railway first (a long random value of at least 32 characters) so keys can be stored encrypted");
  const pem = newKeyPair();
  await db.efrisProfile.update({ where: { landlordId }, data: { keyEnc: sealKey(pem), keyFingerprint: keyFingerprint(pem), keyAddedAt: new Date(), checkOk: null, checkMessage: "New key made: upload its public key to URA's EFRIS portal for this device, then test the connection.", checkedAt: null } });
  await audit(u.id, "efris.key_generated", "user", landlordId, keyFingerprint(pem));
  refresh();
}

export async function testEfrisConnection(fd: FormData) {
  const { u, landlordId } = await managerLandlord(fd);
  if (efrisMode() !== "ura") return fail("Set EFRIS_MODE=ura in Railway to connect to URA");
  const r = await testConnection(landlordId);
  await audit(u.id, "efris.test", "user", landlordId, `${r.ok ? "ok" : "failed"}: ${r.message}`.slice(0, 300));
  refresh();
}

/** A manager decides to try automatic issuing again for a payment it stopped on. */
export async function retryEfrisPayment(fd: FormData) {
  const u = await requireUser("manager");
  const paymentId = id(fd, "paymentId");
  const a = await db.efrisAttempt.findUnique({ where: { paymentId } });
  if (!a) return;
  await db.efrisAttempt.update({ where: { paymentId }, data: { status: a.status === "uncertain" ? "uncertain" : "failed", attempts: 0 } });
  await autoIssueEfris(paymentId);
  await audit(u.id, "efris.retry", "payment", paymentId, a.error ?? "");
  refresh();
}
