"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { notify } from "@/lib/notify";
import { fmtDateTime } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");
/** "2026-11-02" + "10:00" in Kampala time. */
const kampala = (date: string, time: string) => new Date(`${date}T${time}:00+03:00`);

function when(fd: FormData) {
  const date = String(fd.get("date") ?? ""), time = String(fd.get("time") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const at = kampala(date, time);
  if (Number.isNaN(at.getTime())) return null;
  return at;
}
function checkTime(at: Date | null) {
  if (!at) return "Choose a day and a time";
  if (at.getTime() < Date.now() + 60 * 60_000) return "Choose a time at least an hour from now";
  if (at.getTime() > Date.now() + 90 * 86_400_000) return "Choose a day within the next three months";
  const h = Number(at.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }));
  if (h < 8 || h > 18) return "Viewings are between 8am and 6pm";
  return null;
}

/** A tenant / buyer asks to see a home at a chosen time. */
export async function requestViewing(fd: FormData) {
  const u = await requireUser();
  const unitId = Number(fd.get("unitId")) || null, saleListingId = Number(fd.get("saleListingId")) || null;
  const at = when(fd);
  const bad = checkTime(at);
  if (bad) return fail(bad);
  let hostId: number, what: string;
  if (unitId) {
    const unit = await db.unit.findUnique({ where: { id: unitId }, select: { label: true, status: true, listed: true, property: { select: { name: true, landlordId: true } } } });
    if (!unit || !unit.listed || unit.status !== "vacant") return fail("This home isn't available to view");
    hostId = unit.property.landlordId; what = `${unit.property.name} · ${unit.label}`;
  } else if (saleListingId) {
    const l = await db.saleListing.findUnique({ where: { id: saleListingId }, select: { title: true, status: true, ownerId: true } });
    if (!l || !["active", "under_offer"].includes(l.status)) return fail("This listing isn't available to view");
    hostId = l.ownerId; what = l.title;
  } else return fail("Choose a home to view");
  if (hostId === u.id) return fail("This is your own listing");
  const open = await db.viewing.findFirst({ where: { requesterId: u.id, unitId, saleListingId, status: { in: ["requested", "proposed", "confirmed"] }, at: { gt: new Date() } } });
  if (open) return fail("You already have a viewing booked for this home — see Viewings");
  const note = String(fd.get("note") ?? "").trim().slice(0, 500) || null;
  await db.viewing.create({ data: { unitId, saleListingId, requesterId: u.id, hostId, at: at!, note } });
  await notify(hostId, `${u.name} would like to view ${what} on ${fmtDateTime(at)}. Confirm or suggest another time.`, "/viewings");
  refresh();
}

async function load(fd: FormData) {
  const u = await requireUser();
  const v = await db.viewing.findUnique({
    where: { id: Number(fd.get("id")) || 0 },
    include: { unit: { select: { label: true, property: { select: { name: true } } } }, saleListing: { select: { title: true } }, requester: { select: { name: true } }, host: { select: { name: true } } },
  });
  if (!v) return fail("Viewing not found");
  const role = u.role === "manager" ? "host" : v.hostId === u.id ? "host" : v.requesterId === u.id ? "requester" : null;
  if (!role) return fail("Viewing not found");
  const what = v.unit ? `${v.unit.property.name} · ${v.unit.label}` : v.saleListing?.title ?? "the home";
  return { u, v, role, what };
}

/** Host confirms the asked time; or the requester accepts the host's suggested time. */
export async function confirmViewing(fd: FormData) {
  const { v, role, what } = await load(fd);
  if (!(role === "host" && v.status === "requested") && !(role === "requester" && v.status === "proposed")) return fail("This viewing can't be confirmed now");
  await db.viewing.update({ where: { id: v.id }, data: { status: "confirmed" } });
  await notify(role === "host" ? v.requesterId : v.hostId, `Viewing confirmed: ${what}, ${fmtDateTime(v.at)}.`, "/viewings");
  refresh();
}

/** Host suggests another time. */
export async function proposeViewing(fd: FormData) {
  const { v, role, what } = await load(fd);
  if (role !== "host" || !["requested", "confirmed"].includes(v.status)) return fail("You can't suggest a time for this viewing");
  const at = when(fd);
  const bad = checkTime(at);
  if (bad) return fail(bad);
  const hostNote = String(fd.get("hostNote") ?? "").trim().slice(0, 300) || null;
  await db.viewing.update({ where: { id: v.id }, data: { status: "proposed", at: at!, hostNote } });
  await notify(v.requesterId, `${v.host.name} suggested another time to view ${what}: ${fmtDateTime(at)}. Accept it or choose again.`, "/viewings");
  refresh();
}

/** Host declines (e.g. already let). */
export async function declineViewing(fd: FormData) {
  const { v, role, what } = await load(fd);
  if (role !== "host" || !["requested", "proposed", "confirmed"].includes(v.status)) return fail("This viewing can't be declined now");
  const hostNote = String(fd.get("hostNote") ?? "").trim().slice(0, 300) || null;
  await db.viewing.update({ where: { id: v.id }, data: { status: "declined", hostNote } });
  await notify(v.requesterId, `${v.host.name} can't do the viewing of ${what}${hostNote ? `: ${hostNote}` : ""}.`, "/viewings");
  refresh();
}

/** Either side calls it off. */
export async function cancelViewing(fd: FormData) {
  const { u, v, role, what } = await load(fd);
  if (!["requested", "proposed", "confirmed"].includes(v.status)) return fail("This viewing is already closed");
  await db.viewing.update({ where: { id: v.id }, data: { status: "cancelled" } });
  await notify(role === "host" ? v.requesterId : v.hostId, `${u.name} cancelled the viewing of ${what} (${fmtDateTime(v.at)}).`, "/viewings");
  refresh();
}
