import "server-only";
import { randomInt } from "node:crypto";
import { db } from "@/db";

// No look-alikes (O/0, I/1), so codes read out over the phone are typed right.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Tidies what someone typed: "cv 7k2 m9p" → "CV-7K2M9P". */
export function normalizeLandlordCode(raw: string) {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^CV/, "");
  return s ? `CV-${s}` : "";
}

/**
 * A landlord's private CasaVilla code: existing tenants enter it to join, so the landlord's phone number is never
 * shared. Made the first time it's needed.
 */
const fresh = () => `CV-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/** Gives a landlord a new code; the old one stops working. */
export async function replaceLandlordCode(landlordId: number): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = fresh();
    // A clash with another landlord's code (unique) just tries again.
    const ok = await db.user.update({ where: { id: landlordId }, data: { landlordCode: code } }).then(() => true, () => false);
    if (ok) return code;
  }
  throw new Error("Couldn't make a landlord code");
}

export async function landlordCodeFor(landlordId: number): Promise<string> {
  const u = await db.user.findUnique({ where: { id: landlordId }, select: { landlordCode: true } });
  if (u?.landlordCode) return u.landlordCode;
  for (let i = 0; i < 5; i++) {
    const code = fresh();
    const done = await db.user.updateMany({ where: { id: landlordId, landlordCode: null }, data: { landlordCode: code } }).catch(() => ({ count: -1 }));
    if (done.count >= 0) return (await db.user.findUniqueOrThrow({ where: { id: landlordId }, select: { landlordCode: true } })).landlordCode!;
  }
  throw new Error("Couldn't make a landlord code");
}
