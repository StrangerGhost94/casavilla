// Against a real database with the dataset imported and the demo seed loaded (skipped otherwise):
// search, aliases, suggestions for old addresses, district-wide filtering, provider coverage, area reports.
import { test, after } from "node:test";
import assert from "node:assert/strict";

const enabled = !!process.env.DATABASE_URL && !!process.env.GEO_DB_TESTS;
const t = enabled ? test : test.skip;
const load = async () => {
  const [geo, queries, insights, areas, { db }] = await Promise.all([
    import("../src/lib/geo"), import("../src/lib/queries"), import("../src/lib/insights"), import("../src/components/AreaReport"), import("../src/db"),
  ]);
  return { geo, queries, insights, areas, db };
};
after(async () => { if (enabled) (await import("../src/db")).db.$disconnect(); });

t("search finds Kira in Wakiso, by name and alias, with its full trail", async () => {
  const { geo } = await load();
  const hits = await geo.searchPlaces("kira");
  assert.equal(hits[0].name, "Kira Municipality");
  assert.ok(hits[0].trail.some((c) => c.name === "Wakiso"));
  const alias = await geo.searchPlaces("Sembabule");
  assert.equal(alias[0].name, "Ssembabule");
  const lubaga = await geo.searchPlaces("lubaga");
  assert.ok(lubaga.some((h) => h.name.startsWith("Rubaga Division")));
  assert.deepEqual(await geo.searchPlaces("x"), [], "one letter is not a search");
});

t("search can be limited to one area", async () => {
  const { geo, db } = await load();
  const kampala = await db.location.findFirstOrThrow({ where: { name: "Kampala", level: "district" } });
  const hits = await geo.searchPlaces("kira", { withinId: kampala.id });
  assert.ok(hits.every((h) => h.trail.some((c) => c.id === kampala.id)));
});

t("children are the valid next level only", async () => {
  const { geo, db } = await load();
  const wakiso = await db.location.findFirstOrThrow({ where: { name: "Wakiso", level: "district" } });
  const kids = await geo.childrenOf(wakiso.id);
  assert.ok(kids.length > 3 && kids.every((k) => k.level === "county"));
});

t("old address text gets a suggestion inside the right city", async () => {
  const { geo } = await load();
  const s = await geo.suggestFromText("Rubaga Road, Kampala");
  assert.ok(s.best, "expected a suggestion");
  assert.ok(s.best!.trail.some((c) => c.name === "Kampala"));
  const none = await geo.suggestFromText("Plot 4");
  assert.equal(none.best, null);
});

t("district-wide filter includes everything inside it, and nothing outside", async () => {
  const { queries, db } = await load();
  const wakiso = await db.location.findFirstOrThrow({ where: { name: "Wakiso", level: "district" } });
  const kampala = await db.location.findFirstOrThrow({ where: { name: "Kampala", level: "district" } });
  const inW = await queries.listedUnits({ in: wakiso.id });
  const inK = await queries.listedUnits({ in: kampala.id });
  assert.ok(inW.every((h) => h.property === "Kira Heights"));
  assert.ok(!inK.some((h) => h.property === "Kira Heights"));
});

t("a provider covering Kampala ranks above one with no area for a Kampala job", async () => {
  const { insights, db } = await load();
  const kampalaSub = await db.location.findFirstOrThrow({ where: { name: "Kampala Central", level: "subcounty" } });
  const ranked = await insights.rankProviders({ category: "Cleaning", propertyId: null, providerId: null, locationId: kampalaSub.id });
  const sparkle = ranked.find((r) => r.name === "Sparkle Clean UG")!;
  assert.ok(sparkle.reasons.some((x) => x.startsWith("Covers Kampala")));
});

t("area report groups by district from canonical locations", async () => {
  const { areas } = await load();
  const rows = await areas.areaFigures({ by: "district" });
  const wakiso = rows.find((r) => r.name === "Wakiso");
  assert.ok(wakiso && wakiso.properties >= 1);
  assert.ok(rows.some((r) => r.name === "Not yet located"), "unverified legacy properties are reported, not guessed");
});
