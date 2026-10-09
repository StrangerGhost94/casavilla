import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { distanceKm, insideFilter, searchKey, searchPlaces } from "./geo";

/**
 * Vacant, listed units. Area filtering always goes through the canonical location tree:
 * `in` = this place and everything inside it; free text `q` matches property names, old addresses, and
 * places whose name contains the searched words as whole words (so "Kira" never pulls in "Kakira").
 * `near` keeps only homes with a real pin within `km`, nearest first.
 */
export async function listedUnits(f: { q?: string; max?: number; beds?: number; limit?: number; in?: string; near?: { lat: number; lng: number; km: number } } = {}) {
  const or: Prisma.PropertyWhereInput[] = [];
  if (f.q) {
    const words = searchKey(f.q).split(" ").filter(Boolean);
    const hits = (await searchPlaces(f.q, { limit: 10 }))
      .filter((h) => h.level !== "country" && words.every((w) => [h.name, ...h.trail.map((c) => c.name)].some((n) => searchKey(n).split(" ").includes(w))));
    const paths = await db.location.findMany({ where: { id: { in: hits.map((h) => h.id) } }, select: { path: true } });
    or.push({ location: { contains: f.q, mode: "insensitive" } }, { name: { contains: f.q, mode: "insensitive" } }, { estate: { contains: f.q, mode: "insensitive" } }, { street: { contains: f.q, mode: "insensitive" } });
    for (const p of paths) or.push({ place: { path: { startsWith: p.path } } });
  }
  const inside = await insideFilter(f.in);
  const rows = await db.unit.findMany({
    where: {
      listed: true, status: "vacant", mode: "long",
      rent: f.max ? { lte: f.max } : undefined,
      bedrooms: f.beds ? { gte: f.beds } : undefined,
      property: {
        landlord: { status: "active" },
        ...(or.length ? { OR: or } : {}),
        ...(inside ? { place: inside } : {}),
        ...(f.near ? { lat: { not: null }, lng: { not: null } } : {}),
      },
    },
    include: { property: { include: { landlord: { select: { name: true } } } } },
    orderBy: { id: "desc" }, take: f.near ? 500 : f.limit ?? 60,
  });
  let list = rows.map((u) => ({
    id: u.id, label: u.label, rent: u.rent, bedrooms: u.bedrooms,
    propertyId: u.property.id, property: u.property.name, type: u.property.type, location: u.property.location,
    photoId: u.property.photoId, landlord: u.property.landlord.name,
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
      role: "provider", status: "active", services: { some: { active: true, ...(category ? { category } : {}) } },
      ...(sel ? { serviceAreas: { some: { location: { OR: [{ path: { startsWith: sel.path } }, { id: { in: sel.path.split("/").filter(Boolean) } }] } } } } : {}),
    },
    include: { services: { where: { active: true } }, serviceAreas: { include: { location: { select: { name: true } } } } },
    orderBy: { id: "asc" },
  });
  return list.map((p) => {
    const prices = p.services.map((s) => s.priceFrom).filter((n): n is number => n != null);
    return {
      id: p.id, name: p.businessName || p.name, area: p.serviceAreas.length ? p.serviceAreas.map((a) => a.location.name).join(", ") : p.area, bio: p.bio,
      categories: new Set(p.services.map((s) => s.category)),
      from: prices.length ? Math.min(...prices) : null,
    };
  });
}

export async function shopProducts(providerId?: number) {
  const rows = await db.product.findMany({
    where: { active: true, provider: { status: "active" }, ...(providerId ? { providerId } : {}) },
    include: { provider: { select: { id: true, name: true, businessName: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, price: p.price, stock: p.stock, photoId: p.photoId,
    providerId: p.provider.id, seller: p.provider.businessName, sellerName: p.provider.name,
  }));
}
