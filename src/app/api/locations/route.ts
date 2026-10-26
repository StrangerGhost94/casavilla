import { NextResponse, type NextRequest } from "next/server";
import { childrenOf, searchPlaces, trailFor } from "@/lib/geo";
import { placeCentre, reverseLookup } from "@/lib/geocode";

/**
 * Read-only lookups over the canonical Uganda location list (public data, safe to cache):
 *   ?parent=UG-D80        → the places directly inside it
 *   ?q=kira&within=UG-C   → search by name/alias, optionally inside one area
 *   ?id=UG-SC1254         → the full trail for one place
 *   ?near=0.35,32.61      → road, estate and official place at a GPS position / map pin (OpenStreetMap)
 *   ?centre=UG-PA2034     → roughly where a place is, to open the map there
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const ok = (data: unknown, cache = 86400) => NextResponse.json(data, { headers: { "Cache-Control": `public, max-age=${cache}, stale-while-revalidate=604800` } });
  try {
    if (sp.has("parent")) {
      const rows = await childrenOf(String(sp.get("parent")));
      return ok(rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, level: r.level, children: r._count.children })));
    }
    if (sp.has("q")) {
      const q = String(sp.get("q")).slice(0, 60);
      return ok(await searchPlaces(q, { withinId: sp.get("within"), limit: 12 }), 3600);
    }
    if (sp.has("id")) return ok(await trailFor(String(sp.get("id"))));
    if (sp.has("near")) {
      const [lat, lng] = String(sp.get("near")).split(",").map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "near=lat,lng" }, { status: 400 });
      return ok(await reverseLookup(lat, lng), 3600);
    }
    if (sp.has("centre")) return ok(await placeCentre(String(sp.get("centre")).slice(0, 40)), 86400);
    return NextResponse.json({ error: "Use ?parent=, ?q= or ?id=" }, { status: 400 });
  } catch (e) {
    console.error("locations api", e);
    return NextResponse.json({ error: "Location lookup failed" }, { status: 500 });
  }
}
