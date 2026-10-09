"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { validLocationId, trailFor, crumbText } from "@/lib/geo";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";

const MAX_AREAS = 15;

/** Anyone: where they live / are based. Any level is fine (a district when the village isn't known). */
export async function setMyLocation(fd: FormData) {
  const u = await requireUser();
  const loc = await validLocationId(fd.get("locationId"));
  if (loc === false) return fail("Choose your area from the list");
  await db.user.update({ where: { id: u.id }, data: { locationId: loc } });
  await audit(u.id, "user.location", "user", u.id, loc ? crumbText(await trailFor(loc), true) : "cleared");
  revalidatePath("/", "layout");
}

/** Service providers: add an area they cover. Covering a district covers everything inside it. */
export async function addServiceArea(fd: FormData) {
  const u = await requireUser("provider");
  const loc = await validLocationId(fd.get("locationId"));
  if (!loc) return fail("Choose an area from the list");
  const [place, mine] = await Promise.all([
    db.location.findUniqueOrThrow({ where: { id: loc }, select: { path: true, level: true, name: true } }),
    db.providerArea.findMany({ where: { providerId: u.id }, include: { location: { select: { path: true, name: true } } } }),
  ]);
  if (place.level === "country" || place.level === "region") return fail("Pick a district or something smaller — a whole region is too broad");
  if (mine.length >= MAX_AREAS) return fail(`You can list up to ${MAX_AREAS} areas — use a bigger area (e.g. the district) instead`);
  const covering = mine.find((a) => place.path.startsWith(a.location.path));
  if (covering) return fail(`${place.name} is already covered by ${covering.location.name}`);
  // A bigger area replaces the smaller ones inside it, so the list never overlaps.
  const inside = mine.filter((a) => a.location.path.startsWith(place.path));
  await db.$transaction([
    db.providerArea.deleteMany({ where: { providerId: u.id, locationId: { in: inside.map((a) => a.locationId) } } }),
    db.providerArea.create({ data: { providerId: u.id, locationId: loc } }),
  ]);
  await audit(u.id, "provider.area_added", "user", u.id, place.name);
  revalidatePath("/", "layout");
}

export async function removeServiceArea(fd: FormData) {
  const u = await requireUser("provider");
  await db.providerArea.deleteMany({ where: { providerId: u.id, locationId: String(fd.get("locationId") || "") } });
  revalidatePath("/", "layout");
}
