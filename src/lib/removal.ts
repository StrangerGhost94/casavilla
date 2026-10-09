import "server-only";
import { db } from "@/db";

/**
 * What removing a property (or unit) would do:
 *  - blocked: someone lives there now (end the tenancy first) or a short stay is booked ahead;
 *  - archive: it has history (past tenancies, payments, bookings, repairs) that receipts and statements rely on;
 *  - delete: nothing depends on it, so it can go for good.
 */
export async function propertyRemoval(propertyId: number) {
  const unitIds = (await db.unit.findMany({ where: { propertyId }, select: { id: true } })).map((u) => u.id);
  const [active, leases, upcoming, stays, jobs] = await Promise.all([
    db.lease.count({ where: { unitId: { in: unitIds }, status: "active" } }),
    db.lease.count({ where: { unitId: { in: unitIds } } }),
    db.booking.count({ where: { unitId: { in: unitIds }, status: { in: ["pending", "confirmed"] }, checkOut: { gt: new Date() } } }),
    db.booking.count({ where: { unitId: { in: unitIds }, status: { notIn: ["blocked", "expired"] } } }),
    db.job.count({ where: { OR: [{ propertyId }, { unitId: { in: unitIds } }] } }),
  ]);
  if (active) return { mode: "blocked" as const, reason: `${active} unit${active > 1 ? "s have" : " has"} a tenant now. End the tenanc${active > 1 ? "ies" : "y"} (Move-out & settle) first.` };
  if (upcoming) return { mode: "blocked" as const, reason: `There ${upcoming > 1 ? "are" : "is"} ${upcoming} upcoming short-stay booking${upcoming > 1 ? "s" : ""}. Cancel or finish ${upcoming > 1 ? "them" : "it"} first.` };
  if (leases || stays || jobs) {
    const what = [leases && `${leases} past tenanc${leases > 1 ? "ies" : "y"}`, stays && `${stays} short stay${stays > 1 ? "s" : ""}`, jobs && `${jobs} repair${jobs > 1 ? "s" : ""}`].filter(Boolean).join(", ");
    return { mode: "archive" as const, reason: `It has history (${what}), so it will be archived: hidden and taken off the listings, but receipts and statements stay correct. You can restore it later.` };
  }
  return { mode: "delete" as const, reason: "Nothing depends on it, so it will be deleted for good — units, photos, meters and documents included." };
}

export async function unitRemoval(unitId: number) {
  const [leases, stays, jobs] = await Promise.all([
    db.lease.count({ where: { unitId } }),
    db.booking.count({ where: { unitId, status: { notIn: ["blocked", "expired"] } } }),
    db.job.count({ where: { unitId } }),
  ]);
  return leases || stays || jobs ? { ok: false as const, reason: "This unit has tenancy, booking or repair history, so it can't be deleted. Untick “Listed publicly” to take it off the market." } : { ok: true as const };
}
