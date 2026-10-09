"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { homeFor, startSession } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { notify } from "@/lib/notify";
import { attachWaitingTenants, requestLink } from "@/lib/links";
import { otpMode } from "@/lib/messaging";
import { checkCode, issueCode, maskPhone, phoneTicket, readTicket } from "@/lib/otp";

export type FormState = { error?: string } | undefined;
/** Sign-up and reset forms move to a "verify" step once a code has been sent. */
export type CodeState = { error?: string; step?: "verify" | "choose" | "done"; sentTo?: string; channel?: string | null; testCode?: string; sentAt?: number; ticket?: string; accounts?: { id: number; label: string }[] } | undefined;

const safeNext = (n: FormDataEntryValue | null) => {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "";
};

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  // Email, or the phone number (caretakers often have no email). Several accounts can share a phone: the password picks.
  let u = null;
  if (id.includes("@")) {
    const found = await db.user.findUnique({ where: { email: id } });
    if (found && (await bcrypt.compare(password, found.passwordHash))) u = found;
  } else if (id.replace(/\D/g, "").length >= 9) {
    for (const c of await db.user.findMany({ where: { phone: normalizePhone(id) }, orderBy: { id: "asc" }, take: 5 })) {
      if (await bcrypt.compare(password, c.passwordHash)) { u = c; break; }
    }
  }
  if (!u) return { error: "Wrong email/phone or password." };
  if (u.status === "suspended") return { error: "This account is suspended. Contact CasaVilla." };
  await startSession(u, fd.get("remember") === "on");
  redirect(safeNext(fd.get("next")) || homeFor(u.role));
}

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().min(9, "Enter a valid phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["tenant", "landlord", "provider"]),
  businessName: z.string().trim().optional(),
  area: z.string().trim().optional(),
  landlordPhone: z.string().trim().optional(),
  unitNote: z.string().trim().max(120, "Keep the house / unit description short").optional(),
});

