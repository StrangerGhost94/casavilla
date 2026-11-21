"use server";
import { db } from "@/db";
import { listedUnits } from "@/lib/queries";
import { homesFilter, PAGE, saleQuery } from "@/lib/browse";
import { PropertyCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";

type SP = Record<string, string | undefined>;
const clean = (sp: SP) => Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string").map(([k, v]) => [k, String(v).slice(0, 120)]));

/** The next page of homes to rent, as cards (infinite scroll). */
export async function moreHomes(sp: SP, page: number) {
  const f = await homesFilter(clean(sp));
  const p = Math.max(1, Math.min(50, Math.floor(page)));
  const homes = await listedUnits({ ...f, skip: p * PAGE, limit: PAGE });
  return { items: homes.map((h) => <PropertyCard key={h.id} h={h} />), done: homes.length < PAGE };
}

/** The next page of land and property for sale. */
export async function moreSale(sp: SP, page: number) {
  const { where, orderBy } = await saleQuery(clean(sp));
  const p = Math.max(1, Math.min(50, Math.floor(page)));
  const rows = await db.saleListing.findMany({ where, orderBy, skip: p * PAGE, take: PAGE, include: { _count: { select: { photos: true } } } });
  return { items: rows.map((l) => <SaleCard key={l.id} l={l} />), done: rows.length < PAGE };
}
