"use server";
import { revalidatePath } from "next/cache";
import { db, type User } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { id, int, oneOf, reqText } from "@/lib/validate";

const ROOMS = ["exterior", "compound", "living", "kitchen", "bedroom", "bathroom", "dining", "balcony", "view", "other"] as const;
const MAX_PHOTOS = 40;

async function ownedProperty(u: User, pid: number) {
  const p = await db.property.findUnique({ where: { id: pid } });
  if (!p || (u.role !== "manager" && p.landlordId !== u.id)) return fail("Property not found");
  return p;
}

/** One photo from the guided shot list. The first front photo becomes the listing cover automatically. */
export async function uploadListingPhoto(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const p = await ownedProperty(u, id(fd, "propertyId"));
  const unitId = id(fd, "unitId") || null;
  if (unitId && !(await db.unit.findFirst({ where: { id: unitId, propertyId: p.id } }))) return fail("Choose a unit in this property");
  if ((await db.propertyPhoto.count({ where: { propertyId: p.id } })) >= MAX_PHOTOS) return fail(`Up to ${MAX_PHOTOS} photos per property — delete some first`);
  const room = await oneOf(fd, "room", ROOMS, "room");
  const label = await reqText(fd, "label", "a label", { max: 80 });
  const quality = await int(fd, "quality", "the quality score", { min: 0, max: 100, fallback: 0 });
  const width = await int(fd, "width", "the width", { min: 0, max: 20000, fallback: 0 });
  const height = await int(fd, "height", "the height", { min: 0, max: 20000, fallback: 0 });
  const fileId = await saveUpload(fd.get("photo"), u.id, true, true);
  if (!fileId) return fail("Take or choose a photo first");
  // Re-shooting the same slot replaces the old photo.
  const old = await db.propertyPhoto.findFirst({ where: { propertyId: p.id, unitId, label } });
  const hasCover = await db.propertyPhoto.count({ where: { propertyId: p.id, isCover: true } });
  const makeCover = (!hasCover && (room === "exterior" || room === "living")) || !!old?.isCover;
  await db.$transaction(async (tx) => {
    if (old) await tx.propertyPhoto.delete({ where: { id: old.id } });
    const n = await tx.propertyPhoto.count({ where: { propertyId: p.id } });
    await tx.propertyPhoto.create({ data: { propertyId: p.id, unitId, fileId, room, label, quality, width: width || null, height: height || null, sort: n, isCover: makeCover } });
    if (makeCover) await tx.property.update({ where: { id: p.id }, data: { photoId: fileId } });
  });
  await audit(u.id, "photo.added", "property", p.id, `${label} (${quality}/100)`);
  revalidatePath("/", "layout");
}

export async function setCoverPhoto(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ph = await db.propertyPhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await ownedProperty(u, ph.propertyId);
  await db.$transaction([
    db.propertyPhoto.updateMany({ where: { propertyId: ph.propertyId, isCover: true }, data: { isCover: false } }),
    db.propertyPhoto.update({ where: { id: ph.id }, data: { isCover: true } }),
    db.property.update({ where: { id: ph.propertyId }, data: { photoId: ph.fileId } }),
  ]);
  revalidatePath("/", "layout");
}

export async function deletePhoto(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ph = await db.propertyPhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await ownedProperty(u, ph.propertyId);
  await db.$transaction(async (tx) => {
    await tx.propertyPhoto.delete({ where: { id: ph.id } });
    if (ph.isCover) {
      const next = await tx.propertyPhoto.findFirst({ where: { propertyId: ph.propertyId }, orderBy: [{ room: "asc" }, { sort: "asc" }] });
      if (next) await tx.propertyPhoto.update({ where: { id: next.id }, data: { isCover: true } });
      await tx.property.update({ where: { id: ph.propertyId }, data: { photoId: next?.fileId ?? null } });
    }
  });
  revalidatePath("/", "layout");
}
