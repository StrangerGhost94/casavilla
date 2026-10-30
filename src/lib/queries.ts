import "server-only";
import type { Prisma } from "@prisma/client";
import { CASAVILLA_ONLY, db } from "@/db";
import { distanceKm, insideFilter, searchKey, searchPlaces } from "./geo";

/**
 * Conditions matching a typed area ("Ntinda", "Kira") on anything with an address: the readable address, the estate,
 * or a canonical place whose name contains the words as whole words — so "Kira" never pulls in "Kakira".
 * Works for properties and sale listings alike (both have location, estate and place).
 */
export async function areaMatch(q: string) {
  const words = searchKey(q).split(" ").filter(Boolean);
  const hits = (await searchPlaces(q, { limit: 10 }))
    .filter((h) => h.level !== "country" && words.every((w) => [h.name, ...h.trail.map((c) => c.name)].some((n) => searchKey(n).split(" ").includes(w))));
  const paths = await db.location.findMany({ where: { id: { in: hits.map((h) => h.id) } }, select: { path: true } });
  return [
    { location: { contains: q, mode: "insensitive" as const } },
    { estate: { contains: q, mode: "insensitive" as const } },
    ...paths.map((p) => ({ place: { path: { startsWith: p.path } } })),
  ];
}

/**
 * Vacant, listed units. Area filtering always goes through the canonical location tree:
 * `in` = this place and everything inside it; free text `q` matches property names, old addresses, and
 * places whose name contains the searched words as whole words (so "Kira" never pulls in "Kakira").
 * `near` keeps only homes with a real pin within `km`, nearest first.
 */
export type ListingSort = "new" | "price_asc" | "price_desc";

const listingInclude = { property: { include: { landlord: { select: { name: true } }, _count: { select: { photos: true } } } } } satisfies Prisma.UnitInclude;
type UnitRow = Prisma.UnitGetPayload<{ include: typeof listingInclude }>;

/** A unit as a listing card. */
const toListing = (u: UnitRow) => ({
  id: u.id, label: u.label, rent: u.rent, bedrooms: u.bedrooms,
  propertyId: u.property.id, property: u.property.name, type: u.property.type, location: u.property.location,
  photoId: u.property.photoId, landlord: u.property.landlord.name, verified: !!u.property.verifiedAt,
  bathrooms: u.bathrooms, furnished: u.furnished, selfContained: u.selfContained, sizeSqm: u.sizeSqm,
  photos: u.property._count.photos, video: !!u.property.videoUrl, isNew: Date.now() - u.createdAt.getTime() < 14 * 86_400_000,
});

/** Saved long-term homes as cards, newest saves first, each marked whether it's still on offer. */
export async function unitsAsListings(ids: number[]) {
  if (!ids.length) return [];
  const rows = await db.unit.findMany({ where: { id: { in: ids }, mode: "long" }, include: listingInclude });
  return ids.map((i) => rows.find((r) => r.id === i)).filter((u): u is UnitRow => !!u)
    .map((u) => ({ ...toListing(u), available: u.listed && u.status === "vacant" && !u.property.archivedAt }));
}

export async function listedUnits(f: { q?: string; max?: number; beds?: number; limit?: number; in?: string; near?: { lat: number; lng: number; km: number }; furnished?: boolean; selfContained?: boolean; sort?: ListingSort; exclude?: number } = {}) {
  const or: Prisma.PropertyWhereInput[] = [];
  if (f.q) {
    or.push({ name: { contains: f.q, mode: "insensitive" } }, { street: { contains: f.q, mode: "insensitive" } });
    or.push(...(await areaMatch(f.q)));
  }
  const inside = await insideFilter(f.in);
  const rows = await db.unit.findMany({
    where: {
      listed: true, status: "vacant", mode: "long",
      rent: f.max ? { lte: f.max } : undefined,
      bedrooms: f.beds ? { gte: f.beds } : undefined,
      furnished: f.furnished || undefined,
      selfContained: f.selfContained || undefined,
      id: f.exclude ? { not: f.exclude } : undefined,
      property: {
        landlord: { status: "active" },
        ...(or.length ? { OR: or } : {}),
        ...(inside ? { place: inside } : {}),
        ...(f.near ? { lat: { not: null }, lng: { not: null } } : {}),
      },
    },
    include: listingInclude,
    orderBy: f.sort === "price_asc" ? { rent: "asc" } : f.sort === "price_desc" ? { rent: "desc" } : { id: "desc" }, take: f.near ? 500 : f.limit ?? 60,
  });
  let list = rows.map((u) => ({
    ...toListing(u),
    distance: f.near && u.property.lat != null && u.property.lng != null ? distanceKm(f.near, { lat: u.property.lat, lng: u.property.lng }) : undefined,
  }));
  if (f.near) list = list.filter((h) => h.distance! <= f.near!.km).sort((a, b) => a.distance! - b.distance!).slice(0, f.limit ?? 60);
  return list;
}

/** Approved providers; with `inId`, only those whose service areas overlap that place (cover it, or work inside it). */
export async function activeProviders(category?: string, inId?: string) {
  const sel = inId ? await db.location.findUnique({ where: { id: inId }, select: { path: true } }) : null;
  const list = await db.user.findMany({
    where: {
      role: "provider", status: "active", services: { some: { active: true, category: category && !CASAVILLA_ONLY.includes(category) ? category : { notIn: CASAVILLA_ONLY } } },
      ...(sel ? { serviceAreas: { some: { location: { OR: [{ path: { startsWith: sel.path } }, { id: { in: sel.path.split("/").filter(Boolean) } }] } } } } : {}),
    },
    include: { services: { where: { active: true, category: { notIn: CASAVILLA_ONLY } } }, serviceAreas: { include: { location: { select: { name: true } } } } },
    orderBy: { id: "asc" },
  });
  // Track record: finished jobs and their average star rating.
  const stats = list.length ? await db.job.groupBy({ by: ["providerId"], where: { providerId: { in: list.map((p) => p.id) }, status: "done" }, _count: { _all: true, rating: true }, _avg: { rating: true } }) : [];
  return list.map((p) => {
    const prices = p.services.map((s) => s.priceFrom).filter((n): n is number => n != null);
    const st = stats.find((x) => x.providerId === p.id);
    return {
      id: p.id, name: p.businessName || p.name, area: p.serviceAreas.length ? p.serviceAreas.map((a) => a.location.name).join(", ") : p.area, bio: p.bio,
      categories: new Set(p.services.map((s) => s.category)),
      from: prices.length ? Math.min(...prices) : null,
      jobsDone: st?._count._all ?? 0, ratings: st?._count.rating ?? 0, rating: st?._avg.rating ?? null,
    };
  });
}

export async function shopProducts(providerId?: number) {
  const rows = await db.product.findMany({
    // House plans are CasaVilla's own now (/build/plans), not sold by shops.
    where: { active: true, provider: { status: "active" }, OR: [{ category: null }, { category: { not: "House plans" } }], ...(providerId ? { providerId } : {}) },
    include: { provider: { select: { id: true, name: true, businessName: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, price: p.price, stock: p.stock, photoId: p.photoId, category: p.category,
    providerId: p.provider.id, seller: p.provider.businessName, sellerName: p.provider.name,
  }));
}
