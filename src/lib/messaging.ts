import "server-only";
import { db } from "@/db";
import { normalizePhone } from "./format";

/**
 * WhatsApp first, SMS as the fallback.
 *
 *  WhatsApp (Meta Cloud API): WHATSAPP_TOKEN + WHATSAPP_PHONE_ID
 *    WHATSAPP_OTP_TEMPLATE       authentication template with a copy-code button   (default "casavilla_code")
 *    WHATSAPP_REMINDER_TEMPLATE  utility template: 5 body values, see docs/MESSAGING.md (default "rent_reminder")
 *    WHATSAPP_NOTICE_TEMPLATE    utility template: 2 body values (name, message)     (default "casavilla_notice")
 *    WHATSAPP_LANG (default "en"), WHATSAPP_API_VERSION (default "v24.0")
 *  SMS (Africa's Talking): AT_USERNAME + AT_API_KEY, optional AT_SENDER_ID. Username "sandbox" uses their test system.
 *
 * With neither set up, nothing is sent: codes are shown on screen in test mode and other messages are kept
 * (status "test") so you can see on System health what would have gone out.
 */
export const waConfigured = () => !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;
export const smsConfigured = () => !!process.env.AT_USERNAME && !!process.env.AT_API_KEY;
export const messagingConfigured = () => waConfigured() || smsConfigured();
/** live = a provider is set up; test = codes are shown on screen (development, or OTP_TEST_MODE=1); off = skip phone codes. */
export const otpMode = (): "live" | "test" | "off" =>
  messagingConfigured() ? "live" : process.env.NODE_ENV !== "production" || process.env.OTP_TEST_MODE === "1" ? "test" : "off";

const TEMPLATES = {
  otp: () => process.env.WHATSAPP_OTP_TEMPLATE || "casavilla_code",
  reminder: () => process.env.WHATSAPP_REMINDER_TEMPLATE || "rent_reminder",
  notice: () => process.env.WHATSAPP_NOTICE_TEMPLATE || "casavilla_notice",
};
const waDigits = (phone: string) => normalizePhone(phone).replace(/\D/g, "");
const ugPhone = (phone: string) => /^\+256\d{9}$/.test(normalizePhone(phone));

type Result = { ok: true; channel: "whatsapp" | "sms"; ref?: string } | { ok: false; error: string };

async function viaWhatsApp(to: string, template: string, params: string[], otp: boolean): Promise<Result> {
  const components: unknown[] = [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }];
  // Copy-code authentication templates need the code a second time, for the button.
  if (otp) components.push({ type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: params[0] }] });
  const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v24.0"}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", recipient_type: "individual", to: waDigits(to), type: "template",
      template: { name: template, language: { code: process.env.WHATSAPP_LANG || "en" }, components },
    }),
    signal: AbortSignal.timeout(15000),
  });
  const j = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number } };
  if (!res.ok || !j.messages?.[0]?.id) return { ok: false, error: `WhatsApp: ${j.error?.message ?? res.status}`.slice(0, 300) };
  return { ok: true, channel: "whatsapp", ref: j.messages[0].id };
}

