import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { kampalaToday } from "./format";
import { notify, notifyManagers } from "./notify";

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
 *     ura           — URA's system-to-system interface (lib/efris-ura.ts), using each landlord's own EFRIS device
 *                     and key (set by CasaVilla on the EFRIS page; the key is stored encrypted). See docs/EFRIS.md.
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
  return (await db.efrisProfile.findUnique({ where: { landlordId } })) ?? { landlordId, tin: null, status: "unknown", vatRegistered: false, since: new Date(`${kampalaToday()}T00:00:00Z`), mode: "record", taxMode: "individual", updatedAt: new Date(),
    deviceNo: null, environment: "test", keyEnc: null, keyFingerprint: null, keyAddedAt: null, legalName: null, businessName: null, sellerAddress: null, unitCode: null,
    commodityResidential: null, commodityResidentialName: null, commodityCommercial: null, commodityCommercialName: null, uraDict: null, checkedAt: null, checkOk: null, checkMessage: null };
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
  // Only the two dates needed, so it's cheap enough to run on every page (sidebar badge).
  const rows = await db.payment.findMany({ where: missingWhere(landlordId), select: { paidAt: true, lease: { select: { landlord: { select: { efrisProfile: { select: { since: true } } } } } } } });
  return rows.filter((p) => p.paidAt && p.lease.landlord.efrisProfile && p.paidAt >= p.lease.landlord.efrisProfile.since).length;
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

type Issued = { ok: true; fdn: string; verificationCode: string | null; qr: string | null; test: boolean; invoiceId?: string | null } | { ok: false; error: string; uncertain?: boolean; fixable?: boolean };

/** Test mode: a local document that looks like the real flow, clearly marked TEST. */
async function sandboxIssue(paymentId: number): Promise<Issued> {
  const n = `TEST${String(paymentId).padStart(8, "0")}${Date.now().toString().slice(-6)}`;
  return { ok: true, fdn: n, verificationCode: `T${Math.random().toString(36).slice(2, 12).toUpperCase()}`, qr: `EFRIS TEST · FDN ${n} · not a URA document`, test: true };
}

/** After this many failed tries (about six hours of hourly retries) CasaVilla stops and asks for it to be recorded by hand. */
const MAX_TRIES = 6;

/** Is automatic issuing working for this landlord right now? (If so, nobody should issue it by hand meanwhile.) */
export async function autoActive(landlordId: number) {
  const mode = efrisMode();
  if (mode === "off") return false;
  const prof = await db.efrisProfile.findUnique({ where: { landlordId } });
  if (!prof || prof.status !== "registered" || prof.mode !== "api") return false;
  return mode === "sandbox" || !!(prof.deviceNo && prof.keyEnc && prof.checkOk);
}

/** Should the landlord be told to issue this payment's EFRIS receipt by hand? */
export async function needsManualEfris(paymentId: number) {
  if (!(await needsEfris(paymentId))) return false;
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { lease: { select: { landlordId: true } } } });
  if (!(await autoActive(p.lease.landlordId))) return true;
  const a = await db.efrisAttempt.findUnique({ where: { paymentId } });
  return a?.status === "stopped";
}

/**
 * Issue the EFRIS document for a payment straight away, for landlords set to automatic. Never throws.
 * Failures are kept in efris_attempts and retried hourly; a document that may already exist at URA ("uncertain")
 * is looked up before anything is sent again.
 */
export async function autoIssueEfris(paymentId: number) {
  try {
    const mode = efrisMode();
    if (mode === "off" || !(await needsEfris(paymentId))) return null;
    const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, select: { tenantId: true, lease: { select: { landlordId: true, landlord: { select: { name: true } } } } } });
    const prof = await efrisProfile(p.lease.landlordId);
    if (prof.mode !== "api") return null;
    // Not connected yet: the landlord was told to issue it by hand, so don't also send it.
    if (!(await autoActive(p.lease.landlordId))) return null;
    const before = await db.efrisAttempt.findUnique({ where: { paymentId } });
    if (before?.status === "stopped") return null;
    let r: Issued;
    if (mode === "sandbox") r = await sandboxIssue(paymentId);
    else {
      const { uraIssue } = await import("./efris-ura");
      r = await uraIssue(paymentId, before?.status === "uncertain");
    }
    if (!r.ok) {
      const attempts = (before?.attempts ?? 0) + 1;
      // An uncertain one is never given up on automatically: it must be checked with URA first.
      const status = r.uncertain ? "uncertain" : attempts >= MAX_TRIES || r.fixable ? "stopped" : "failed";
      await db.efrisAttempt.upsert({ where: { paymentId }, create: { paymentId, status, attempts, error: r.error.slice(0, 500) }, update: { status, attempts, error: r.error.slice(0, 500) } });
      console.error("efris issue", paymentId, status, r.error);
      if (status === "stopped") {
        await notifyManagers(`EFRIS receipt for ${p.lease.landlord.name}'s payment couldn't be issued automatically: ${r.error}`, "/manager/efris");
        await notify(p.lease.landlordId, "An EFRIS receipt couldn't be issued automatically. Issue it in URA's EFRIS app, then record its FDN.", "/landlord/efris");
      } else if (status === "uncertain" && before?.status !== "uncertain") {
        await notifyManagers(`URA didn't confirm an EFRIS receipt for ${p.lease.landlord.name}. CasaVilla will check with URA before sending it again — don't issue it by hand.`, "/manager/efris");
      }
      return null;
    }
    const row = await db.efrisReceipt.create({
      data: { paymentId, fdn: r.fdn, verificationCode: r.verificationCode, qr: r.qr, test: r.test, invoiceId: r.invoiceId ?? null, kind: prof.vatRegistered ? "invoice" : "receipt", tin: prof.tin, issuedOn: new Date(`${kampalaToday()}T00:00:00Z`), source: "api" },
    });
    await db.efrisAttempt.deleteMany({ where: { paymentId } });
    if (before) await notify(p.tenantId, `Your ${docName(row.kind)} is ready (FDN ${row.fdn}).`, `/receipts/${paymentId}`);
    return row;
  } catch (e) {
    console.error("efris auto", paymentId, e);
    return null;
  }
}

