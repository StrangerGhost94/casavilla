// Clears the test data before the app is handed over. Run it yourself, against the database you mean to clear.
//
//   Look first (deletes nothing):   KEEP_EMAILS=a@x.com,b@y.com node scripts/handover-reset.mjs
//   Delete for real:                KEEP_EMAILS=a@x.com,b@y.com CONFIRM=DELETE-TEST-DATA node scripts/handover-reset.mjs
//
// Kept: the office accounts named in KEEP_EMAILS, Uganda's locations, and CasaVilla's own house plans and finished
// projects with their photos (add WIPE_BUILD_CONTENT=1 to clear those too).
// Deleted: every other account (tenants, landlords, providers, old caretakers, other staff) and everything that
// belongs to them: properties, leases, charges, payments, receipts, repairs, bookings, sale listings, building
// sites, documents, messages, notifications and the activity history. Numbering starts again from 1.
// It cannot be undone, so take a database backup first.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const keepEmails = (process.env.KEEP_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const really = process.env.CONFIRM === "DELETE-TEST-DATA";
const wipeBuild = process.env.WIPE_BUILD_CONTENT === "1";
const q = (sql, ...args) => db.$queryRawUnsafe(sql, ...args);
const n = async (sql, ...args) => Number((await q(sql, ...args))[0].n);

const ALWAYS = ["users", "files", "file_variants", "locations", "location_aliases", "location_datasets", "brand_profiles", "_prisma_migrations"];
const BUILD = ["house_plans", "build_projects", "build_photos"];
const keepTables = new Set([...ALWAYS, ...(wipeBuild ? [] : BUILD)]);

try {
  if (!keepEmails.length) throw new Error("Set KEEP_EMAILS to the office account(s) to keep, e.g. KEEP_EMAILS=office@example.com");
  const kept = await q(`SELECT id, email, role, super_admin FROM users WHERE lower(email) = ANY($1::text[])`, keepEmails);
  const missing = keepEmails.filter((e) => !kept.some((k) => k.email.toLowerCase() === e));
  if (missing.length) throw new Error(`No account found for: ${missing.join(", ")}. Nothing was changed.`);
  if (kept.some((k) => k.role !== "manager")) throw new Error("KEEP_EMAILS must only name office accounts. Nothing was changed.");
  if (!kept.some((k) => k.super_admin)) throw new Error("At least one kept account must be a super admin, or nobody could add staff afterwards. Nothing was changed.");
  const keepIds = kept.map((k) => k.id);

  const all = (await q(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`)).map((r) => r.tablename);
  const clear = all.filter((t) => !keepTables.has(t));
  const host = (process.env.DATABASE_URL || "").replace(/^.*@/, "").replace(/\?.*$/, "");

  console.log(`Database: ${host}`);
  console.log(`Keeping ${kept.length} office account(s): ${kept.map((k) => `${k.email}${k.super_admin ? " (super admin)" : ""}`).join(", ")}`);
  console.log("\nAccounts that will be deleted:");
  for (const r of await q(`SELECT role::text AS role, count(*)::int AS n FROM users WHERE id <> ALL($1::int[]) GROUP BY 1 ORDER BY 1`, keepIds)) console.log(`  ${String(r.n).padStart(6)}  ${r.role}`);
  console.log("\nRecords that will be deleted:");
  for (const t of clear) { const c = await n(`SELECT count(*) AS n FROM "${t}"`); if (c) console.log(`  ${String(c).padStart(6)}  ${t}`); }
  const fileKeepSql = `SELECT file_id FROM build_photos UNION SELECT photo_id FROM house_plans WHERE photo_id IS NOT NULL UNION SELECT photo_id FROM build_projects WHERE photo_id IS NOT NULL UNION SELECT logo_file_id FROM brand_profiles WHERE logo_file_id IS NOT NULL AND (owner_id IS NULL OR owner_id = ANY($1::int[]))`;
  const filesGo = wipeBuild
    ? await n(`SELECT count(*) AS n FROM files WHERE id NOT IN (SELECT logo_file_id FROM brand_profiles WHERE logo_file_id IS NOT NULL AND (owner_id IS NULL OR owner_id = ANY($1::int[])))`, keepIds)
    : await n(`SELECT count(*) AS n FROM files WHERE id NOT IN (${fileKeepSql})`, keepIds);
  console.log(`  ${String(filesGo).padStart(6)}  files (photos and documents)`);
  if (!wipeBuild) console.log(`\nKept: ${await n(`SELECT count(*) AS n FROM house_plans`)} house plan(s), ${await n(`SELECT count(*) AS n FROM build_projects`)} finished project(s) and their photos.`);

  if (!really) {
    console.log("\nThis was only a look: nothing was deleted. To delete, run again with CONFIRM=DELETE-TEST-DATA");
  } else {
    await db.$transaction(async (tx) => {
      const places = await tx.$queryRawUnsafe(`SELECT (SELECT count(*) FROM locations)::int AS l, (SELECT count(*) FROM location_aliases)::int AS a`);
      const before = wipeBuild ? null : await tx.$queryRawUnsafe(`SELECT (SELECT count(*) FROM house_plans)::int AS a, (SELECT count(*) FROM build_projects)::int AS b, (SELECT count(*) FROM build_photos)::int AS c`);
      await tx.$executeRawUnsafe(`TRUNCATE ${clear.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
      await tx.$executeRawUnsafe(`DELETE FROM brand_profiles WHERE owner_id IS NOT NULL AND owner_id <> ALL($1::int[])`, keepIds);
      if (wipeBuild) await tx.$executeRawUnsafe(`DELETE FROM files WHERE id NOT IN (SELECT logo_file_id FROM brand_profiles WHERE logo_file_id IS NOT NULL)`);
      else await tx.$executeRawUnsafe(`DELETE FROM files WHERE id NOT IN (${fileKeepSql})`, keepIds);
      await tx.$executeRawUnsafe(`UPDATE files SET owner_id = NULL WHERE owner_id IS NOT NULL AND owner_id <> ALL($1::int[])`, keepIds);
      await tx.$executeRawUnsafe(`DELETE FROM users WHERE id <> ALL($1::int[])`, keepIds);
      // Safety: the kept tables must be untouched, or everything is put back.
      const left = await tx.$queryRawUnsafe(`SELECT (SELECT count(*) FROM users)::int AS u, (SELECT count(*) FROM locations)::int AS l, (SELECT count(*) FROM location_aliases)::int AS a`);
      if (left[0].u !== keepIds.length) throw new Error("Kept accounts changed unexpectedly; everything was put back.");
      if (left[0].l !== places[0].l || left[0].a !== places[0].a) throw new Error("Locations changed unexpectedly; everything was put back.");
      if (before) {
        const after = await tx.$queryRawUnsafe(`SELECT (SELECT count(*) FROM house_plans)::int AS a, (SELECT count(*) FROM build_projects)::int AS b, (SELECT count(*) FROM build_photos)::int AS c`);
        if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Build content changed unexpectedly; everything was put back.");
      }
      await tx.$executeRawUnsafe(`INSERT INTO audit_logs (action, entity, detail) VALUES ('system.handover_reset', 'system', $1)`, `Test data cleared before handover. Kept: ${kept.map((k) => k.email).join(", ")}`);
    }, { timeout: 120000 });
    console.log(`\nDone. ${await n(`SELECT count(*) AS n FROM users`)} account(s) remain, ${await n(`SELECT count(*) AS n FROM locations`)} locations kept.`);
  }
} catch (e) {
  console.error(`\nStopped: ${e.message}`);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
