import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { ugx } from "./format";
import { insideFilter, trailFor } from "./geo";
import { listedUnits } from "./queries";
import { KIND, shortUgx, type SaleKind } from "./sales";

export type SaveKind = "rent" | "stay" | "sale";
export type AlertKind = "rent" | "stays" | "sale";
export type AlertParams = Record<string, string>;

/** Which homes this person has saved, by kind. */
export async function savedIds(userId: number) {
  const rows = await db.savedListing.findMany({ where: { userId }, select: { kind: true, itemId: true } });
  const out: Record<SaveKind, number[]> = { rent: [], stay: [], sale: [] };
  for (const r of rows) out[r.kind as SaveKind]?.push(r.itemId);
  return out;
}

/** Filters an alert keeps from a results page (anything else in the URL is ignored). */
export const ALERT_KEYS: Record<AlertKind, string[]> = {
  rent: ["q", "in", "beds", "max", "furnished", "sc"],
  stays: ["q", "in", "guests", "max"],
  sale: ["q", "in", "kind", "max", "titled"],
};
export const cleanParams = (kind: AlertKind, p: Record<string, unknown>): AlertParams =>
  Object.fromEntries(ALERT_KEYS[kind].map((k) => [k, String(p[k] ?? "").trim().slice(0, 80)]).filter(([, v]) => v));

/** "Homes to rent · Ntinda · 2+ bedrooms · up to UGX 800,000" */
export async function alertLabel(kind: AlertKind, p: AlertParams) {
  const area = p.in ? (await trailFor(p.in)).at(-1)?.name : null;
  const bits = [
    kind === "rent" ? "Homes to rent" : kind === "stays" ? "Short stays" : p.kind ? KIND[p.kind as SaleKind]?.plural ?? "For sale" : "Land & property for sale",
    area ?? (p.q || null),
    p.beds && `${p.beds}+ bedrooms`, p.guests && `${p.guests}+ guests`,
    p.furnished && "furnished", p.sc && "self-contained", p.titled && "with title",
    p.max && `up to ${kind === "sale" ? shortUgx(Number(p.max)) : ugx(Number(p.max))}`,
  ].filter(Boolean);
  return bits.join(" · ").slice(0, 200);
}

/** The results page an alert came from. */
export const alertHref = (kind: AlertKind, p: AlertParams) => `/${kind === "rent" ? "listings" : kind}${Object.keys(p).length ? `?${new URLSearchParams(p)}` : ""}`;

/** Newest listing id of a kind (an alert only tells about listings after the one current when it was made). */
export async function newestId(kind: AlertKind) {
  if (kind === "sale") return (await db.saleListing.aggregate({ _max: { id: true } }))._max.id ?? 0;
  return (await db.unit.aggregate({ _max: { id: true }, where: { mode: kind === "stays" ? "short" : "long" } }))._max.id ?? 0;
}

/** Listing ids matching an alert that are newer than `afterId` (newest first). */
export async function matchesAfter(kind: AlertKind, p: AlertParams, afterId: number, notOwner?: number): Promise<number[]> {
  if (kind === "rent") {
    const rows = await listedUnits({ q: p.q, in: p.in, beds: Number(p.beds) || undefined, max: Number(p.max) || undefined, furnished: p.furnished === "1", selfContained: p.sc === "1", limit: 60 });
    return rows.filter((h) => h.id > afterId).map((h) => h.id);
  }
  const inside = p.in ? await insideFilter(p.in) : null;
  if (kind === "stays") {
    const rows = await db.unit.findMany({
      where: {
        id: { gt: afterId }, mode: "short", listed: true, nightlyRate: Number(p.max) ? { not: null, lte: Number(p.max) } : { not: null },
        maxGuests: { gte: Number(p.guests) || 1 },
        property: { archivedAt: null, landlord: { status: "active" }, ...(notOwner ? { landlordId: { not: notOwner } } : {}), ...(inside ? { place: inside } : {}),
          ...(p.q ? { OR: [{ name: { contains: p.q, mode: "insensitive" } }, { location: { contains: p.q, mode: "insensitive" } }] } : {}) },
      },
      select: { id: true }, orderBy: { id: "desc" }, take: 30,
    });
    return rows.map((r) => r.id);
  }
  const where: Prisma.SaleListingWhereInput = {
    id: { gt: afterId }, status: "active",
    ...(p.kind ? { kind: p.kind } : {}), ...(Number(p.max) ? { price: { lte: Number(p.max) } } : {}), ...(p.titled ? { titleStatus: "titled" } : {}),
    ...(inside ? { place: inside } : {}), ...(notOwner ? { ownerId: { not: notOwner } } : {}),
    ...(p.q ? { OR: [{ title: { contains: p.q, mode: "insensitive" } }, { location: { contains: p.q, mode: "insensitive" } }] } : {}),
  };
  return (await db.saleListing.findMany({ where, select: { id: true }, orderBy: { id: "desc" }, take: 30 })).map((r) => r.id);
}
