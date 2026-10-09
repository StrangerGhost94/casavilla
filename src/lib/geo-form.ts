import "server-only";
import { db } from "@/db";
import { fail } from "./flash";
import { text } from "./validate";
import { addressLine, inUganda, trailFor } from "./geo";

/**
 * Reads the shared location fields (LocationPicker + address details + optional pin) from a form.
 * The location id must exist in the canonical list; coordinates must be a real pair inside Uganda.
 */
export async function readPlace(fd: FormData, o: { required?: boolean; minLevel?: "district" | "county" | "subcounty" } = {}) {
  const raw = String(fd.get("locationId") ?? "").trim();
  let locationId: string | null = null;
  if (raw) {
    const loc = await db.location.findUnique({ where: { id: raw }, select: { id: true, depth: true } });
    if (!loc) return fail("Choose the location from the list");
    const need = { district: 2, county: 3, subcounty: 4 }[o.minLevel ?? "district"];
    if (o.required && loc.depth < need) return fail("Choose at least the district (or city) — a region is too broad");
    locationId = loc.id;
  } else if (o.required) return fail("Choose where the property is — at least the district");

  const lat = Number(fd.get("lat")), lng = Number(fd.get("lng"));
  const hasPin = String(fd.get("lat") ?? "") !== "" && String(fd.get("lng") ?? "") !== "";
  if (hasPin && !(Number.isFinite(lat) && Number.isFinite(lng) && inUganda(lat, lng))) return fail("The map position isn't inside Uganda — pick it again");
  const src = String(fd.get("coordSource") ?? "");
  const acc = Number(fd.get("coordAccuracyM"));
  return {
    locationId,
    estate: await text(fd, "estate", "the estate / neighbourhood", { optional: true, max: 120 }),
    street: await text(fd, "street", "the street", { optional: true, max: 120 }),
    building: await text(fd, "building", "the building", { optional: true, max: 120 }),
    plot: await text(fd, "plot", "the plot number", { optional: true, max: 40 }),
    landmark: await text(fd, "landmark", "the landmark / directions", { optional: true, max: 300 }),
    lat: hasPin ? lat : null,
    lng: hasPin ? lng : null,
    coordAccuracyM: hasPin && Number.isFinite(acc) && acc > 0 ? Math.round(acc) : null,
    coordSource: hasPin ? (src === "gps" ? "gps" : "map") : null,
  };
}

/** The readable one-line address stored alongside the structured location. */
export async function placeLine(p: Awaited<ReturnType<typeof readPlace>>) {
  return addressLine(p, await trailFor(p.locationId));
}
