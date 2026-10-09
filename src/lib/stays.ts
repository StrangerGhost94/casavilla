import "server-only";
import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { db, type User } from "@/db";
import { notify, notifyOnce } from "./notify";
import { audit } from "./audit";
import { brandFor } from "./brand";
import { emailHtml, queueEmail, sendQueuedEmails } from "./mail";
import { fmtDate, kampalaToday, ugx, ymd, dateOnly } from "./format";
import { provider, verifyCharge } from "./momo";
import { PdfWriter, embedLogo } from "./pdf";

/** A booking holds its dates for this long while the guest approves the Mobile Money prompt. */
export const HOLD_MINUTES = 30;
const LIVE = ["confirmed", "blocked"] as const;

export const nightsBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Price for a stay: nights × nightly rate + one cleaning fee. */
export function quote(u: { nightlyRate: number | null; cleaningFee: number }, checkIn: string, checkOut: string) {
  const nights = nightsBetween(checkIn, checkOut);
  const nightly = u.nightlyRate ?? 0;
  return { nights, nightly, cleaningFee: u.cleaningFee, total: nights * nightly + u.cleaningFee };
}

/** Bookings that occupy nights: confirmed, host-blocked, or pending and still inside their payment hold. */
const occupying = (): Prisma.BookingWhereInput => ({
  OR: [{ status: { in: [...LIVE] } }, { status: "pending", createdAt: { gt: new Date(Date.now() - HOLD_MINUTES * 60000) } }],
});

export async function bookedNights(unitId: number, from: string, to: string) {
  const rows = await db.booking.findMany({
    where: { unitId, checkIn: { lt: dateOnly(to) }, checkOut: { gt: dateOnly(from) }, ...occupying() },
    select: { checkIn: true, checkOut: true, status: true },
  });
  const nights = new Set<string>();
  for (const r of rows) for (let d = ymd(r.checkIn); d < ymd(r.checkOut); d = addDays(d, 1)) nights.add(d);
  return nights;
}

export async function isFree(unitId: number, checkIn: string, checkOut: string, tx: Prisma.TransactionClient | typeof db = db) {
  return (await tx.booking.count({ where: { unitId, checkIn: { lt: dateOnly(checkOut) }, checkOut: { gt: dateOnly(checkIn) }, ...occupying() } })) === 0;
}

export type StayError = { error: string };

/** Validates dates and guests against the unit's rules. */
export function checkStay(u: { minNights: number; maxGuests: number }, checkIn: string, checkOut: string, guests: number): string | null {
  const today = kampalaToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) return "Choose your check-in and check-out dates";
  if (checkIn < today) return "Check-in can't be in the past";
  const n = nightsBetween(checkIn, checkOut);
  if (n < 1) return "Check-out must be after check-in";
  if (n < u.minNights) return `This home needs at least ${u.minNights} night${u.minNights > 1 ? "s" : ""}`;
  if (n > 90) return "Stays are limited to 90 nights — for longer, rent it monthly";
  if (checkIn > addDays(today, 365)) return "Bookings open up to a year ahead";
  if (guests < 1 || guests > u.maxGuests) return `Up to ${u.maxGuests} guest${u.maxGuests > 1 ? "s" : ""}`;
  return null;
}

/**
 * Creates a pending booking that holds the nights while the guest pays. The unit row is locked and the dates
 * re-checked inside the transaction; the database's exclusion constraint is the final guard.
 */
