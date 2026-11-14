import "server-only";
import { db } from "@/db";
import { ensureCharges } from "@/lib/billing";
import { CONTACT, OFFICE } from "@/lib/social";

/** The tenant's current lease — or, after moving out, the last one while anything is still owed either way. */
export async function activeLease(tenantId: number, orUnsettled = false) {
  const l = await db.lease.findFirst({
    where: orUnsettled
      ? { tenantId, OR: [{ status: "active" }, { status: "ended", settlement: { not: 0 } }] }
      : { tenantId, status: "active" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { unit: { include: { property: true } } },
  });
  if (!l) return null;
  await ensureCharges(l);
  return {
    l, unit: l.unit.label, bedrooms: l.unit.bedrooms, property: l.unit.property.name, propertyId: l.unit.property.id,
    location: l.unit.property.location, // Owners stay private: the tenant's contact is the CasaVilla office.
    landlord: OFFICE.name, landlordPhone: CONTACT.phones[0].replace(/\s/g, ""),
  };
}
