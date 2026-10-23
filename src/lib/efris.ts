import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { kampalaToday } from "./format";

/**
 * URA EFRIS (Electronic Fiscal Receipting and Invoicing Solution).
 *
 * Renting real estate is a designated EFRIS sector: a landlord who must use EFRIS issues an e-receipt (or an
 * e-invoice when VAT-registered) under their own TIN for rent received. CasaVilla's own receipt is a payment
 * record; the EFRIS document is the fiscal one.
 *
 * Two ways per landlord (profile.mode):
 * - "record": the document is issued in URA's EFRIS app, desktop client or web portal and its Fiscal Document
 *   Number (FDN) is recorded here, optionally with URA's PDF;
 * - "api": CasaVilla issues it the moment the payment succeeds (`autoIssueEfris`), retrying hourly if URA is
 *   unreachable. EFRIS_MODE decides how:
 *     off (default) — automatic issuing is unavailable; "api" landlords fall back to recording;
 *     sandbox       — a TEST document is made locally (marked TEST everywhere; nothing is sent to URA);
 *     ura           — URA's system-to-system interface (`uraIssue`), once URA has approved CasaVilla and issued
 *                     the device number and keys for the landlord's TIN. See docs/EFRIS.md.
 * The tenant gets one receipt: CasaVilla's, carrying the EFRIS details (FDN, verification code, QR).
 */

export const EFRIS_STATUS: Record<string, string> = {
  unknown: "Not set up",
  registered: "On EFRIS",
  exempt: "Not required",
};

/** Refundable security deposits aren't rental income, so they don't get an EFRIS receipt. */
export const efrisApplies = (chargeKind: string) => chargeKind !== "deposit";

export const docName = (kind: string) => (kind === "invoice" ? "EFRIS e-invoice" : "EFRIS e-receipt");

/** A landlord's profile, or the default ("unknown") when they haven't set it up yet. */
export async function efrisProfile(landlordId: number) {
  return (await db.efrisProfile.findUnique({ where: { landlordId } })) ?? { landlordId, tin: null, status: "unknown", vatRegistered: false, since: new Date(`${kampalaToday()}T00:00:00Z`), mode: "record", taxMode: "individual", updatedAt: new Date() };
}

/** Successful payments that need an EFRIS document and don't have one yet (optionally for one landlord). */
export function missingWhere(landlordId?: number): Prisma.PaymentWhereInput {
  return {
    status: "success",
    efris: null,
    amount: { gt: 0 },
    charge: { kind: { not: "deposit" } },
    lease: {
      ...(landlordId ? { landlordId } : {}),
      landlord: { efrisProfile: { is: { status: "registered" } } },
    },
  };
}

/** Same, but only payments on or after each landlord's EFRIS start date (checked per row, as dates differ). */
export async function missingPayments(landlordId?: number, take = 200) {
  const rows = await db.payment.findMany({
    where: missingWhere(landlordId),
    orderBy: { paidAt: "desc" },
    take,
    include: {
      charge: { select: { kind: true, period: true } },
      tenant: { select: { name: true, phone: true } },
      lease: { select: { landlordId: true, landlord: { select: { name: true, efrisProfile: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } },
    },
  });
  return rows.filter((p) => p.paidAt && p.lease.landlord.efrisProfile && p.paidAt >= p.lease.landlord.efrisProfile.since);
}

export async function missingCount(landlordId?: number) {
  return (await missingPayments(landlordId, 1000)).length;
}

/** Does this payment need an EFRIS document? (its landlord issues them and it was paid on/after their start date) */
export async function needsEfris(paymentId: number) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { status: true, paidAt: true, charge: { select: { kind: true } }, efris: { select: { id: true } }, lease: { select: { landlord: { select: { efrisProfile: true } } } } } });
  const prof = p?.lease.landlord.efrisProfile;
  return !!(p && p.status === "success" && !p.efris && efrisApplies(p.charge.kind) && prof?.status === "registered" && p.paidAt && p.paidAt >= prof.since);
}

/** URA TINs are 10 digits. */
export const validTin = (tin: string) => /^\d{10}$/.test(tin);
/** FDNs are long numbers; allow some spread rather than guess an exact length. Spaces and dashes are dropped. */
export const cleanFdn = (v: string) => v.replace(/[\s-]/g, "");
export const validFdn = (fdn: string) => /^\d{8,24}$/.test(fdn);
export const validCode = (code: string) => /^[A-Za-z0-9]{4,40}$/.test(code);

export type EfrisMode = "off" | "sandbox" | "ura";
export function efrisMode(): EfrisMode {
  const m = (process.env.EFRIS_MODE || "off").toLowerCase();
  return m === "sandbox" || m === "ura" ? m : "off";
}

type Issued = { ok: true; fdn: string; verificationCode: string | null; qr: string | null; test: boolean } | { ok: false; error: string };

/**
 * URA system-to-system issuing. Needs URA's approval for CasaVilla's integration and, for the landlord's TIN,
 * the EFRIS device number and keys (EFRIS_DEVICE_* settings). Until those exist nothing is sent to URA.
 */
async function uraIssue(_paymentId: number): Promise<Issued> {
  return { ok: false, error: "URA hasn't approved CasaVilla's EFRIS connection yet, so receipts can't be issued automatically. Record them for now." };
}

/** Test mode: a local document that looks like the real flow, clearly marked TEST. */
async function sandboxIssue(paymentId: number): Promise<Issued> {
  const n = `TEST${String(paymentId).padStart(8, "0")}${Date.now().toString().slice(-6)}`;
  return { ok: true, fdn: n, verificationCode: `T${Math.random().toString(36).slice(2, 12).toUpperCase()}`, qr: `EFRIS TEST · FDN ${n} · not a URA document`, test: true };
}

/** Issue the EFRIS document for a payment straight away, for landlords set to automatic. Never throws. */
export async function autoIssueEfris(paymentId: number) {
  try {
    const mode = efrisMode();
    if (mode === "off" || !(await needsEfris(paymentId))) return null;
    const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { tenantId: true, lease: { select: { landlordId: true } } } });
    const prof = await efrisProfile(p.lease.landlordId);
    if (prof.mode !== "api") return null;
    const r = mode === "sandbox" ? await sandboxIssue(paymentId) : await uraIssue(paymentId);
    if (!r.ok) { console.error("efris issue", paymentId, r.error); return null; }
    const today = new Date(`${kampalaToday()}T00:00:00Z`);
    const row = await db.efrisReceipt.create({
      data: { paymentId, fdn: r.fdn, verificationCode: r.verificationCode, qr: r.qr, test: r.test, kind: prof.vatRegistered ? "invoice" : "receipt", tin: prof.tin, issuedOn: today, source: "api" },
    });
    return row;
  } catch (e) {
    console.error("efris auto", paymentId, e);
    return null;
  }
}

/** Hourly: try again for automatic landlords' payments still without an EFRIS document (e.g. URA was down). */
export async function retryEfris() {
  if (efrisMode() === "off") return 0;
  const rows = await db.payment.findMany({ where: { ...missingWhere(), lease: { landlord: { efrisProfile: { is: { status: "registered", mode: "api" } } } } }, select: { id: true }, take: 50, orderBy: { paidAt: "desc" } });
  let n = 0;
  for (const r of rows) if (await autoIssueEfris(r.id)) n++;
  return n;
}
