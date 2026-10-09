# Uganda location dataset

`uganda-v1.json.gz` is built by `scripts/build-locations.py` and imported by `scripts/import-locations.mjs`
(runs on every start; skips when the same version + checksum is already loaded).

| | |
|---|---|
| Administrative units | Uganda passport-office location list (Ministry of Internal Affairs, passports.go.ug), as packaged in the npm package [`ug-locale@1.0.0`](https://www.npmjs.com/package/ug-locale) (ISC licence, published 2021-11-11) |
| Region grouping | Wikipedia, [Districts of Uganda](https://en.wikipedia.org/wiki/Districts_of_Uganda) (CC BY-SA 4.0), retrieved 2026-10-09 |
| Levels | Country → Region → District / City → County / Municipality / City division → Sub-county / Town council / Division → Parish / Ward → Village / Cell |
| Counts | 4 regions, 135 districts, 303 counties, 2,120 sub-counties, 10,365 parishes, 71,250 villages |
| IDs | `UG`, `UG-C/E/N/W` (ISO 3166-2 region codes), then `UG-D…` (district), `UG-CT…`, `UG-SC…`, `UG-PA…`, `UG-VI…` built from the source's own numeric IDs, so they stay stable across re-imports |
| Coordinates | None in the source. Exact property positions come only from the user's GPS or a map pin. |

Validation done at build time: unique IDs, every child has an existing parent, every district has a region.
Known gaps: the list predates the 2020–2023 city upgrades (e.g. Gulu, Mbarara appear as municipalities) and
newer districts such as Terego. Do not hand-add units — import a newer official version instead.
