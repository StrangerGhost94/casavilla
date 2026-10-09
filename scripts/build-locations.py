#!/usr/bin/env python3
"""
Builds data/locations/uganda-v1.json.gz from the ug-locale 1.0.0 npm package
(Uganda passport-office location list: districts → counties → sub-counties → parishes → villages)
plus the district → region grouping from Wikipedia "Districts of Uganda".

Run:  npm pack ug-locale@1.0.0 && tar xzf ug-locale-1.0.0.tgz && python3 scripts/build-locations.py package
Nothing is invented: every unit comes from the source files; aliases are only spelling variants
derived from the names themselves or documented official renamings listed below.
"""
import gzip, json, re, sys, hashlib

src = sys.argv[1]
load = lambda f: json.load(open(f"{src}/{f}.json"))
D, C, S, P, V = load("districts"), load("counties"), load("subcounties"), load("parishes"), load("villages")

REGIONS = {  # Wikipedia, Districts of Uganda (retrieved 2026-10-09)
  "C": ("Central Region", "Buikwe, Bukomansimbi, Butambala, Buvuma, Gomba, Kalangala, Kalungu, Kampala, Kasanda, Kayunga, Kiboga, Kyankwanzi, Kyotera, Luweero, Lwengo, Lyantonde, Masaka, Mityana, Mpigi, Mubende, Mukono, Nakaseke, Nakasongola, Rakai, Sembabule, Wakiso"),
  "E": ("Eastern Region", "Amuria, Budaka, Bududa, Bugiri, Bugweri, Bukedea, Bukwo, Bulambuli, Busia, Butaleja, Butebo, Buyende, Iganga, Jinja, Kaberamaido, Kalaki, Kaliro, Kamuli, Kapchorwa, Kapelebyong, Katakwi, Kibuku, Kumi, Kween, Luuka, Manafwa, Mayuge, Mbale, Namayingo, Namisindwa, Namutumba, Ngora, Pallisa, Serere, Sironko, Soroti, Tororo"),
  "N": ("Northern Region", "Abim, Adjumani, Agago, Alebtong, Amolatar, Amudat, Amuru, Apac, Arua, Dokolo, Gulu, Kaabong, Karenga, Kitgum, Koboko, Kole, Kotido, Kwania, Lamwo, Lira, Madi-Okollo, Maracha, Moroto, Moyo, Nabilatuk, Nakapiripirit, Napak, Nebbi, Nwoya, Obongi, Omoro, Otuke, Oyam, Pader, Pakwach, Terego, Yumbe, Zombo"),
  "W": ("Western Region", "Buhweju, Buliisa, Bundibugyo, Bunyangabu, Bushenyi, Hoima, Ibanda, Isingiro, Kabale, Kabarole, Kagadi, Kakumiro, Kamwenge, Kanungu, Kasese, Kazo, Kibaale, Kikuube, Kiruhura, Kiryandongo, Kisoro, Kitagwenda, Kyegegwa, Kyenjojo, Masindi, Mbarara, Mitooma, Ntoroko, Ntungamo, Rubanda, Rubirizi, Rukiga, Rukungiri, Rwampara, Sheema"),
}
# Same district, different spelling between the two sources.
SPELLING = {"SEMBABULE": "SSEMBABULE"}
# Documented alternative names (official renamings / common official spellings).
KNOWN_ALIASES = {
  "D:KAMPALA": ["Kampala Capital City", "KCCA"],
  "D:SSEMBABULE": ["Sembabule"],
  "D:LUWEERO": ["Luwero"],
  "D:MADI-OKOLLO": ["Madi Okollo"],
}
RUBAGA_ALIAS = ("RUBAGA", "LUBAGA")  # KCCA renamed Rubaga Division to Lubaga Division

key = lambda s: re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", s.lower())).strip()

def title(s):
    s = s.strip()
    out = re.sub(r"[A-Za-z]+(?:'[A-Za-z]+)?", lambda m: m.group(0).capitalize(), s.lower())
    return re.sub(r"\s+", " ", out)

region_of = {}
for code, (_, names) in REGIONS.items():
    for n in names.split(", "):
        region_of[SPELLING.get(n.upper(), n.upper())] = code
missing = [d["name"] for d in D if d["name"] not in region_of]
assert not missing, f"districts without a region: {missing}"

