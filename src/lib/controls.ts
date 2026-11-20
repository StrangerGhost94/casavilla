import "server-only";
import { db } from "@/db";
import { kampalaToday } from "@/lib/format";

/** Cash and bank receipts by Kampala day (paid_at is stored in UTC). */
const DAY = `(p.paid_at + interval '3 hours')::date`;

export type CashDay = { day: string; count: number; total: number; closed: boolean };

/** Days with cash or bank receipts in the last `days` days, newest first, and whether each was closed. */
export async function cashDays(days = 45): Promise<CashDay[]> {
  const rows = await db.$queryRawUnsafe<{ day: Date; count: number; total: bigint; closed: boolean }[]>(`
    SELECT ${DAY} AS day, count(*)::int AS count, sum(p.amount) AS total, (c.day IS NOT NULL) AS closed
    FROM payments p LEFT JOIN cash_closes c ON c.day = ${DAY}
    WHERE p.status = 'success' AND p.method IN ('cash', 'bank') AND p.paid_at > now() - interval '${days} days'
    GROUP BY ${DAY}, c.day ORDER BY 1 DESC`);
  return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: r.count, total: Number(r.total), closed: r.closed }));
}

/** Days before today whose cash hasn't been signed off (for the dashboard). */
export async function unclosedCashDays() {
  const today = kampalaToday();
  return (await cashDays()).filter((d) => !d.closed && d.day < today).length;
}

/** The cash and bank payments of one Kampala day. */
export function cashFor(day: string) {
  const start = new Date(`${day}T00:00:00+03:00`);
  return db.payment.findMany({
    where: { status: "success", method: { in: ["cash", "bank"] }, paidAt: { gte: start, lt: new Date(start.getTime() + 86400000) } },
    orderBy: { paidAt: "asc" },
    include: { tenant: { select: { name: true } }, recordedBy: { select: { id: true, name: true } } },
  });
}

/** This month's access review, if a super admin has done it. */
export async function accessReviewThisMonth() {
  const month = kampalaToday().slice(0, 7);
  return db.auditLog.findFirst({ where: { action: "access.reviewed", createdAt: { gte: new Date(`${month}-01T00:00:00+03:00`) } }, orderBy: { seq: "desc" } });
}
