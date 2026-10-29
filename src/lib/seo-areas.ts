import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { areaMatch, listedUnits } from "./queries";
import { SEO_KINDS, type SeoKind } from "./seo";

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };

export async function rentIn(area: string, limit = 60) {
  return area.toLowerCase() === "kampala" ? listedUnits({ limit }) : listedUnits({ q: area, limit });
}

export async function staysIn(area: string, limit = 60) {
  const where = area.toLowerCase() === "kampala" ? {} : { OR: await areaMatch(area) };
  return db.unit.findMany({
    where: { mode: "short", listed: true, nightlyRate: { not: null }, property: { archivedAt: null, landlord: { status: "active" }, ...where } },
    include: { property: { include: { _count: { select: { photos: true } } } } }, orderBy: { nightlyRate: "asc" }, take: limit,
  });
}

export async function salesIn(area: string, saleKind: string | null, limit = 60) {
  const where = area.toLowerCase() === "kampala" ? {} : { OR: (await areaMatch(area)) as Prisma.SaleListingWhereInput[] };
  const kinds = saleKind === "land" ? ["land", "farm"] : saleKind === "house" ? ["house", "apartment"] : undefined;
  return db.saleListing.findMany({
    where: { status: { in: ["active", "under_offer"] }, ...(kinds ? { kind: { in: kinds } } : {}), ...where },
    include: { _count: { select: { photos: true } } }, orderBy: [{ status: "asc" }, { publishedAt: "desc" }], take: limit,
  });
}

/** Listings for an area page (used for the page and to keep empty pages out of the sitemap). */
export async function areaListings(kind: SeoKind, area: string, limit = 60): Promise<unknown[]> {
  const k = SEO_KINDS[kind];
  if (k.market === "rent") return rentIn(area, limit);
  if (k.market === "stays") return staysIn(area, limit);
  return salesIn(area, k.saleKind, limit);
}

/** The numbers an area page states: typical rent per bedroom count, cheapest night, lowest price. */
export function rentFacts(rows: { rent: number; bedrooms: number }[]) {
  const byBeds = new Map<number, number[]>();
  for (const r of rows) byBeds.set(Math.min(r.bedrooms, 4), [...(byBeds.get(Math.min(r.bedrooms, 4)) ?? []), r.rent]);
  return {
    count: rows.length,
    from: rows.length ? Math.min(...rows.map((r) => r.rent)) : 0,
    typical: median(rows.map((r) => r.rent)),
    byBeds: [...byBeds].sort((a, b) => a[0] - b[0]).map(([beds, rents]) => ({ beds, typical: median(rents), count: rents.length })),
  };
}
