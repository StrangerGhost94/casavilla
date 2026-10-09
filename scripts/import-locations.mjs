// Loads Uganda's administrative locations (data/locations/uganda-v1.json.gz) into the database.
// Runs on every start after migrations. Idempotent: skips when this version + checksum is already loaded,
// and only ever inserts/updates — locations already used by properties, people or jobs are never deleted.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const file = fileURLToPath(new URL("../data/locations/uganda-v1.json.gz", import.meta.url));
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

async function client() {
  if (!process.env.LOCAL_PG_ADAPTER) return new PrismaClient();
  const { PrismaPg } = await import("@prisma/adapter-pg");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
}

const prisma = await client();
try {
  const { meta, rows } = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const current = await prisma.locationDataset.findUnique({ where: { id: meta.dataset } });
  if (current && current.version === meta.version && current.checksum === meta.checksum && !process.argv.includes("--force")) {
    console.log(`Locations: ${meta.dataset} ${meta.version} already loaded`);
  } else {
    const t0 = Date.now();
    const byId = new Map(rows.map((r) => [r[0], r]));
    const pathOf = new Map();
    const path = (id) => {
      if (pathOf.has(id)) return pathOf.get(id);
      const r = byId.get(id);
      if (!r) throw new Error(`Unknown parent ${id}`);
      const p = (r[1] ? path(r[1]) : "/") + id + "/";
      pathOf.set(id, p);
      return p;
    };
    // Parents first, so every foreign key already exists when its children arrive.
    const ordered = [...rows].sort((a, b) => path(a[0]).split("/").length - path(b[0]).split("/").length);
    const BATCH = 2000;
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < ordered.length; i += BATCH) {
        const chunk = ordered.slice(i, i + BATCH);
        const params = [];
        const values = chunk.map((r, j) => {
          const [id, parent, level, kind, name, aliases] = r;
          const p = path(id);
          params.push(id, parent, level, kind, name, [key(name), ...aliases.map(key)].join(" | "), p, p.split("/").length - 3, meta.version);
          const b = j * 9;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9})`;
        });
        await tx.$executeRawUnsafe(
          `INSERT INTO locations (id, parent_id, level, kind, name, search_key, path, depth, dataset_version) VALUES ${values.join(",")}
           ON CONFLICT (id) DO UPDATE SET parent_id = EXCLUDED.parent_id, level = EXCLUDED.level, kind = EXCLUDED.kind, name = EXCLUDED.name,
             search_key = EXCLUDED.search_key, path = EXCLUDED.path, depth = EXCLUDED.depth, dataset_version = EXCLUDED.dataset_version`,
          ...params,
        );
      }
      const aliasRows = rows.flatMap((r) => r[5].map((a) => [r[0], a, key(a)]));
      await tx.$executeRawUnsafe(`DELETE FROM location_aliases`);
      for (let i = 0; i < aliasRows.length; i += BATCH) {
        const chunk = aliasRows.slice(i, i + BATCH);
        await tx.$executeRawUnsafe(
          `INSERT INTO location_aliases (location_id, alias, alias_key) VALUES ${chunk.map((_, j) => `($${j * 3 + 1},$${j * 3 + 2},$${j * 3 + 3})`).join(",")} ON CONFLICT DO NOTHING`,
          ...chunk.flat(),
        );
      }
      await tx.locationDataset.upsert({
        where: { id: meta.dataset },
        create: { id: meta.dataset, version: meta.version, checksum: meta.checksum, source: meta.source, licence: meta.licence, sourceUpdated: meta.sourceUpdated, counts: meta.counts },
        update: { version: meta.version, checksum: meta.checksum, source: meta.source, licence: meta.licence, sourceUpdated: meta.sourceUpdated, counts: meta.counts, importedAt: new Date() },
      });
    }, { timeout: 300000, maxWait: 30000 });
    console.log(`Locations: imported ${rows.length} places (${meta.dataset} ${meta.version}) in ${Math.round((Date.now() - t0) / 1000)}s`);
  }
} catch (e) {
  // A failed import must never stop the app from starting; the System health page reports it.
  console.error("Locations import failed:", e);
} finally {
  await prisma.$disconnect();
}
