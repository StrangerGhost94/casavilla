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
 * Today (mode "record") the landlord — or CasaVilla on their behalf — issues the document in URA's EFRIS app,
 * desktop client or web portal and records its Fiscal Document Number (FDN) here, optionally with URA's PDF.
 * Automatic issuing (mode "api", URA system-to-system) plugs in at `issueAutomatically` once URA has approved
 * access and supplied the device number and keys for a TIN — see docs/EFRIS.md.
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
  return (await db.efrisProfile.findUnique({ where: { landlordId } })) ?? { landlordId, tin: null, status: "unknown", vatRegistered: false, since: new Date(`${kampalaToday()}T00:00:00Z`), mode: "record", updatedAt: new Date() };
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

/**
 * Future: issue the document straight from CasaVilla through URA's system-to-system interface.
 * Not available until URA approves access for the landlord's TIN; until then nothing is sent to URA.
 */
export async function issueAutomatically(_paymentId: number): Promise<{ ok: false; reason: string }> {
  return { ok: false, reason: "Automatic EFRIS issuing isn't switched on yet. Issue it in URA's EFRIS and record the FDN." };
}