async function viaSms(to: string, text: string): Promise<Result> {
  const user = process.env.AT_USERNAME!;
  const host = user === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
  const body = new URLSearchParams({ username: user, to: normalizePhone(to), message: text });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
  const res = await fetch(`${host}/version1/messaging`, {
    method: "POST",
    headers: { apiKey: process.env.AT_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body, signal: AbortSignal.timeout(15000),
  });
  const j = (await res.json().catch(() => ({}))) as { SMSMessageData?: { Message?: string; Recipients?: { status: string; statusCode: number; messageId: string }[] } };
  const r = j.SMSMessageData?.Recipients?.[0];
  if (!res.ok || !r || ![100, 101, 102].includes(r.statusCode)) return { ok: false, error: `SMS: ${r?.status ?? j.SMSMessageData?.Message ?? res.status}`.slice(0, 300) };
  return { ok: true, channel: "sms", ref: r.messageId };
}

/** Tries WhatsApp, then SMS. */
async function deliver(m: { to: string; kind: "otp" | "reminder" | "notice"; template?: string | null; params: string[]; text: string }): Promise<Result> {
  const errors: string[] = [];
  if (waConfigured() && m.template) {
    try { const r = await viaWhatsApp(m.to, m.template, m.params, m.kind === "otp"); if (r.ok) return r; errors.push(r.error); }
    catch (e) { errors.push(`WhatsApp: ${(e as Error).message}`); }
  }
  if (smsConfigured()) {
    try { const r = await viaSms(m.to, m.text); if (r.ok) return r; errors.push(r.error); }
    catch (e) { errors.push(`SMS: ${(e as Error).message}`); }
  }
  return { ok: false, error: errors.join(" · ") || "No WhatsApp or SMS provider is set up" };
}

/** Sends a one-time code immediately (the person is waiting for it). The code itself is never stored in the outbox. */
export async function sendCode(phone: string, code: string, userId?: number | null) {
  const text = `${code} is your CasaVilla code. It expires in 10 minutes. Never share it with anyone, even CasaVilla staff.`;
  if (!messagingConfigured()) {
    await db.messageOutbox.create({ data: { userId, toPhone: normalizePhone(phone), kind: "otp", text: text.replace(code, "••••••"), status: "test" } });
    return { ok: true as const, channel: null, test: true };
  }
  const r = await deliver({ to: phone, kind: "otp", template: TEMPLATES.otp(), params: [code], text });
  await db.messageOutbox.create({
    data: {
      userId, toPhone: normalizePhone(phone), kind: "otp", template: TEMPLATES.otp(), text: text.replace(code, "••••••"),
      status: r.ok ? "sent" : "failed", channel: r.ok ? r.channel : null, providerRef: r.ok ? r.ref : null, error: r.ok ? null : r.error, attempts: 1, sentAt: r.ok ? new Date() : null,
    },
  });
  return r.ok ? { ok: true as const, channel: r.channel, test: false } : { ok: false as const, error: r.error };
}

/**
 * Queues a reminder or notice for someone who agreed to WhatsApp/SMS messages. dedupeKey makes it once-only.
 * Reminders use the rent_reminder template: [name, amount, what, when, link]; notices: [name, message].
 */
export async function queueMessage(o: { userId: number; kind: "reminder" | "notice"; params: string[]; text: string; dedupeKey?: string }) {
  // "Hello Brian, Your bill…" → "Hello Brian, your bill…" (but leave "UGX", "CasaVilla" etc. alone).
  const lower = (t: string) => t.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase());
  if (o.kind === "notice" && o.params[1]) o = { ...o, params: [o.params[0], lower(o.params[1]), ...o.params.slice(2)], text: o.text.replace(/^(Hello [^,]+, )(.*)$/s, (_, a, b) => a + lower(b)) };
  const u = await db.user.findUnique({ where: { id: o.userId }, select: { phone: true, messageOptIn: true, status: true } });
  if (!u || !u.messageOptIn || u.status === "suspended" || !ugPhone(u.phone)) return null;
  const r = await db.messageOutbox.createMany({
    data: [{ userId: o.userId, toPhone: normalizePhone(u.phone), kind: o.kind, template: TEMPLATES[o.kind](), params: o.params.map((p) => p.slice(0, 200)), text: o.text.slice(0, 600), dedupeKey: o.dedupeKey }],
    skipDuplicates: true,
  });
  return r.count > 0;
}

const kampalaHour = () => (new Date().getUTCHours() + 3) % 24;

/**
 * Sends what's waiting (called by housekeeping). Reminders only go out 8am–8pm Kampala time; anything still
 * waiting after two days is dropped as out of date. Without a provider, messages are marked "test".
 */
export async function sendQueuedMessages(limit = 40) {
  await db.messageOutbox.updateMany({ where: { status: "queued", createdAt: { lt: new Date(Date.now() - 48 * 3600000) } }, data: { status: "expired" } });
  if (!messagingConfigured()) {
    const r = await db.messageOutbox.updateMany({ where: { status: "queued" }, data: { status: "test" } });
    return r.count;
  }
  const h = kampalaHour();
  if (h < 8 || h >= 20) return 0;
  const batch = await db.messageOutbox.findMany({ where: { status: "queued", attempts: { lt: 3 } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0;
  for (const m of batch) {
    const r = await deliver({ to: m.toPhone, kind: m.kind as "reminder" | "notice", template: m.template, params: m.params, text: m.text });
    const attempts = m.attempts + 1;
    await db.messageOutbox.update({
      where: { id: m.id },
      data: r.ok ? { status: "sent", channel: r.channel, providerRef: r.ref ?? null, attempts, sentAt: new Date(), error: null }
        : { attempts, error: r.error, status: attempts >= 3 ? "failed" : "queued" },
    });
    if (r.ok) sent++;
  }
  return sent;
}

/** Public link for messages (they open outside the app). */
export const appUrl = (path: string) => `${(process.env.APP_URL || "https://casavilla-production.up.railway.app").replace(/\/$/, "")}${path}`;
