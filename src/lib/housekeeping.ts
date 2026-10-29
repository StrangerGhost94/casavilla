import "server-only";
import { db } from "@/db";
import { ensureChargesFor, expireStalePayments, daysBetween } from "./billing";
import { managerIds, notifyOnce } from "./notify";
import { fmtDate, kampalaToday, ugx, ymd } from "./format";
import { sendQueuedEmails } from "./mail";
import { appUrl, queueMessage, sendQueuedMessages } from "./messaging";
import { expireStaleBookings } from "./stays";
import { sendQueuedPayouts } from "./payouts";
import { followCreditNotes, retryEfris } from "./efris";
import { taxReminders } from "./tax";
import { alertHref, matchesAfter, type AlertKind, type AlertParams } from "./saved";

/**
 * Background routine that keeps the system moving without anyone pressing a button:
 * rent charges and late fees, expired payment requests, rent and lease reminders, and repair escalations.
 * Runs at most once an hour (whoever opens the app first triggers it); every reminder is sent only once.
 */
export async function runHousekeeping(force = false) {
  const hour = new Date().toISOString().slice(0, 13);
  if (!force) {
    const claimed = await db.marker.createMany({ data: [{ key: `sweep:${hour}` }], skipDuplicates: true });
    if (claimed.count === 0) return null;
  }
  const out = { charges: 0, expired: 0, reminders: 0, escalations: 0 };
  try {
    await ensureChargesFor("all");
    out.expired = await expireStalePayments();
    out.reminders = await rentReminders() + await leaseReminders();
    out.escalations = await jobEscalations() + await stockAlerts();
    await expireStaleBookings().catch((e) => console.error("bookings sweep", e));
    await sendQueuedEmails().catch((e) => console.error("email sweep", e));
    await sendQueuedMessages().catch((e) => console.error("message sweep", e));
    await sendQueuedPayouts().catch((e) => console.error("payout sweep", e));
    await retryEfris().catch((e) => console.error("efris sweep", e));
    await followCreditNotes().catch((e) => console.error("credit note sweep", e));
    await searchAlerts().catch((e) => console.error("search alerts", e));
    await viewingReminders().catch((e) => console.error("viewing reminders", e));
    await taxReminders().catch((e) => console.error("tax reminder", e));
    await db.marker.deleteMany({ where: { key: { startsWith: "sweep:" }, createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  } catch (e) {
    console.error("housekeeping failed", e);
  }
  return out;
}

/** Which reminder a charge is due for today: 3 days before, on the day, then 3 and 7 days late. */
export function reminderStage(daysUntilDue: number): "due3" | "due0" | "late3" | "late7" | null {
  if (daysUntilDue >= 1 && daysUntilDue <= 3) return "due3";
  if (daysUntilDue === 0) return "due0";
  if (daysUntilDue <= -7 && daysUntilDue >= -30) return "late7";
  if (daysUntilDue <= -3 && daysUntilDue > -7) return "late3";
  return null;
}

async function rentReminders() {
  const today = kampalaToday();
  // A week ahead: an early heads-up, then 3 days before, then on the day (app + phone notifications).
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 7 * 86400000);
  const managers = await managerIds();
  const open = await db.charge.findMany({
    where: { status: { not: "paid" }, dueDate: { lte: soon }, lease: { status: "active" } },
    include: { lease: { include: { tenant: { select: { name: true } }, landlord: { select: { remindTenants: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } } },
  });
  let n = 0;
  for (const c of open) {
    const owed = c.amount - c.paid;
    const days = daysBetween(today, ymd(c.dueDate));
    const where = `${c.lease.unit.property.name} · ${c.lease.unit.label}`;
    const pay = `/tenant/pay/${c.id}`;
    // WhatsApp / SMS, once per stage — only if the landlord has reminders on (and the tenant agreed to messages).
    const stage = reminderStage(days);
    if (stage && c.lease.landlord.remindTenants && owed > 0) {
      const when = stage === "due3" ? `is due on ${fmtDate(c.dueDate)}` : stage === "due0" ? "is due today" : `was due on ${fmtDate(c.dueDate)} (${-days} days ago)`;
      const first = c.lease.tenant.name.split(" ")[0];
      const what = `${c.description} (${where})`;
      const link = appUrl(pay);
      if (await queueMessage({
        userId: c.lease.tenantId, kind: "reminder", dedupeKey: `rent-${stage}:${c.id}`,
        params: [first, ugx(owed), what, when, link],
        text: `Hello ${first}, ${ugx(owed)} for ${what} ${when}. Pay with Mobile Money: ${link} — CasaVilla`,
      })) n++;
    }
    if (days >= 0) {
      if (owed <= 0) continue;
      const [key, msg] = days === 0
        ? [`due0:${c.id}`, `Rent reminder: ${c.description}, ${ugx(owed)}, is due today. Tap to pay with Mobile Money.`]
        : days <= 3
          ? [`due:${c.id}`, `Rent reminder: ${c.description}, ${ugx(owed)}, is due in ${days} day${days === 1 ? "" : "s"} (${fmtDate(c.dueDate)}). Pay early with Mobile Money.`]
          : [`due7:${c.id}`, `Heads-up: ${c.description}, ${ugx(owed)}, is due on ${fmtDate(c.dueDate)}, in ${days} days.`];
      if (await notifyOnce(key, c.lease.tenantId, msg, pay)) n++;
      continue;
    }
    if (await notifyOnce(`late:${c.id}`, c.lease.tenantId, `${c.description} is overdue — ${ugx(owed)} outstanding. Please pay as soon as you can.`, pay)) n++;
    if (-days >= 3 && await notifyOnce(`late-l:${c.id}`, c.lease.landlordId, `${c.lease.tenant.name} (${where}) is ${-days} days late on ${c.description.toLowerCase()} — ${ugx(owed)}.`, `/landlord/tenants/${c.leaseId}`)) n++;
    if (-days >= 30) for (const m of managers) {
      if (await notifyOnce(`late30:${c.id}`, m, `Arrears over 30 days: ${c.lease.tenant.name} (${where}) owes ${ugx(owed)} on ${c.description.toLowerCase()}.`, `/manager/tenants/${c.leaseId}`)) n++;
    }
  }
  return n;
}

async function leaseReminders() {
  const today = kampalaToday();
  const leases = await db.lease.findMany({
    where: { status: "active", endDate: { lte: new Date(Date.parse(`${today}T00:00:00Z`) + 61 * 86400000) } },
    include: { tenant: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } },
  });
  let n = 0;
  for (const l of leases) {
    const days = daysBetween(today, ymd(l.endDate));
    const where = `${l.unit.property.name} · ${l.unit.label}`;
    const stage = days < 0 ? "over" : days <= 7 ? "7" : days <= 30 ? "30" : "60";
    const t = days < 0
      ? `Your lease for ${where} ended on ${fmtDate(l.endDate)}. You're now month-to-month — talk to your landlord about renewing.`
      : `Your lease for ${where} ends on ${fmtDate(l.endDate)} (${days} days). Talk to your landlord if you'd like to renew.`;
    const ll = days < 0
      ? `${l.tenant.name}'s lease (${where}) has expired and is running month-to-month. Renew it or record the move-out.`
      : `${l.tenant.name}'s lease (${where}) ends in ${days} days. Renew it or plan for re-letting.`;
    if (await notifyOnce(`exp${stage}:${l.id}`, l.tenantId, t, "/tenant/lease")) n++;
    if (await notifyOnce(`exp${stage}:${l.id}`, l.landlordId, ll, `/landlord/tenants/${l.id}`)) n++;
  }
  return n;
}

async function jobEscalations() {
  const now = Date.now();
  const hours = (d: Date) => (now - d.getTime()) / 3600000;
  const managers = await managerIds();
  const jobs = await db.job.findMany({
    where: { status: { in: ["open", "assigned", "quoted"] } },
    include: { provider: { select: { businessName: true, name: true } }, property: { select: { name: true } } },
  });
  let n = 0;
  for (const j of jobs) {
    const at = j.property?.name ? ` at ${j.property.name}` : "";
    const link = `/manager/jobs/${j.id}`;
    const tell = async (key: string, msg: string) => { for (const m of managers) if (await notifyOnce(key, m, msg, link)) n++; };
    if (j.status === "open" && j.priority === "urgent" && hours(j.createdAt) >= 2) await tell(`esc-urgent:${j.id}`, `URGENT repair still unassigned after ${Math.floor(hours(j.createdAt))}h: "${j.title}"${at}.`);
    else if (j.status === "open" && hours(j.createdAt) >= 48) await tell(`esc-open:${j.id}`, `Repair waiting 2+ days for a provider: "${j.title}"${at}.`);
    if (j.status === "assigned" && j.assignedAt && hours(j.assignedAt) >= 24) {
      const who = j.provider?.businessName || j.provider?.name || "The provider";
      await tell(`esc-assigned:${j.id}:${j.assignedAt.getTime()}`, `${who} hasn't responded to "${j.title}"${at} in 24h. Consider reassigning.`);
      if (await notifyOnce(`nudge:${j.id}:${j.assignedAt.getTime()}`, j.providerId, `Reminder: please accept or decline "${j.title}"${at}.`, `/provider/jobs/${j.id}`)) n++;
    }
    if (j.status === "quoted" && hours(j.updatedAt) >= 48 && j.landlordId) {
      if (await notifyOnce(`quote-wait:${j.id}:${j.quote}`, j.landlordId, `A quote of ${ugx(j.quote)} for "${j.title}" is waiting for your approval.`, `/landlord/maintenance/${j.id}`)) n++;
    }
  }
  return n;
}

async function stockAlerts() {
  const low = await db.product.findMany({ where: { active: true, stock: { lte: 2 } }, select: { id: true, name: true, stock: true, providerId: true } });
  let n = 0;
  for (const p of low) {
    const msg = p.stock === 0 ? `${p.name} is sold out — restock it so buyers can order again.` : `Only ${p.stock} ${p.name} left in stock.`;
    if (await notifyOnce(`stock:${p.id}:${p.stock}`, p.providerId, msg, "/provider/products")) n++;
  }
  return n;
}


/** Saved searches: tell people about listings that are new since last time (one notification per batch). */
async function searchAlerts() {
  const alerts = await db.searchAlert.findMany({ orderBy: { id: "asc" }, take: 500 });
  let n = 0;
  for (const a of alerts) {
    const kind = a.kind as AlertKind, p = a.params as AlertParams;
    const ids = await matchesAfter(kind, p, a.lastSeenId, a.userId).catch(() => []);
    if (!ids.length) continue;
    const top = Math.max(...ids);
    const what = kind === "sale" ? (ids.length === 1 ? "listing" : "listings") : ids.length === 1 ? "home" : "homes";
    const link = ids.length === 1 ? `/${kind === "rent" ? "listings" : kind}/${ids[0]}` : alertHref(kind, p);
    if (await notifyOnce(`alert:${a.id}:${top}`, a.userId, `${ids.length} new ${what} for your alert “${a.label}”.`, link)) n++;
    await db.searchAlert.update({ where: { id: a.id }, data: { lastSeenId: top } });
  }
  return n;
}

/** Confirmed viewings: a reminder to both sides the day before (within 24 hours) and again about 2 hours before. */
async function viewingReminders() {
  const now = Date.now();
  const soon = await db.viewing.findMany({
    where: { status: "confirmed", at: { gt: new Date(now), lt: new Date(now + 24 * 3600_000) } },
    include: { unit: { select: { label: true, property: { select: { name: true } } } }, saleListing: { select: { title: true } } },
  });
  let n = 0;
  for (const v of soon) {
    const what = v.unit ? `${v.unit.property.name} · ${v.unit.label}` : v.saleListing?.title ?? "a home";
    const time = v.at.toLocaleString("en-GB", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "Africa/Kampala" });
    const stage = v.at.getTime() - now <= 2.5 * 3600_000 ? "2h" : "day";
    const msg = stage === "2h" ? `Viewing soon: ${what} at ${time}.` : `Reminder: viewing of ${what} on ${time}.`;
    for (const who of [v.requesterId, v.hostId]) if (await notifyOnce(`view-${stage}:${v.id}`, who, msg, "/viewings")) n++;
  }
  return n;
}