export async function holdBooking(guest: User, unitId: number, checkIn: string, checkOut: string, guests: number, method: "mtn" | "airtel", phone: string) {
  const reference = `BK${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM units WHERE id = ${unitId} FOR UPDATE`;
      // Holds whose payment window has passed free their nights now (a late payment is still honoured if the nights are free).
      await tx.booking.updateMany({ where: { unitId, status: "pending", createdAt: { lt: new Date(Date.now() - HOLD_MINUTES * 60000) } }, data: { status: "expired", note: "Payment window ended" } });
      const u = await tx.unit.findUniqueOrThrow({ where: { id: unitId }, include: { property: { select: { landlordId: true } } } });
      if (u.mode !== "short" || !u.listed || !u.nightlyRate) return { error: "This home isn't taking bookings right now" } as StayError;
      if (u.property.landlordId === guest.id) return { error: "You can't book your own home — block the dates instead" } as StayError;
      const bad = checkStay(u, checkIn, checkOut, guests);
      if (bad) return { error: bad } as StayError;
      if (!(await isFree(unitId, checkIn, checkOut, tx))) return { error: "Some of those nights were just booked — pick other dates" } as StayError;
      const q = quote(u, checkIn, checkOut);
      return tx.booking.create({
        data: { unitId, guestId: guest.id, checkIn: dateOnly(checkIn), checkOut: dateOnly(checkOut), nights: q.nights, guests, nightly: q.nightly, cleaningFee: q.cleaningFee, total: q.total, reference, method, phone, status: "pending" },
      });
    });
  } catch (e) {
    if (String(e).includes("bookings_no_overlap")) return { error: "Some of those nights were just booked — pick other dates" } as StayError;
    throw e;
  }
}

/** Payment confirmed: the hold becomes a confirmed booking with a receipt. Safe to call twice. */
export async function confirmBooking(bookingId: number) {
  const b0 = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b0 || !["pending", "expired"].includes(b0.status) || b0.paidAt) return;
  const receiptNo = `CV-BK-${kampalaToday().slice(0, 4)}-${String(bookingId).padStart(6, "0")}`;
  let claimed;
  try {
    if (b0.status === "expired" && !(await isFree(b0.unitId, ymd(b0.checkIn), ymd(b0.checkOut)))) throw new Error("bookings_no_overlap");
    claimed = await db.booking.updateMany({ where: { id: bookingId, status: b0.status, paidAt: null }, data: { status: "confirmed", paidAt: new Date(), receiptNo } });
  } catch (e) {
    // Paid after the hold ran out and someone else has those nights: record it and get CasaVilla to refund.
    if (!String(e).includes("bookings_no_overlap")) throw e;
    await db.booking.update({ where: { id: bookingId }, data: { paidAt: new Date(), note: `Paid after the hold expired and the nights were taken — refund ${ugx(b0.total)} due` } });
    const { notifyManagers } = await import("./notify");
    await notifyManagers(`Late payment on booking ${b0.reference}: nights no longer free — refund ${ugx(b0.total)} to the guest.`, "/manager/stays");
    await notify(b0.guestId, `Your payment for booking ${b0.reference} arrived after the hold ended and the nights were taken. CasaVilla will refund ${ugx(b0.total)}.`, `/stays/bookings/${b0.id}`);
    return;
  }
  if (!claimed.count) return;
  const b = await db.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { guest: true, unit: { include: { property: true } } } });
  const where = `${b.unit.property.name} · ${b.unit.label}`;
  await notify(b.guestId, `Booking confirmed! ${where}, ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} (${b.nights} night${b.nights > 1 ? "s" : ""}). Receipt ${receiptNo}.`, `/stays/bookings/${b.id}`);
  await notify(b.unit.property.landlordId, `New booking: ${b.guest.name} at ${where}, ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} — ${ugx(b.total)} paid.`, `/landlord/stays`);
  await audit(b.guestId, "booking.confirmed", "booking", b.id, `${where} ${ymd(b.checkIn)}→${ymd(b.checkOut)} ${ugx(b.total)}`);
  if (b.guest.emailReceipts) {
    const brand = await brandFor(b.unit.property.landlordId);
    const app = process.env.APP_URL || "https://casavilla-production.up.railway.app";
    await queueEmail({
      to: b.guest.email, subject: `Booking confirmed — ${b.unit.property.name}, ${fmtDate(b.checkIn)}`, attachKind: "booking", attachId: b.id,
      html: emailHtml({ accent: brand.accentColor, title: "Your stay is booked", lines: [`${where}`, `Check-in ${fmtDate(b.checkIn)} from ${b.unit.checkInFrom} · check-out ${fmtDate(b.checkOut)} by ${b.unit.checkOutBy}.`, `${b.nights} night${b.nights > 1 ? "s" : ""}, ${b.guests} guest${b.guests > 1 ? "s" : ""} — ${ugx(b.total)} paid. Receipt ${receiptNo} attached.`], button: { label: "View booking", href: `${app}/stays/bookings/${b.id}` }, footer: brand.displayName }),
    });
    await sendQueuedEmails(3).catch(() => 0);
  }
}

