"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { initiateCharge, provider } from "@/lib/momo";
import { networkFor, normalizePhone } from "@/lib/format";
import { fail } from "@/lib/flash";
import { blockDates, cancelBooking, confirmBooking, failBooking, holdBooking } from "@/lib/stays";
import { id, text } from "@/lib/validate";

export type StayState = { error?: string } | undefined;

/** Guest books nights: hold the dates, send the Mobile Money prompt, then wait on the payment page. */
export async function bookStay(_: StayState, fd: FormData): Promise<StayState> {
  const u = await requireUser();
  if (fd.get("agree") !== "on") return { error: "Please accept the house rules and paying for the whole stay up front" };
  const phone = normalizePhone(String(fd.get("phone") || u.phone));
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter a valid Ugandan Mobile Money number" };
  const network = (String(fd.get("network")) || networkFor(phone)) as "mtn" | "airtel";
  if (!["mtn", "airtel"].includes(network)) return { error: "Choose MTN or Airtel" };
  const detected = networkFor(phone);
  if (detected && detected !== network) return { error: `${phone.replace("+256", "0")} looks like an ${detected === "mtn" ? "MTN" : "Airtel"} number` };
  const b = await holdBooking(u, id(fd, "unitId"), String(fd.get("checkIn") || ""), String(fd.get("checkOut") || ""), Number(fd.get("guests")) || 1, network, phone);
  if ("error" in b) return { error: b.error };
  const res = await initiateCharge({ reference: b.reference, amount: b.total, phone, network, email: u.email, name: u.name, returnPath: `/stays/pay/${b.reference}` });
  if (!res.ok) { await failBooking(b.id); return { error: res.error }; }
  redirect(res.redirect || `/stays/pay/${b.reference}`);
}

/** Test mode only: approve or decline a booking payment. */
export async function sandboxStay(fd: FormData) {
  const u = await requireUser();
  if (provider !== "sandbox") return fail("Not available in live mode");
  const b = await db.booking.findUnique({ where: { reference: String(fd.get("ref")) } });
  if (!b || (b.guestId !== u.id && u.role !== "manager")) return fail("Booking not found");
  if (fd.get("outcome") === "approve") await confirmBooking(b.id); else await failBooking(b.id);
  redirect(`/stays/pay/${b.reference}`);
}

export async function cancelStay(fd: FormData) {
  const u = await requireUser();
  const r = await cancelBooking(id(fd), u, await text(fd, "reason", "a reason", { optional: true, max: 300 }));
  if ("error" in r && r.error) return fail(r.error);
  revalidatePath("/", "layout");
}

export async function blockStayDates(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const r = await blockDates(u, id(fd, "unitId"), String(fd.get("from") || ""), String(fd.get("to") || ""), await text(fd, "note", "a note", { optional: true, max: 200 }));
  if ("error" in r && r.error) return fail(r.error);
  revalidatePath("/", "layout");
}
