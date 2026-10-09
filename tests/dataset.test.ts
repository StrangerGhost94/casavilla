// The shipped Uganda dataset: identifiers, parent–child integrity, and real urban vs rural structures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

type Row = [string, string | null, string, string, string, string[]];
const { meta, rows } = JSON.parse(gunzipSync(readFileSync(new URL("../data/locations/uganda-v1.json.gz", import.meta.url))).toString()) as { meta: { counts: Record<string, number> }; rows: Row[] };
const by = new Map(rows.map((r) => [r[0], r]));
const ORDER = ["country", "region", "district", "county", "subcounty", "parish", "village"];
const trail = (id: string) => { const out: Row[] = []; let r = by.get(id); while (r) { out.unshift(r); r = r[1] ? by.get(r[1]) : undefined; } return out; };
const find = (name: string, level: string) => rows.filter((r) => r[4] === name && r[2] === level);

test("ids are unique and every parent exists", () => {
  assert.equal(by.size, rows.length);
  for (const r of rows) if (r[1]) assert.ok(by.has(r[1]), `${r[0]} has missing parent ${r[1]}`);
});

test("each level sits exactly one step below its parent", () => {
  for (const r of rows) {
    if (!r[1]) { assert.equal(r[2], "country"); continue; }
    assert.equal(ORDER.indexOf(r[2]), ORDER.indexOf(by.get(r[1])![2]) + 1, `${r[0]} (${r[2]}) under ${r[1]}`);
  }
});

test("counts match the source and all 135 districts have a region", () => {
  assert.deepEqual(meta.counts, { country: 1, region: 4, district: 135, county: 303, subcounty: 2120, parish: 10365, village: 71250 });
  for (const d of rows.filter((r) => r[2] === "district")) assert.equal(by.get(d[1]!)![2], "region");
});

test("Kampala is a city made of city divisions, with wards and cells", () => {
  const [kampala] = find("Kampala", "district");
  assert.equal(kampala[3], "City");
  const counties = rows.filter((r) => r[1] === kampala[0]);
  assert.ok(counties.length >= 5 && counties.every((c) => c[3] === "City division"));
  const ward = rows.find((r) => r[2] === "parish" && trail(r[0])[2][0] === kampala[0])!;
  assert.equal(ward[3], "Ward");
  assert.equal(rows.find((r) => r[1] === ward[0])![3], "Cell");
});

test("Wakiso has both municipalities (urban) and counties (rural)", () => {
  const [wakiso] = find("Wakiso", "district");
  const kinds = new Set(rows.filter((r) => r[1] === wakiso[0]).map((r) => r[3]));
  assert.ok(kinds.has("Municipality") && kinds.has("County"));
  const [kiraDiv] = find("Kira Division", "subcounty");
  assert.deepEqual(trail(kiraDiv[0]).map((r) => r[4]), ["Uganda", "Central Region", "Wakiso", "Kira Municipality", "Kira Division"]);
});

test("rural areas use sub-counties, parishes and villages", () => {
  const [gulu] = find("Gulu", "district");
  const aswa = rows.find((r) => r[1] === gulu[0] && r[3] === "County")!;
  const sc = rows.find((r) => r[1] === aswa[0])!;
  assert.equal(sc[3], "Sub-county");
  const parish = rows.find((r) => r[1] === sc[0])!;
  assert.equal(parish[3], "Parish");
  assert.equal(rows.find((r) => r[1] === parish[0])![3], "Village");
});

test("documented alternative spellings are searchable aliases", () => {
  assert.ok(find("Ssembabule", "district")[0][5].includes("Sembabule"));
  assert.ok(find("Rubaga Division North", "county")[0][5].some((a) => a.startsWith("Lubaga")));
  assert.ok(find("Kiziba (Masuliita)", "subcounty")[0][5].includes("Masuliita"));
});

test("Kakira is not inside Kira (similar names stay separate)", () => {
  const [kiraMun] = find("Kira Municipality", "county");
  for (const k of rows.filter((r) => r[4].startsWith("Kakira"))) assert.ok(!trail(k[0]).some((r) => r[0] === kiraMun[0]));
});