export async function failBooking(bookingId: number) {
  await db.booking.updateMany({ where: { id: bookingId, status: "pending" }, data: { status: "expired", note: "Payment not completed" } });
}

/**
 * Cancelling. Unpaid holds just end. A paid booking cancelled 2+ days before check-in is refunded in full;
 * closer than that, the first night is kept. The host is told what to refund (mobile money refunds are manual).
 */
export async function cancelBooking(bookingId: number, actor: User, reason: string | null) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { unit: { include: { property: true } }, guest: true } });
  if (!b) return { error: "Booking not found" };
  const host = b.unit.property.landlordId;
  const isGuest = b.guestId === actor.id, isHost = host === actor.id || actor.role === "manager";
  if (!isGuest && !isHost) return { error: "Not allowed" };
  if (!["pending", "confirmed", "blocked"].includes(b.status)) return { error: `This booking is already ${b.status}` };
  const today = kampalaToday();
  if (b.status === "confirmed" && ymd(b.checkIn) <= today && !isHost) return { error: "The stay has started — contact the host" };
  let refund = 0;
  if (b.status === "confirmed") refund = isHost || nightsBetween(today, ymd(b.checkIn)) >= 2 ? b.total : Math.max(0, b.total - b.nightly);
  const note = [reason, refund ? `Refund due to guest: ${ugx(refund)}` : null].filter(Boolean).join(" · ") || null;
  const done = await db.booking.updateMany({ where: { id: b.id, status: b.status }, data: { status: "cancelled", note } });
  if (!done.count) return { error: "This booking just changed — refresh" };
  const where = `${b.unit.property.name} · ${b.unit.label}`;
  if (b.status !== "blocked") {
    await notify(isGuest ? host : b.guestId, `Booking for ${where} (${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}) was cancelled by ${isGuest ? "the guest" : "the host"}.${refund ? ` ${ugx(refund)} is to be refunded to ${b.guest.name}.` : ""}`, isGuest ? "/landlord/stays" : `/stays/bookings/${b.id}`);
  }
  await audit(actor.id, "booking.cancelled", "booking", b.id, note ?? "");
  return { ok: true, refund };
}