/** Hourly: try again for automatic landlords' payments still without an EFRIS document (e.g. URA was down). */
export async function retryEfris() {
  if (efrisMode() === "off") return 0;
  const stopped = await db.efrisAttempt.findMany({ where: { status: "stopped" }, select: { paymentId: true } });
  const rows = await db.payment.findMany({
    where: { ...missingWhere(), id: { notIn: stopped.map((s) => s.paymentId) }, lease: { landlord: { efrisProfile: { is: { status: "registered", mode: "api" } } } } },
    select: { id: true }, take: 50, orderBy: { paidAt: "desc" },
  });
  let n = 0;
  for (const r of rows) if (await autoIssueEfris(r.id)) n++;
  return n;
}

/** Payments where automatic issuing is stuck, for the manager's EFRIS page. */
export function efrisProblems(landlordId?: number) {
  return db.efrisAttempt.findMany({ orderBy: { updatedAt: "desc" }, take: 100 }).then(async (rows) => {
    if (!rows.length) return [];
    const pays = await db.payment.findMany({
      where: { id: { in: rows.map((r) => r.paymentId) }, efris: null, ...(landlordId ? { lease: { landlordId } } : {}) },
      select: { id: true, amount: true, paidAt: true, tenant: { select: { name: true } }, lease: { select: { landlord: { select: { name: true } }, unit: { select: { label: true } } } } },
    });
    return rows.flatMap((r) => { const p = pays.find((x) => x.id === r.paymentId); return p ? [{ ...r, payment: p }] : []; });
  });
}

/** The warning printed on a test document: our own sandbox, or URA's EFRIS test environment. */
export const testLine = (e: { source: string; qr: string | null } | null | undefined) =>
  e?.source === "api" && !e.qr?.startsWith("EFRIS TEST")
    ? "TEST RECEIPT — issued on URA's EFRIS test environment, not a live fiscal receipt"
    : "TEST RECEIPT — made in EFRIS test mode, not issued by URA";

export type EfrisStep = { key: "details" | "connection" | "tested" | "automatic"; label: string; done: boolean };

/**
 * How far a landlord is with automatic EFRIS, in the order it's set up, plus the one thing to do next.
 * `next` is null when there's nothing to do (fully automatic, or EFRIS doesn't apply).
 */
export function efrisSetup(p: { status: string; tin: string | null; mode: string; deviceNo: string | null; keyEnc: string | null; checkOk: boolean | null }) {
  const sandbox = efrisMode() === "sandbox";
  const steps: EfrisStep[] = [
    { key: "details", label: "TIN & details", done: p.status === "registered" && !!p.tin },
    { key: "connection", label: "Device & key", done: sandbox || !!(p.deviceNo && p.keyEnc) },
    { key: "tested", label: "Tested with URA", done: sandbox || !!p.checkOk },
    { key: "automatic", label: "Automatic on", done: p.mode === "api" },
  ];
  if (p.status === "exempt") return { steps, done: steps.length, next: null };
  const nextStep = steps.find((s) => !s.done);
  const next = !nextStep ? null
    : nextStep.key === "details" ? (p.status === "unknown" ? "Say whether they're on EFRIS and add their TIN" : "Add their 10-digit URA TIN")
    : nextStep.key === "connection" ? (!p.deviceNo ? "Enter their EFRIS device number and key" : "Upload or make their private key")
    : nextStep.key === "tested" ? (p.checkOk === false ? "Connection failed: fix it and test again" : "Press Test connection")
    : "Tick “Issue EFRIS receipts automatically”";
  return { steps, done: steps.filter((s) => s.done).length, next };
}

/** Whole days since a date (Kampala calendar is close enough for "waiting N days"). */
export const daysSince = (d: Date | null) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : 0);
