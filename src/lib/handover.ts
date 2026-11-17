import "server-only";
import { db } from "@/db";

/** Tables that are never cleared: accounts and files are trimmed by hand below; places and CasaVilla's own build content stay. */
const KEEP = ["users", "files", "file_variants", "locations", "location_aliases", "location_datasets", "brand_profiles", "_prisma_migrations", "house_plans", "build_projects", "build_photos"];
const FILES_KEPT = `SELECT file_id FROM build_photos UNION SELECT photo_id FROM house_plans WHERE photo_id IS NOT NULL UNION SELECT photo_id FROM build_projects WHERE photo_id IS NOT NULL UNION SELECT logo_file_id FROM brand_profiles WHERE logo_file_id IS NOT NULL AND (owner_id IS NULL OR owner_id = $1)`;

/** What clearing the test data would remove, for showing before anyone confirms. */
export async function handoverPreview(keepId: number) {
  const [people, rows] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { id: { not: keepId } }, _count: { _all: true } }),
    db.$queryRawUnsafe<{ properties: number; leases: number; payments: number; jobs: number }[]>(
      `SELECT (SELECT count(*) FROM properties)::int AS properties, (SELECT count(*) FROM leases)::int AS leases, (SELECT count(*) FROM payments)::int AS payments, (SELECT count(*) FROM jobs)::int AS jobs`),
  ]);
  return { people: people.map((p) => ({ role: p.role as string, n: p._count._all })), ...rows[0] };
}

/**
 * Before handover: deletes every account except `keepId` and everything that belongs to them (properties, leases,
 * payments, receipts, repairs, bookings, messages, history). Places and CasaVilla's house plans and finished
 * projects stay. All or nothing: if a kept table changes, everything is put back.
 */
export async function clearTestData(keepId: number) {
  await db.$transaction(async (tx) => {
    const count = () => tx.$queryRawUnsafe<Record<string, number>[]>(
      `SELECT (SELECT count(*) FROM locations)::int AS l, (SELECT count(*) FROM location_aliases)::int AS a, (SELECT count(*) FROM house_plans)::int AS p, (SELECT count(*) FROM build_projects)::int AS b, (SELECT count(*) FROM build_photos)::int AS f`);
    const before = await count();
    const tables = (await tx.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`)).map((r) => r.tablename).filter((t) => !KEEP.includes(t));
    await tx.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
    await tx.$executeRawUnsafe(`DELETE FROM brand_profiles WHERE owner_id IS NOT NULL AND owner_id <> $1`, keepId);
    await tx.$executeRawUnsafe(`DELETE FROM files WHERE id NOT IN (${FILES_KEPT})`, keepId);
    await tx.$executeRawUnsafe(`UPDATE files SET owner_id = NULL WHERE owner_id IS NOT NULL AND owner_id <> $1`, keepId);
    await tx.$executeRawUnsafe(`DELETE FROM users WHERE id <> $1`, keepId);
    const users = await tx.$queryRawUnsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM users`);
    if (users[0].n !== 1 || JSON.stringify(before) !== JSON.stringify(await count())) throw new Error("Kept records changed unexpectedly");
    await tx.$executeRawUnsafe(`INSERT INTO audit_logs (actor_id, action, entity, detail) VALUES ($1, 'system.handover_reset', 'system', 'Test data cleared before handover')`, keepId);
  }, { timeout: 120000, maxWait: 20000 });
}
