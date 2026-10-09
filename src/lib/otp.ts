import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { normalizePhone } from "./format";
import { otpMode, sendCode } from "./messaging";

export type Purpose = "signup" | "reset";
const TTL_MIN = 10, MAX_TRIES = 5, COOLDOWN_S = 45, PER_10MIN = 3, PER_DAY = 10;
const secret = () => process.env.AUTH_SECRET || "dev-secret-change-me-dev-secret-change-me";
const hash = (phone: string, purpose: Purpose, code: string) => createHmac("sha256", secret()).update(`${phone}|${purpose}|${code}`).digest("hex");

/** "+256772123456" → "0772 •••456" for showing where a code went. */
export const maskPhone = (p: string) => { const l = normalizePhone(p).replace("+256", "0"); return `${l.slice(0, 4)} •••${l.slice(-3)}`; };

/**
 * Sends a fresh 6-digit code, with limits so nobody can flood a number: one every 45s, 3 per 10 minutes, 10 a day.
 * In test mode (no provider set up) the code comes back in `testCode` so it can be shown on screen.
 */
export async function issueCode(rawPhone: string, purpose: Purpose, userId?: number | null): Promise<{ ok: true; channel: string | null; testCode?: string } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  const now = Date.now();
  const recent = await db.phoneCode.findMany({ where: { phone, purpose, createdAt: { gt: new Date(now - 86400000) } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } });
  if (recent[0] && now - recent[0].createdAt.getTime() < COOLDOWN_S * 1000) {
    return { ok: false, error: `Please wait ${Math.ceil(COOLDOWN_S - (now - recent[0].createdAt.getTime()) / 1000)} seconds before asking for another code.` };
  }
  if (recent.filter((r) => now - r.createdAt.getTime() < 600000).length >= PER_10MIN) return { ok: false, error: "Too many codes requested. Please wait 10 minutes and try again." };
  if (recent.length >= PER_DAY) return { ok: false, error: "Too many codes requested for this number today. Try again tomorrow or contact CasaVilla." };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  // Any older codes stop working once a new one is sent.
  await db.phoneCode.updateMany({ where: { phone, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.phoneCode.create({ data: { phone, purpose, codeHash: hash(phone, purpose, code), expiresAt: new Date(now + TTL_MIN * 60000) } });
  const sent = await sendCode(phone, code, userId);
  if (!sent.ok) return { ok: false, error: "We couldn't send the code just now. Check the number and try again in a minute." };
  return { ok: true, channel: sent.channel, ...(otpMode() === "test" ? { testCode: code } : {}) };
}

/** Checks a code and uses it up. Five wrong tries and the code stops working. */
export async function checkCode(rawPhone: string, purpose: Purpose, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const phone = normalizePhone(rawPhone);
  const code = raw.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Enter the 6-digit code." };
  const c = await db.phoneCode.findFirst({ where: { phone, purpose, consumedAt: null }, orderBy: { createdAt: "desc" } });
  if (!c || c.expiresAt < new Date()) return { ok: false, error: "That code has expired. Tap “Send a new code”." };
  if (c.attempts >= MAX_TRIES) return { ok: false, error: "Too many wrong tries. Tap “Send a new code”." };
  const a = Buffer.from(c.codeHash, "hex"), b = Buffer.from(hash(phone, purpose, code), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    // Counted atomically so parallel guesses can't get extra tries.
    const r = await db.phoneCode.updateMany({ where: { id: c.id, attempts: { lt: MAX_TRIES } }, data: { attempts: { increment: 1 } } });
    const left = MAX_TRIES - c.attempts - 1;
    return { ok: false, error: r.count && left > 0 ? `Wrong code — ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Tap “Send a new code”." };
  }
  const used = await db.phoneCode.updateMany({ where: { id: c.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (!used.count) return { ok: false, error: "That code was already used. Tap “Send a new code”." };
  return { ok: true };
}

/** Short-lived proof that a phone was verified, for the step after the code (choosing which account to reset). */
export function phoneTicket(phone: string, minutes = 10) {
  const exp = Date.now() + minutes * 60000;
  const p = normalizePhone(phone);
  return `${p}.${exp}.${createHmac("sha256", secret()).update(`ticket|${p}|${exp}`).digest("hex").slice(0, 32)}`;
}
export function readTicket(t: string): string | null {
  const [p, exp, sig] = t.split(".");
  if (!p || !exp || !sig || Number(exp) < Date.now()) return null;
  const want = createHmac("sha256", secret()).update(`ticket|${p}|${exp}`).digest("hex").slice(0, 32);
  return want.length === sig.length && timingSafeEqual(Buffer.from(want), Buffer.from(sig)) ? p : null;
}