rows = []  # [id, parent, level, kind, name, aliases]
def add(i, parent, level, kind, raw, extra=()):
    name = title(raw)
    aliases = set()
    m = re.match(r"^(.*?)\s*\((.*?)\)\s*$", raw)
    if m:  # "KIZIBA(MASULIITA)" → both names searchable
        name = f"{title(m.group(1))} ({title(m.group(2))})"
        aliases |= {title(m.group(1)), title(m.group(2))}
    bare = re.sub(r"\b(COUNTY|MUNICIPALITY|DIVISION|TOWN COUNCIL|WARD|CITY)\b", " ", raw.upper()).strip()
    bare = re.sub(r"\s+", " ", bare).strip(" -")
    if bare and key(bare) != key(raw) and not m:
        aliases.add(title(bare))
    if "/" in raw:  # "BULIMA/BULANGALA" → each part searchable
        aliases |= {title(x) for x in raw.split("/") if x.strip()}
    if RUBAGA_ALIAS[0] in raw.upper():
        aliases.add(title(raw.upper().replace(*RUBAGA_ALIAS)))
    aliases |= set(extra)
    aliases = sorted(a for a in aliases if key(a) and key(a) != key(name))
    rows.append([i, parent, level, kind, name, aliases])

add("UG", None, "country", "Country", "UGANDA")
for code, (rname, _) in REGIONS.items():
    rows.append([f"UG-{code}", "UG", "region", "Region", rname, []])

urban = set()
for d in D:
    k = "City" if d["name"] == "KAMPALA" else "District"
    add(f"UG-D{d['id']}", f"UG-{region_of[d['name']]}", "district", k, d["name"], KNOWN_ALIASES.get(f"D:{d['name']}", []))
for c in C:
    n = c["name"].upper()
    k = "City division" if n.endswith("DIVISION") or " DIVISION " in n else "Municipality" if "MUNICIPALITY" in n else "City" if n.endswith(" CITY") else "County"
    if k != "County": urban.add(f"UG-CT{c['id']}")
    add(f"UG-CT{c['id']}", f"UG-D{c['district']}", "county", k, c["name"])
for s in S:
    n = s["name"].upper()
    # Inside a municipality or a Kampala city division, the next level down is a (municipal) division.
    k = "Town council" if "TOWN COUNCIL" in n else "Division" if "DIVISION" in n or f"UG-CT{s['county']}" in urban else "Sub-county"
    if k != "Sub-county" or f"UG-CT{s['county']}" in urban: urban.add(f"UG-SC{s['id']}")
    add(f"UG-SC{s['id']}", f"UG-CT{s['county']}", "subcounty", k, s["name"])
for p in P:
    k = "Ward" if "WARD" in p["name"].upper() or f"UG-SC{p['subcounty']}" in urban else "Parish"
    if k == "Ward": urban.add(f"UG-PA{p['id']}")
    add(f"UG-PA{p['id']}", f"UG-SC{p['subcounty']}", "parish", k, p["name"])
for v in V:
    add(f"UG-VI{v['id']}", f"UG-PA{v['parish']}", "village", "Cell" if f"UG-PA{v['parish']}" in urban else "Village", v["name"])

ids = {r[0] for r in rows}
assert len(ids) == len(rows), "duplicate ids"
assert all(r[1] is None or r[1] in ids for r in rows), "orphan rows"
digest = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
meta = {
  "dataset": "uganda-admin", "version": "1.0.0",
  "source": "Uganda passport-office location list (Ministry of Internal Affairs, passports.go.ug) via npm package ug-locale@1.0.0 (ISC licence); regions from Wikipedia 'Districts of Uganda' (CC BY-SA 4.0), retrieved 2026-10-09",
  "sourceUpdated": "2021-11-11", "licence": "ISC (package) / CC BY-SA 4.0 (region grouping)",
  "counts": {lvl: sum(1 for r in rows if r[2] == lvl) for lvl in ["country", "region", "district", "county", "subcounty", "parish", "village"]},
  "checksum": digest,
}
with gzip.open("data/locations/uganda-v1.json.gz", "wt", encoding="utf-8") as f:
    json.dump({"meta": meta, "rows": rows}, f, separators=(",", ":"), ensure_ascii=False)
print(json.dumps(meta, indent=1))
