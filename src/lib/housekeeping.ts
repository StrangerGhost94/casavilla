import "server-only";
import { db } from "@/db";
import { ensureChargesFor, expireStalePayments, daysBetween } from "./billing";
import { managerIds, notifyOnce } from "./notify";
import { fmtDate, kampalaToday, ugx, ymd } from "./format";
import { sendQueuedEmails } from "./mail";
import { expireStaleBookings } from "./stays";

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
    await db.marker.deleteMany({ where: { key: { startsWith: "sweep:" }, createdAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
  } catch (e) {
    console.error("housekeeping failed", e);
  }
  return out;
}

async function rentReminders() {
  const today = kampalaToday();
  const soon = new Date(Date.parse(`${today}T00:00:00Z`) + 3 * 86400000);
  const managers = await managerIds();
  const open = await db.charge.findMany({
    where: { status: { not: "paid" }, dueDate: { lte: soon }, lease: { status: "active" } },
    include: { lease: { include: { tenant: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } } },
  });
  let n = 0;
  for (const c of open) {
    const owed = c.amount - c.paid;
    const days = daysBetween(today, ymd(c.dueDate));
    const where = `${c.lease.unit.property.name} · ${c.lease.unit.label}`;
    const pay = `/tenant/pay/${c.id}`;
    if (days >= 0) {
      if (await notifyOnce(`due:${c.id}`, c.lease.tenantId, `${c.description}: ${ugx(owed)} is due ${days === 0 ? "today" : `on ${fmtDate(c.dueDate)}`}. Pay early with Mobile Money.`, pay)) n++;
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
