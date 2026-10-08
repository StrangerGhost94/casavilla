import "server-only";
import { db } from "@/db";
import { ensureCharges } from "@/lib/billing";

export async function activeLease(tenantId: number) {
  const l = await db.lease.findFirst({
    where: { tenantId, status: "active" },
    include: { unit: { include: { property: true } }, landlord: { select: { name: true, phone: true } } },
  });
  if (!l) return null;
  await ensureCharges(l);
  return {
    l, unit: l.unit.label, bedrooms: l.unit.bedrooms, property: l.unit.property.name, propertyId: l.unit.property.id,
    location: l.unit.property.location, landlord: l.landlord.name, landlordPhone: l.landlord.phone,
  };
}