/** Host keeps nights for themselves or maintenance. */
export async function blockDates(host: User, unitId: number, from: string, to: string, note: string | null) {
  const u = await db.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  if (!u || (host.role !== "manager" && u.property.landlordId !== host.id)) return { error: "Unit not found" };
  if (u.mode !== "short") return { error: "Only short-stay units have a booking calendar" };
  if (nightsBetween(from, to) < 1) return { error: "Choose at least one night" };
  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM units WHERE id = ${unitId} FOR UPDATE`;
      if (!(await isFree(unitId, from, to, tx))) return { error: "Some of those nights are already booked" };
      const n = nightsBetween(from, to);
      return tx.booking.create({
        data: { unitId, guestId: host.id, checkIn: dateOnly(from), checkOut: dateOnly(to), nights: n, nightly: 0, cleaningFee: 0, total: 0, status: "blocked", reference: `BLK${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString("hex")}`, note },
      });
    });
  } catch (e) {
    if (String(e).includes("bookings_no_overlap")) return { error: "Some of those nights are already booked" };
    throw e;
  }
}

/** Housekeeping: close unpaid holds, finish past stays, remind guests the day before. */
export async function expireStaleBookings() {
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60000);
  const stale = await db.booking.findMany({ where: { status: "pending", createdAt: { lt: cutoff } }, take: 50 });
  for (const b of stale) {
    const r = provider === "sandbox" ? "failed" : await verifyCharge(b.reference, b.total);
    if (r === "success") await confirmBooking(b.id); else await failBooking(b.id);
  }
  const today = kampalaToday();
  await db.booking.updateMany({ where: { status: "confirmed", checkOut: { lte: dateOnly(today) } }, data: { status: "completed" } });
  const tomorrow = await db.booking.findMany({ where: { status: "confirmed", checkIn: dateOnly(addDays(today, 1)) }, include: { unit: { include: { property: true } } } });
  for (const b of tomorrow) {
    await notifyOnce(`stay-tomorrow:${b.id}`, b.guestId, `Your stay at ${b.unit.property.name} starts tomorrow — check-in from ${b.unit.checkInFrom}. ${b.unit.property.landmark ? `Landmark: ${b.unit.property.landmark}.` : ""}`, `/stays/bookings/${b.id}`);
    await notifyOnce(`stay-tomorrow:${b.id}`, b.unit.property.landlordId, `Guest arriving tomorrow at ${b.unit.property.name} · ${b.unit.label}. Prepare the unit.`, "/landlord/stays");
  }
  return stale.length;
}

export async function bookingData(id: number, viewer?: User) {
  const b = await db.booking.findUnique({ where: { id }, include: { guest: true, unit: { include: { property: { include: { landlord: true } } } } } });
  if (!b) return null;
  if (viewer && viewer.role !== "manager" && viewer.id !== b.guestId && viewer.id !== b.unit.property.landlordId) return null;
  return { b, brand: await brandFor(b.unit.property.landlordId) };
}

export async function bookingPdf(d: NonNullable<Awaited<ReturnType<typeof bookingData>>>) {
  const { b, brand } = d;
  const p = b.unit.property;
  const w = await PdfWriter.create({ accent: brand.accentColor, title: `Booking ${b.reference}`, author: brand.displayName, footer: brand.showCasaVilla ? "Generated by CasaVilla Property Management" : brand.displayName });
  const top = w.y;
  const logo = await embedLogo(w, brand.logoFileId);
  if (logo) w.image(logo, 150, 60);
  w.y = top;
  w.text(brand.displayName, { x: w.W / 2, size: 11, bold: true, align: "right" });
  for (const l of [brand.address, brand.phone, brand.email, brand.tin && `TIN: ${brand.tin}`].filter(Boolean) as string[]) w.text(l, { x: w.W / 2, size: 8.5, align: "right" });
  w.y = Math.min(w.y, top - 70); w.rule(w.accent);
  w.text(b.status === "confirmed" || b.status === "completed" ? "BOOKING CONFIRMATION & RECEIPT" : `BOOKING — ${b.status.toUpperCase()}`, { size: 9, bold: true, color: w.accent });
  w.text(b.receiptNo ?? b.reference, { size: 20, bold: true });
  w.gap(4);
  w.facts([
    ["Guest", `${b.guest.name} · ${b.guest.phone}`], ["Booked on", fmtDate(b.createdAt)],
    ["Property", `${p.name} · ${b.unit.label}`], ["Address", p.location],
    ["Check-in", `${fmtDate(b.checkIn)} from ${b.unit.checkInFrom}`], ["Check-out", `${fmtDate(b.checkOut)} by ${b.unit.checkOutBy}`],
    ["Guests", String(b.guests)], ["Payment", b.paidAt ? `${b.method === "airtel" ? "Airtel Money" : "MTN Mobile Money"} · ${fmtDate(b.paidAt)}` : "Not paid"],
  ]);
  w.gap(6);
  w.table(["Description", "", "Amount"], [
    [`${b.nights} night${b.nights > 1 ? "s" : ""} × ${ugx(b.nightly)}`, "", ugx(b.nights * b.nightly)],
    ...(b.cleaningFee ? [["Cleaning fee", "", ugx(b.cleaningFee)]] : []),
  ], { widths: [300, 80, 119.28], totalRows: [["Total", "", ugx(b.total)]] });
  w.gap(10);
  if (p.landmark) w.text(`Directions: ${p.landmark}`, { size: 9 });
  if (b.unit.houseRules) { w.heading("House rules", 10); w.text(b.unit.houseRules, { size: 9 }); }
  w.heading("Cancellation", 10);
  w.text("Cancel 2 or more days before check-in for a full refund. Later than that, the first night is kept. Refunds are sent to the Mobile Money number used to pay.", { size: 9 });
  if (b.note) w.text(`Note: ${b.note}`, { size: 9, italic: true });
  w.signature([{ label: brand.signatoryTitle || `For ${brand.displayName}`, name: brand.signatory ?? undefined }]);
  return w.bytes();
}
