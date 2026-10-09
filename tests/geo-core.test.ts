// Pure logic: normalisation, distances, path containment, ranking, address tokens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceKm, inUganda, pathIds, placeTokens, rankHit, searchKey, within, crumbText, fmtKm } from "../src/lib/geo-core";

test("search keys ignore case, punctuation and spacing", () => {
  assert.equal(searchKey("  Kiziba(Masuliita) "), "kiziba masuliita");
  assert.equal(searchKey("Makindye-Ssabagabo  Municipality"), "makindye ssabagabo municipality");
});

test("distance uses the haversine formula", () => {
  const kampala = { lat: 0.3136, lng: 32.5811 }, entebbe = { lat: 0.0512, lng: 32.4637 };
  const d = distanceKm(kampala, entebbe);
  assert.ok(d > 31 && d < 33, `Kampala–Entebbe ≈ 32 km, got ${d}`);
  assert.equal(distanceKm(kampala, kampala), 0);
  assert.equal(fmtKm(0.42), "420 m");
  assert.equal(fmtKm(3.456), "3.5 km");
});

test("Uganda bounds reject foreign or swapped coordinates", () => {
  assert.ok(inUganda(0.3136, 32.5811));
  assert.ok(!inUganda(32.5811, 0.3136));
  assert.ok(!inUganda(-1.29, 36.82)); // Nairobi
});

test("descendants are prefix matches of the materialised path, without false prefixes", () => {
  const wakiso = "/UG/UG-C/UG-D80/";
  assert.ok(within("/UG/UG-C/UG-D80/UG-CT203/UG-SC1254/", wakiso));
  assert.ok(within(wakiso, wakiso));
  assert.ok(!within("/UG/UG-C/UG-D8/", wakiso));
  assert.ok(!within("/UG/UG-C/UG-D800/", wakiso), "UG-D800 must not count as inside UG-D80");
  assert.deepEqual(pathIds(wakiso), ["UG", "UG-C", "UG-D80"]);
});

test("exact names outrank prefixes and contains; bigger places first among equals", () => {
  const exactVillage = rankHit("kira", "Kira", "kira", 6);
  const prefixMunicipality = rankHit("kira", "Kira Municipality", "kira municipality | kira", 3);
  const containsTown = rankHit("kira", "Kakira Town Council", "kakira town council | kakira", 4);
  assert.ok(prefixMunicipality < exactVillage, "Kira Municipality (alias Kira) outranks a village called Kira");
  assert.ok(prefixMunicipality < containsTown, "Kira Municipality must rank above Kakira");
});

test("old free-text addresses yield place words only", () => {
  assert.deepEqual(placeTokens("Plot 12, Rubaga Road, Kampala"), ["rubaga", "kampala"]);
  assert.deepEqual(placeTokens("P.O. Box 214887"), []);
});

test("breadcrumbs read root to leaf", () => {
  const t = [{ id: "UG", name: "Uganda", kind: "Country", level: "country" }, { id: "UG-C", name: "Central Region", kind: "Region", level: "region" }, { id: "UG-D80", name: "Wakiso", kind: "District", level: "district" }];
  assert.equal(crumbText(t), "Uganda → Central Region → Wakiso");
  assert.equal(crumbText(t, true), "Central Region → Wakiso");
});
