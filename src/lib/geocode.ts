import "server-only";
import { areaNames, inUganda } from "./geo-core";
import { suggestFromText, trailFor, type Hit } from "./geo";

/**
 * OpenStreetMap lookups (Nominatim), used only while someone is entering an address:
 *  - reverse: a GPS position or map pin → road, estate and our official place, offered as a suggestion;
 *  - centre:  an official place → roughly where it is, so "Pick on map" opens on the right area.
 * Results are cached in memory; failures just mean no suggestion (the person types the address instead).
 * Nominatim's policy asks for an identifying User-Agent and at most ~1 request a second, which address
 * entry stays well under.
 */
const UA = "CasaVilla/1.0 (property management, Uganda; info.casavilla026@gmail.com)";
const cache = new Map<string, { at: number; v: unknown }>();
const DAY = 86_400_000;

async function osm<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 7 * DAY) return hit.v as T;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org${path}`, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const v = (await r.json()) as T;
    if (cache.size > 2000) cache.clear();
    cache.set(path, { at: Date.now(), v });
    return v;
  } catch { return null; }
}

type OsmAddress = Partial<Record<"road" | "neighbourhood" | "suburb" | "quarter" | "hamlet" | "village" | "city_district" | "town" | "city" | "municipality" | "county" | "state_district" | "state", string>>;

export type Reverse = { street: string | null; estate: string | null; place: Hit | null; label: string | null };

/** What's at this spot: the road, the estate/neighbourhood, and the matching official place (if one fits). */
export async function reverseLookup(lat: number, lng: number): Promise<Reverse> {
  const none: Reverse = { street: null, estate: null, place: null, label: null };
  if (!inUganda(lat, lng)) return none;
  const j = await osm<{ address?: OsmAddress; display_name?: string }>(`/reverse?format=jsonv2&zoom=17&addressdetails=1&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}`);
  const a = j?.address;
  if (!a) return none;
  const estate = a.neighbourhood || a.suburb || a.quarter || a.hamlet || a.village || null;
  const bigger = [a.city_district, a.town || a.city || a.municipality, a.county, a.state_district].filter(Boolean) as string[];
  // Most specific first: the estate inside its town/district; then the suburb; then the town alone.
  let place: Hit | null = null;
  for (const text of [[estate, ...bigger], [a.suburb, ...bigger], bigger].map((x) => x.filter(Boolean).join(", "))) {
    if (!text) continue;
    const s = await suggestFromText(text);
    if (s.best) { place = s.best; break; }
  }
  // suggestFromText returns a trail that may not include the place itself; make it complete.
  if (place && !place.trail.some((c) => c.id === place!.id)) place = { ...place, trail: [...place.trail, place] };
  const label = place ? areaNames(place.trail).join(", ") : null;
  return { street: a.road ?? null, estate, place, label };
}

/** Roughly where an official place is (for opening the map there). */
export async function placeCentre(id: string): Promise<{ lat: number; lng: number; zoom: number } | null> {
  const trail = await trailFor(id);
  if (!trail.length) return null;
  const parts = trail.filter((c) => !["country", "region"].includes(c.level)).map((c) => c.name.replace(/\s+(Division|Municipality|Ward|Cell|Town Council)$/i, "")).reverse();
  const zoom = { district: 11, county: 12, subcounty: 13, parish: 15, village: 16 }[trail[trail.length - 1].level] ?? 12;
  // Try the full name chain first, then progressively broader.
  for (let i = 0; i < Math.min(parts.length, 3); i++) {
    const q = [...parts.slice(i, i + 3), "Uganda"].join(", ");
    const j = await osm<{ lat: string; lon: string }[]>(`/search?format=jsonv2&limit=1&countrycodes=ug&q=${encodeURIComponent(q)}`);
    const r = j?.[0];
    if (r && inUganda(Number(r.lat), Number(r.lon))) return { lat: Number(r.lat), lng: Number(r.lon), zoom: Math.max(11, zoom - i * 2) };
  }
  return null;
}

