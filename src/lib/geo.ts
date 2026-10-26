import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { inMetro, niceName, pathIds, placeTokens, rankHit, searchKey, within, type Crumb } from "./geo-core";

export * from "./geo-core";

export type Hit = Crumb & { trail: Crumb[]; depth: number };

const crumbSelect = { id: true, name: true, kind: true, level: true } as const;
const tidy = <T extends { name: string }>(r: T): T => ({ ...r, name: niceName(r.name) });

/** Ancestors + self, root first, for one location. */
export async function trailFor(id: string | null | undefined): Promise<Crumb[]> {
  if (!id) return [];
  const loc = await db.location.findUnique({ where: { id }, select: { path: true } });
  if (!loc) return [];
  const ids = pathIds(loc.path);
  const rows = await db.location.findMany({ where: { id: { in: ids } }, select: crumbSelect });
  return ids.map((i) => rows.find((r) => r.id === i)!).filter(Boolean).map(tidy);
}

/** Trails for many locations at once (one query for all their ancestors). */
export async function trailsFor(ids: (string | null | undefined)[]): Promise<Map<string, Crumb[]>> {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))];
  if (!uniq.length) return new Map();
  const locs = await db.location.findMany({ where: { id: { in: uniq } }, select: { id: true, path: true } });
  const all = [...new Set(locs.flatMap((l) => pathIds(l.path)))];
  const rows = new Map((await db.location.findMany({ where: { id: { in: all } }, select: crumbSelect })).map((r) => [r.id, tidy(r)]));
  return new Map(locs.map((l) => [l.id, pathIds(l.path).map((i) => rows.get(i)!).filter(Boolean)]));
}

export async function childrenOf(parentId: string) {
  return (await db.location.findMany({ where: { parentId }, select: { ...crumbSelect, _count: { select: { children: true } } }, orderBy: { name: "asc" } })).map(tidy);
}

/**
 * Finds places by name or alias. `withinId` limits results to one area (e.g. only inside Wakiso).
 * Results carry their full trail, so "Kira Division (Wakiso)" can't be confused with a similarly named place elsewhere.
 */
export async function searchPlaces(q: string, o: { withinId?: string | null; limit?: number; maxDepth?: number } = {}): Promise<Hit[]> {
  const k = searchKey(q);
  if (k.length < 2) return [];
  const scope = o.withinId ? await db.location.findUnique({ where: { id: o.withinId }, select: { path: true } }) : null;
  const rows = await db.location.findMany({
    where: {
      searchKey: { contains: k },
      ...(scope ? { path: { startsWith: scope.path } } : {}),
      ...(o.maxDepth != null ? { depth: { lte: o.maxDepth } } : {}),
    },
    select: { ...crumbSelect, searchKey: true, depth: true, path: true },
    take: 400,
  });
  // Greater Kampala first: "Kololo" should find Kololo in Kampala before a village of the same name upcountry.
  const top = rows
    .map((r) => ({ r, score: rankHit(q, r.name, r.searchKey, r.depth) - (inMetro(r.path) ? 15 : 0) }))
    .sort((a, b) => a.score - b.score || a.r.name.localeCompare(b.r.name))
    .slice(0, o.limit ?? 15);
  const trails = await trailsFor(top.map((t) => t.r.id));
  return top.map(({ r }) => ({ id: r.id, name: niceName(r.name), kind: r.kind, level: r.level, depth: r.depth, trail: trails.get(r.id) ?? [] }));
}

/** Prisma filter: the record's location is this place or anywhere inside it. */
export async function insideFilter(locationId: string | null | undefined): Promise<Prisma.LocationWhereInput | null> {
  if (!locationId) return null;
  const loc = await db.location.findUnique({ where: { id: locationId }, select: { path: true } });
  return loc ? { path: { startsWith: loc.path } } : null;
}

/** Validates a submitted location id (it must exist in the canonical list). */
export async function validLocationId(raw: FormDataEntryValue | null): Promise<string | null | false> {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id) return null;
  return (await db.location.findUnique({ where: { id }, select: { id: true } })) ? id : false;
}

/**
 * Best guess for an old free-text address. Each word is looked up; a place whose own trail also contains
 * the other words wins (so "Rubaga Road, Kampala" prefers places inside Kampala). When several places fit
 * equally well, their shared parent is suggested instead — never a guess at the finer level.
 */
export async function suggestFromText(text: string): Promise<{ best: Hit | null; options: Hit[] }> {
  const tokens = placeTokens(text);
  if (!tokens.length) return { best: null, options: [] };
  const hits = (await Promise.all(tokens.map((t) => searchPlaces(t, { limit: 40, maxDepth: 5 })))).flat()
    .filter((h) => tokens.some((t) => searchKey(h.name).split(" ").includes(t) || searchKey(h.name) === t));
  if (!hits.length) return { best: null, options: [] };
  const scored = hits.map((h) => {
    const names = h.trail.map((c) => searchKey(c.name));
    const matched = tokens.filter((t) => names.some((n) => n.split(" ").includes(t))).length;
    return { h, matched };
  });
  const most = Math.max(...scored.map((s) => s.matched));
  const top = [...new Map(scored.filter((s) => s.matched === most).map((s) => [s.h.id, s.h])).values()].sort((a, b) => a.depth - b.depth);
  // Drop candidates that are ancestors of another candidate: keep the most specific ones.
  const specific = top.filter((a) => !top.some((b) => b.id !== a.id && b.trail.some((c) => c.id === a.id)));
  if (specific.length === 1) return { best: specific[0], options: specific };
  // Ambiguous: offer the deepest place all candidates share.
  const shared = specific[0].trail.filter((c) => specific.every((s) => s.trail.some((x) => x.id === c.id)));
  const common = shared[shared.length - 1];
  const best = common && common.level !== "country" && common.level !== "region"
    ? { ...common, depth: shared.length - 1, trail: shared }
    : null;
  return { best, options: specific.slice(0, 6) };
}

/** Does a provider's service area cover this place? Returns the covering area's level, or null. */
export async function coverage(providerId: number, locationPath: string | null | undefined) {
  if (!locationPath) return null;
  const areas = await db.providerArea.findMany({ where: { providerId }, select: { location: { select: { path: true, level: true, name: true } } } });
  const hit = areas.map((a) => a.location).filter((a) => within(locationPath, a.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return hit ?? null;
}
