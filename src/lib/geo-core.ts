// Pure location helpers shared by the server, the browser and the tests (no database access here).

export const LEVELS = ["country", "region", "district", "county", "subcounty", "parish", "village"] as const;
export type Level = (typeof LEVELS)[number];

/** Generic names for the next level down, used when a place has no children loaded yet. */
export const LEVEL_LABEL: Record<Level, string> = {
  country: "Country", region: "Region", district: "District / city", county: "County / municipality / division",
  subcounty: "Sub-county / town council / division", parish: "Parish / ward", village: "Village / cell",
};

/** Same normalisation as scripts/import-locations.mjs — keep them identical. */
export const searchKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/** Ids in a materialised path, root first: "/UG/UG-C/UG-D80/" → ["UG", "UG-C", "UG-D80"]. */
export const pathIds = (path: string) => path.split("/").filter(Boolean);

/** Is `inner` the same place as `outer`, or inside it? (Both are materialised paths.) */
export const within = (innerPath: string, outerPath: string) => innerPath.startsWith(outerPath);

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371.0088;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Uganda's bounding box (with a small margin) — coordinates outside it are rejected. */
export const inUganda = (lat: number, lng: number) => lat >= -1.6 && lat <= 4.3 && lng >= 29.5 && lng <= 35.1;

export const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km < 10 && !Number.isInteger(km) ? km.toFixed(1) : Math.round(km)} km`);

export type Crumb = { id: string; name: string; kind: string; level: string };

/** "Uganda → Central Region → Wakiso → Kira Municipality". The country is dropped when `short`. */
export const crumbText = (trail: Crumb[], short = false) => (short ? trail.filter((c) => c.level !== "country") : trail).map((c) => c.name).join(" → ");

/** Ranks a search hit: exact name (or alias) beats prefix beats contains; bigger places first among equals. */
export function rankHit(q: string, name: string, keyStr: string, depth: number) {
  const k = searchKey(q), n = searchKey(name);
  // An alias that equals the query ("Kira" for Kira Municipality) counts as an exact name.
  const base = n === k || keyStr.split(" | ").some((a) => a === k) ? 0 : n.startsWith(k) ? 1 : keyStr.includes(` ${k}`) || keyStr.startsWith(k) ? 2 : 3;
  return base * 10 + depth;
}

/**
 * Words in an old free-text address that could name a place ("Rubaga Road, Kampala" → ["rubaga", "kampala"]).
 * Street words and very short tokens are ignored.
 */
const NOISE = new Set(["road", "rd", "street", "st", "avenue", "ave", "lane", "close", "plot", "block", "near", "opposite", "off", "behind", "next", "to", "the", "and", "of", "uganda", "district", "city", "town", "village", "zone", "estate", "house", "apartments", "apt", "p", "o", "box"]);
export const placeTokens = (text: string) => [...new Set(searchKey(text).split(" ").filter((w) => w.length >= 3 && !NOISE.has(w) && !/^\d+$/.test(w)))];
