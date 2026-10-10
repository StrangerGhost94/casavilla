"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type User } from "@/db";
import { getUser, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify, notifyManagers } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { normalizePhone, kampalaToday } from "@/lib/format";
import { placeLine, readPlace } from "@/lib/geo-form";
import { id, oneOf, reqText, text } from "@/lib/validate";
import { SALE_FEATURES, SALE_KINDS, SIZE_UNITS, TENURES, TITLE_STATUSES } from "@/lib/sales";

const refresh = () => revalidatePath("/", "layout");
const base = (u: User) => `/${u.role}/sale`;

async function ownedListing(u: User, listingId: number) {
  const l = await db.saleListing.findUnique({ where: { id: listingId } });
  if (!l || (u.role !== "manager" && l.ownerId !== u.id)) return fail("Listing not found");
  return l;
}

const num = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").replace(/[,\s]/g, ""); return v === "" ? null : Number(v); };

/** Create or edit a listing. A landlord's new listing waits for CasaVilla's review; a manager's goes live. */
export async function saveSaleListing(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const existing = id(fd) ? await ownedListing(u, id(fd)) : null;
  const kind = await oneOf(fd, "kind", SALE_KINDS, "what you're selling");
  const title = await reqText(fd, "title", "a headline", { max: 100 });
  const description = await text(fd, "description", "the description", { optional: true, max: 5000 });
  const price = num(fd, "price");
  if (!price || !Number.isFinite(price) || price < 100_000 || price > 1e13) return fail("Enter the asking price in UGX");
  const sizeValue = num(fd, "sizeValue");
  if (sizeValue != null && (!Number.isFinite(sizeValue) || sizeValue <= 0 || sizeValue > 1e7)) return fail("Check the size");
  const sizeUnit = sizeValue != null ? await oneOf(fd, "sizeUnit", SIZE_UNITS, "the size unit") : null;
  const plotDims = await text(fd, "plotDims", "the plot measurements", { optional: true, max: 40 });
  if ((kind === "land" || kind === "farm") && !sizeValue && !plotDims) return fail("Give the land size (e.g. 50 decimals) or the plot measurements (e.g. 50 × 100 ft)");
  const isBuilding = kind === "house" || kind === "apartment" || kind === "commercial";
  const bedrooms = isBuilding ? num(fd, "bedrooms") : null;
  const bathrooms = isBuilding ? num(fd, "bathrooms") : null;
  for (const [v, l] of [[bedrooms, "bedrooms"], [bathrooms, "bathrooms"]] as const) if (v != null && (!Number.isInteger(v) || v < 0 || v > 50)) return fail(`Check the number of ${l}`);
  const tenure = String(fd.get("tenure") || "") ? await oneOf(fd, "tenure", TENURES, "the tenure") : null;
  const titleStatus = await oneOf(fd, "titleStatus", TITLE_STATUSES, "the title status", "titled");
  const features = fd.getAll("features").map(String).filter((f) => (SALE_FEATURES as readonly string[]).includes(f));
  const place = await readPlace(fd, { required: true });
  const location = await placeLine(place);
  const { building: _building, ...spot } = place; // sale listings keep estate/street/plot/landmark, not a building name
  void _building;
  const data = {
    kind, title, description: description || null, price: Math.round(price), negotiable: fd.get("negotiable") === "on",
    sizeValue, sizeUnit, plotDims: plotDims || null, bedrooms, bathrooms, tenure, titleStatus, features, location, ...spot,
  };
  if (existing) {
    // Changing the title status after CasaVilla verified it means it has to be checked again.
    const reverify = existing.titleVerified && existing.titleStatus !== titleStatus;
    await db.saleListing.update({ where: { id: existing.id }, data: { ...data, ...(reverify ? { titleVerified: false } : {}), ...(existing.status === "rejected" ? { status: "pending", reviewNote: null } : {}) } });
    if (existing.status === "rejected") await notifyManagers(`Sale listing updated for review: ${title}`, `/manager/sale/${existing.id}`);
    await audit(u.id, "sale.updated", "sale", existing.id, title);
    refresh();
    redirect(`${base(u)}/${existing.id}`);
  }
  const auto = u.role === "manager";
  const l = await db.saleListing.create({ data: { ...data, ownerId: u.id, status: auto ? "active" : "pending", publishedAt: auto ? new Date() : null } });
  await audit(u.id, "sale.created", "sale", l.id, `${title} — ${location}`);
  if (!auto) await notifyManagers(`New listing for sale to review: ${title} (${location})`, `/manager/sale/${l.id}`);
  refresh();
  redirect(`${base(u)}/${l.id}?new=1`);
}

