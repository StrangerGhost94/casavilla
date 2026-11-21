import "server-only";
import type { Prisma } from "@prisma/client";
import { trailFor, insideFilter } from "./geo";
import { inUganda } from "./geo-core";
import { SALE_KINDS } from "./sales";
import type { HomesFilter, ListingSort } from "./queries";

/** Cards per page on the public lists; the next page loads as you scroll. */
export const PAGE = 24;
type SP = Record<string, string | undefined>;

/** The homes-to-rent filters from the address bar, read the same way for the page and for each next page. */
export async function homesFilter(sp: SP): Promise<HomesFilter & { km: number; areaOk: boolean }> {
  const lat = Number(sp.lat), lng = Number(sp.lng), km = Math.min(50, Math.max(1, Number(sp.km) || 5));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng && inUganda(lat, lng) ? { lat, lng, km } : undefined;
  const area = await trailFor(sp.in);
  const sort = (["new", "price_asc", "price_desc"].includes(sp.sort ?? "") ? sp.sort : "new") as ListingSort;
  return {
    q: sp.q, max: Number(sp.max) || undefined, beds: Number(sp.beds) || undefined, in: area.length ? sp.in : undefined, near,
    furnished: sp.furnished === "1", selfContained: sp.sc === "1", sort, km, areaOk: area.length > 0,
  };
}

/** The for-sale filters from the address bar. */
export async function saleQuery(sp: SP) {
  const kind = (SALE_KINDS as readonly string[]).includes(sp.kind ?? "") ? sp.kind : undefined;
  const inside = sp.in ? await insideFilter(sp.in) : null;
  const max = Number(sp.max) || undefined;
  const q = sp.q?.trim();
  const where: Prisma.SaleListingWhereInput = {
    status: { in: ["active", "under_offer"] },
    ...(kind ? { kind } : {}),
    ...(max ? { price: { lte: max } } : {}),
    ...(sp.titled ? { titleStatus: "titled" } : {}),
    ...(inside ? { place: inside } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }, { estate: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const orderBy: Prisma.SaleListingOrderByWithRelationInput[] =
    sp.sort === "low" ? [{ price: "asc" }, { id: "desc" }] : sp.sort === "high" ? [{ price: "desc" }, { id: "desc" }] : [{ status: "asc" }, { publishedAt: "desc" }, { id: "desc" }];
  return { where, orderBy, kind, max, q };
}
