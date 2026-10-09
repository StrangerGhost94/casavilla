import "server-only";
import { db } from "@/db";

/**
 * Email is queued now and delivered when a provider is configured:
 *   RESEND_API_KEY + MAIL_FROM (e.g. "CasaVilla <receipts@yourdomain.ug>") → sent through Resend.
 * Without them, messages simply wait in the outbox (visible on System health) and go out once the key is added.
 */
export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function queueEmail(o: { to: string | null | undefined; subject: string; html: string; attachKind?: "receipt" | "booking"; attachId?: number }) {
  if (!o.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.to)) return null;
  return db.emailOutbox.create({ data: { toEmail: o.to, subject: o.subject.slice(0, 200), html: o.html, attachKind: o.attachKind, attachId: o.attachId } });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Plain, phone-friendly email body in the brand colour. */
export function emailHtml(o: { accent?: string; title: string; lines: string[]; button?: { label: string; href: string }; footer?: string }) {
  const accent = o.accent ?? "#124331";
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1c1917">
  <div style="background:${accent};color:#fff;padding:18px 20px;border-radius:12px 12px 0 0;font-size:18px;font-weight:bold">${esc(o.title)}</div>
  <div style="border:1px solid #e7e5e4;border-top:0;padding:20px;border-radius:0 0 12px 12px;font-size:14px;line-height:1.55">
  ${o.lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}
  ${o.button ? `<p style="margin:18px 0"><a href="${esc(o.button.href)}" style="background:${accent};color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${esc(o.button.label)}</a></p>` : ""}
  <p style="margin:16px 0 0;color:#78716c;font-size:12px">${esc(o.footer ?? "CasaVilla Property Management · Rubaga Road, Kampala")}</p></div></div>`;
}

/** Sends what's waiting (called by housekeeping). PDFs are rebuilt at send time from the live records. */
export async function sendQueuedEmails(limit = 20) {
  if (!mailConfigured()) return 0;
  const batch = await db.emailOutbox.findMany({ where: { status: "queued", attempts: { lt: 5 } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0;
  for (const m of batch) {
    try {
      const attachments: { filename: string; content: string }[] = [];
      if (m.attachKind === "receipt" && m.attachId) {
        const { receiptData, receiptPdf } = await import("./receipts");
        const r = await receiptData(m.attachId);
        if (r) attachments.push({ filename: `receipt-${r.p.receiptNo}.pdf`, content: Buffer.from(await receiptPdf(r)).toString("base64") });
      }
      if (m.attachKind === "booking" && m.attachId) {
        const { bookingData, bookingPdf } = await import("./stays");
        const b = await bookingData(m.attachId);
        if (b) attachments.push({ filename: `booking-${b.b.reference}.pdf`, content: Buffer.from(await bookingPdf(b)).toString("base64") });
      }
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.toEmail], subject: m.subject, html: m.html, attachments }),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
      await db.emailOutbox.update({ where: { id: m.id }, data: { status: "sent", sentAt: new Date(), attempts: { increment: 1 }, error: null } });
      sent++;
    } catch (e) {
      const attempts = m.attempts + 1;
      await db.emailOutbox.update({ where: { id: m.id }, data: { attempts, error: String(e).slice(0, 300), status: attempts >= 5 ? "failed" : "queued" } });
    }
  }
  return sent;
}