/** Owner: mark under offer / sold / withdrawn, or put back on the market. */
export async function setSaleStatus(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const l = await ownedListing(u, id(fd));
  const to = await oneOf(fd, "status", ["active", "under_offer", "sold", "withdrawn"] as const, "status");
  const allowed: Record<string, string[]> = {
    active: ["under_offer", "sold", "withdrawn"], under_offer: ["active", "sold", "withdrawn"], withdrawn: ["active"], sold: ["active"], pending: ["withdrawn"], rejected: ["withdrawn"],
  };
  if (!allowed[l.status]?.includes(to)) return fail("That change isn't possible right now");
  // Back on the market after being withdrawn or sold: a landlord's listing is reviewed again.
  const status = to === "active" && ["withdrawn", "sold"].includes(l.status) && u.role !== "manager" ? "pending" : to;
  await db.saleListing.update({ where: { id: l.id }, data: { status, soldAt: to === "sold" ? new Date() : status === "active" || status === "pending" ? null : l.soldAt } });
  if (status === "pending") await notifyManagers(`Listing back for review: ${l.title}`, `/manager/sale/${l.id}`);
  await audit(u.id, `sale.${status}`, "sale", l.id, l.title);
  refresh();
}

/** CasaVilla: publish or send back with a note. */
export async function reviewSale(fd: FormData) {
  const u = await requireUser("manager");
  const l = await db.saleListing.findUnique({ where: { id: id(fd) }, include: { photos: { select: { id: true } } } });
  if (!l) return fail("Listing not found");
  const d = fd.get("decision");
  if (d !== "approve" && d !== "reject") return fail("Choose publish or send back");
  if (d === "approve") {
    if (!l.photos.length) return fail("Add at least one photo before publishing");
    await db.saleListing.update({ where: { id: l.id }, data: { status: "active", reviewNote: null, publishedAt: l.publishedAt ?? new Date() } });
    await notify(l.ownerId, `Your listing "${l.title}" is now live on CasaVilla.`, `/landlord/sale/${l.id}`);
  } else {
    const note = await reqText(fd, "note", "what needs changing", { max: 500 });
    await db.saleListing.update({ where: { id: l.id }, data: { status: "rejected", reviewNote: note } });
    await notify(l.ownerId, `Your listing "${l.title}" needs changes: ${note}`, `/landlord/sale/${l.id}`);
  }
  await audit(u.id, `sale.review.${d}`, "sale", l.id, l.title);
  refresh();
}

export async function verifySaleTitle(fd: FormData) {
  const u = await requireUser("manager");
  const l = await db.saleListing.findUnique({ where: { id: id(fd) } });
  if (!l) return fail("Listing not found");
  const on = fd.get("on") === "1";
  if (on && l.titleStatus !== "titled") return fail("Only listings with a land title can be marked as verified");
  await db.saleListing.update({ where: { id: l.id }, data: { titleVerified: on } });
  await audit(u.id, on ? "sale.title_verified" : "sale.title_unverified", "sale", l.id, l.title);
  refresh();
}

export async function uploadSalePhoto(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const l = await ownedListing(u, id(fd, "listingId"));
  const count = await db.salePhoto.count({ where: { listingId: l.id } });
  if (count >= 20) return { error: "Up to 20 photos per listing" };
  const fileId = await saveUpload(fd.get("photo"), u.id, true, true);
  if (!fileId) return { error: "Choose a photo" };
  const cover = count === 0;
  await db.$transaction([
    db.salePhoto.create({ data: { listingId: l.id, fileId, sort: count, isCover: cover } }),
    ...(cover ? [db.saleListing.update({ where: { id: l.id }, data: { photoId: fileId } })] : []),
  ]);
  revalidatePath(`${base(u)}/${l.id}`);
  return { ok: true, fileId };
}

export async function setSaleCover(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ph = await db.salePhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await ownedListing(u, ph.listingId);
  await db.$transaction([
    db.salePhoto.updateMany({ where: { listingId: ph.listingId }, data: { isCover: false } }),
    db.salePhoto.update({ where: { id: ph.id }, data: { isCover: true } }),
    db.saleListing.update({ where: { id: ph.listingId }, data: { photoId: ph.fileId } }),
  ]);
  refresh();
}