export async function register(prev: CodeState, fd: FormData): Promise<CodeState> {
  const parsed = schema.safeParse(Object.fromEntries(fd));
  const keep = prev?.step === "verify" ? prev : undefined;
  if (!parsed.success) return { ...keep, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const phone = normalizePhone(d.phone);
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter a valid Ugandan phone number, e.g. 0772 123 456" };
  if (d.role === "provider" && !d.businessName) return { error: "Enter your business name" };
  const linking = d.role === "tenant" && fd.get("existing") === "on";
  if (linking) {
    const lp = normalizePhone(d.landlordPhone || "");
    if (!/^\+256\d{9}$/.test(lp)) return { error: "Enter your landlord's phone number, e.g. 0772 123 456" };
    if (lp === phone) return { error: "Enter your landlord's number, not your own" };
  }
  const exists = await db.user.findUnique({ where: { email: d.email }, select: { id: true } });
  if (exists) return { error: "An account with this email already exists. Sign in instead." };

  // Confirm the phone number with a WhatsApp/SMS code before the account is created.
  let verified = false;
  if (otpMode() !== "off") {
    const code = String(fd.get("code") || "");
    if (!code || fd.get("intent") === "resend" || !keep) {
      const r = await issueCode(phone, "signup");
      if (!r.ok) return { ...keep, error: r.error };
      return { step: "verify", sentTo: maskPhone(phone), channel: r.channel, testCode: r.testCode, sentAt: Date.now() };
    }
    const ok = await checkCode(phone, "signup", code);
    if (!ok.ok) return { ...keep, error: ok.error };
    verified = true;
  }

  const u = await db.user.create({ data: {
    name: d.name, email: d.email, phone, passwordHash: await bcrypt.hash(d.password, 10), role: d.role,
    // Landlords and providers are reviewed by CasaVilla before they appear publicly.
    status: d.role === "tenant" ? "active" : "pending",
    businessName: d.businessName || null, area: d.area || null,
    phoneVerifiedAt: verified ? new Date() : null,
    messageOptIn: fd.get("optIn") !== "off",
  } });
  if (d.role !== "tenant") {
    const managers = await db.user.findMany({ where: { role: "manager" }, select: { id: true } });
    for (const m of managers) await notify(m.id, `New ${d.role} sign-up awaiting approval: ${d.businessName || d.name}`, "/manager/people");
  }
  // Existing tenants are connected to their landlord; new landlords pick up tenants already waiting for them.
  if (linking) await requestLink(u, d.landlordPhone!, d.unitNote || null);
  if (d.role === "landlord") await attachWaitingTenants(u);
  await startSession(u);
  redirect(safeNext(fd.get("next")) || homeFor(u.role));
}

const accountLabel = (u: { role: string; email: string; name: string }) =>
  `${u.name} · ${u.role === "provider" ? "service provider" : u.role} · ${u.email.endsWith("@phone.casavilla") ? "no email" : u.email.replace(/^(.).*(@.*)$/, "$1•••$2")}`;

/**
 * Forgot password: phone → code on WhatsApp/SMS → new password. If several accounts use the number, the person
 * picks which one after proving the phone is theirs. Never reveals whether a number has an account before that.
 */
export async function resetPassword(prev: CodeState, fd: FormData): Promise<CodeState> {
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter the phone number on your account, e.g. 0772 123 456" };
  const intent = String(fd.get("intent") || "");

  if (!prev?.step || intent === "resend") {
    const users = await db.user.findMany({ where: { phone, status: { not: "suspended" } }, select: { id: true } });
    // Same answer either way, so the form can't be used to find out who has an account.
    if (!users.length) return { step: "verify", sentTo: maskPhone(phone), channel: null, sentAt: Date.now() };
    const r = await issueCode(phone, "reset", users[0].id);
    if (!r.ok) return { ...prev, error: r.error };
    return { step: "verify", sentTo: maskPhone(phone), channel: r.channel, testCode: r.testCode, sentAt: Date.now() };
  }

  let ticket = String(fd.get("ticket") || "");
  if (prev.step === "verify") {
    const ok = await checkCode(phone, "reset", String(fd.get("code") || ""));
    if (!ok.ok) return { ...prev, error: ok.error };
    ticket = phoneTicket(phone);
  }
  if (readTicket(ticket) !== phone) return { error: "That took too long — start again." };
  const users = await db.user.findMany({ where: { phone, status: { not: "suspended" } }, orderBy: { id: "asc" }, select: { id: true, role: true, email: true, name: true } });
  if (!users.length) return { error: "No account uses this number." };
  const password = String(fd.get("password") || "");
  const chosen = users.length === 1 ? users[0] : users.find((u) => u.id === Number(fd.get("account")));
  if (!chosen || password.length < 8) {
    return { step: "choose", ticket, sentTo: prev.sentTo, accounts: users.length > 1 ? users.map((u) => ({ id: u.id, label: accountLabel(u) })) : undefined,
      error: prev.step === "choose" ? (!chosen ? "Choose the account to reset" : "The new password must be at least 8 characters") : undefined };
  }
  const u = await db.user.update({ where: { id: chosen.id }, data: { passwordHash: await bcrypt.hash(password, 10), phoneVerifiedAt: new Date() } });
  await db.auditLog.create({ data: { actorId: u.id, action: "user.password_reset", entity: "user", entityId: u.id, detail: "by phone code" } });
  await startSession(u);
  redirect(homeFor(u.role));
}

/** Sends a code to confirm the phone number on an existing account (from the profile). */
export async function startPhoneCheck(_: CodeState, fd: FormData): Promise<CodeState> {
  const { requireUser } = await import("@/lib/auth");
  const u = await requireUser();
  if (fd.get("code")) {
    const ok = await checkCode(u.phone, "signup", String(fd.get("code")));
    if (!ok.ok) return { step: "verify", sentTo: maskPhone(u.phone), error: ok.error };
    await db.user.update({ where: { id: u.id }, data: { phoneVerifiedAt: new Date() } });
    return { step: "done" };
  }
  const r = await issueCode(u.phone, "signup", u.id);
  if (!r.ok) return { error: r.error };
  return { step: "verify", sentTo: maskPhone(u.phone), channel: r.channel, testCode: r.testCode, sentAt: Date.now() };
}
