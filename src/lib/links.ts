import "server-only";
import { db, type User } from "@/db";
import { normalizeLandlordCode } from "./landlord-code";
import { notify, notifyManagers } from "./notify";
import { audit } from "./audit";

export type LinkResult = { ok: true; found: boolean; landlordName?: string } | { ok: false; error: string };

/**
 * An existing tenant joins with their landlord's CasaVilla code (the landlord's phone stays private). CasaVilla
 * confirms the tenancy and sets up the lease.
 */
export async function requestLink(tenant: Pick<User, "id" | "name" | "phone">, rawCode: string, unitNote: string | null): Promise<LinkResult> {
  const code = normalizeLandlordCode(rawCode);
  if (code.length < 6) return { ok: false, error: "Enter your landlord's CasaVilla code, e.g. CV-7K2M9P. The CasaVilla office can give it to you." };
  if (await db.lease.findFirst({ where: { tenantId: tenant.id, status: "active" }, select: { id: true } })) {
    return { ok: false, error: "You already have an active lease on CasaVilla" };
  }
  const today = await db.tenantLink.count({ where: { tenantId: tenant.id, createdAt: { gt: new Date(Date.now() - 86400000) } } });
  if (today >= 5) return { ok: false, error: "Too many requests today — try again tomorrow or contact CasaVilla" };

  const landlord = await db.user.findFirst({ where: { landlordCode: code, role: "landlord", status: { not: "suspended" } } });
  if (!landlord) return { ok: false, error: "We couldn't find that code. Check it with the CasaVilla office." };
  const note = unitNote?.trim().slice(0, 120) || null;

  const link = await db.$transaction(async (tx) => {
    // Only one open request at a time: a new one replaces the old.
    await tx.tenantLink.updateMany({ where: { tenantId: tenant.id, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } });
    return tx.tenantLink.create({ data: { tenantId: tenant.id, landlordId: landlord.id, landlordPhone: landlord.phone, unitNote: note } });
  });
  await audit(tenant.id, "link.requested", "tenant_link", link.id, `${code} → ${landlord.name}`);
  await notifyManagers(`${tenant.name} says they rent from ${landlord.name}${note ? ` (${note})` : ""}. Confirm and set up their lease so they can pay rent in the app.`, "/manager/applications");
  await notify(tenant.id, "Request sent to CasaVilla. You'll be notified as soon as your lease is confirmed.", "/tenant");
  return { ok: true, found: true };
}