export async function deleteSalePhoto(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ph = await db.salePhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await ownedListing(u, ph.listingId);
  await db.salePhoto.delete({ where: { id: ph.id } });
  if (ph.isCover) {
    const next = await db.salePhoto.findFirst({ where: { listingId: ph.listingId }, orderBy: { sort: "asc" } });
    if (next) await db.salePhoto.update({ where: { id: next.id }, data: { isCover: true } });
    await db.saleListing.update({ where: { id: ph.listingId }, data: { photoId: next?.fileId ?? null } });
  }
  refresh();
}

/** Deletes a listing nobody has enquired about; otherwise it can only be withdrawn. */
export async function deleteSaleListing(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const l = await ownedListing(u, id(fd));
  if (await db.saleEnquiry.count({ where: { listingId: l.id } })) return fail("Buyers have enquired about this listing — withdraw it instead, so their messages are kept");
  await db.saleListing.delete({ where: { id: l.id } });
  await audit(u.id, "sale.deleted", "sale", l.id, l.title);
  refresh();
  redirect(base(u));
}

export type EnquiryState = { ok?: boolean; error?: string } | undefined;

/** A buyer's question or viewing request. Works without an account (name + phone), with simple flood limits. */
export async function sendSaleEnquiry(_: EnquiryState, fd: FormData): Promise<EnquiryState> {
  const me = await getUser();
  const l = await db.saleListing.findUnique({ where: { id: id(fd, "listingId") } });
  if (!l || !["active", "under_offer"].includes(l.status)) return { error: "This listing is no longer available." };
  if (me && me.id === l.ownerId) return { error: "This is your own listing." };
  const name = String(fd.get("name") || me?.name || "").trim().slice(0, 80);
  const phone = normalizePhone(String(fd.get("phone") || me?.phone || ""));
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^\+256\d{9}$/.test(phone) && !/^\+\d{9,15}$/.test(phone)) return { error: "Enter a phone number we can call, e.g. 0772 123 456." };
  const message = String(fd.get("message") || "").trim().slice(0, 1500) || null;
  const wantsViewing = fd.get("wantsViewing") === "on";
  const vd = String(fd.get("viewingDate") || "");
  const viewingDate = wantsViewing && /^\d{4}-\d{2}-\d{2}$/.test(vd) && vd >= kampalaToday() ? new Date(`${vd}T00:00:00Z`) : null;
  if (!message && !wantsViewing) return { error: "Write a question or ask for a viewing." };
  const [recent, today] = await Promise.all([
    db.saleEnquiry.count({ where: { listingId: l.id, phone, createdAt: { gt: new Date(Date.now() - 10 * 60000) } } }),
    db.saleEnquiry.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 86400000) } } }),
  ]);
  if (recent) return { error: "We already have your message — CasaVilla will call you shortly." };
  if (today >= 10) return { error: "You've sent a lot of enquiries today. Please call CasaVilla instead." };
  const e = await db.saleEnquiry.create({ data: { listingId: l.id, userId: me?.id ?? null, name, phone, message, wantsViewing, viewingDate } });
  const what = wantsViewing ? `viewing request${viewingDate ? ` for ${vd}` : ""}` : "question";
  const owner = await db.user.findUnique({ where: { id: l.ownerId }, select: { role: true } });
  if (owner?.role !== "manager") await notify(l.ownerId, `New ${what} from ${name} about "${l.title}".`, `/landlord/sale/${l.id}`);
  await notifyManagers(`Buyer ${what} from ${name} (${phone}) — ${l.title}`, `/manager/sale/${l.id}`);
  await audit(me?.id ?? null, "sale.enquiry", "sale", l.id, `${name} ${phone}`);
  return { ok: e.id > 0 };
}

export async function markEnquiry(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const e = await db.saleEnquiry.findUnique({ where: { id: id(fd) }, include: { listing: true } });
  if (!e || (u.role !== "manager" && e.listing.ownerId !== u.id)) return fail("Enquiry not found");
  const status = await oneOf(fd, "status", ["new", "contacted", "closed"] as const, "status");
  await db.saleEnquiry.update({ where: { id: e.id }, data: { status } });
  refresh();
}

/** Counted once per visit from the listing page (not for the owner or CasaVilla). */
export async function countSaleView(listingId: number) {
  const me = await getUser();
  const l = await db.saleListing.findUnique({ where: { id: listingId }, select: { ownerId: true, status: true } });
  if (!l || me?.id === l.ownerId || me?.role === "manager" || !["active", "under_offer"].includes(l.status)) return;
  await db.saleListing.update({ where: { id: listingId }, data: { views: { increment: 1 } } });
}
