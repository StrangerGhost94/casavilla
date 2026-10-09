import "server-only";
import { db } from "@/db";
import { ensureCharges } from "@/lib/billing";

/** The tenant's current lease — or, after moving out, the last one while anything is still owed either way. */
export async function activeLease(tenantId: number, orUnsettled = false) {
  const l = await db.lease.findFirst({
    where: orUnsettled
      ? { tenantId, OR: [{ status: "active" }, { status: "ended", settlement: { not: 0 } }] }
      : { tenantId, status: "active" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { unit: { include: { property: true } }, landlord: { select: { name: true, phone: true } } },
  });
  if (!l) return null;
  await ensureCharges(l);
  return {
    l, unit: l.unit.label, bedrooms: l.unit.bedrooms, property: l.unit.property.name, propertyId: l.unit.property.id,
    location: l.unit.property.location, landlord: l.landlord.name, landlordPhone: l.landlord.phone,
  };
}
