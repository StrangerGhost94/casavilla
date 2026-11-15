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

/** A new landlord picks up every tenant who was waiting for them by phone number. */
export async function attachWaitingTenants(landlord: Pick<User, "id" | "phone" | "role">) {
  if (landlord.role !== "landlord") return 0;
  const waiting = await db.tenantLink.findMany({ where: { landlordPhone: landlord.phone, landlordId: null, status: "pending" }, include: { tenant: { select: { name: true } } } });
  if (!waiting.length) return 0;
  await db.tenantLink.updateMany({ where: { id: { in: waiting.map((w) => w.id) } }, data: { landlordId: landlord.id } });
  await notifyManagers(`${waiting.length} tenant${waiting.length > 1 ? "s are" : " is"} waiting to connect with a new landlord (${waiting.map((w) => w.tenant.name).join(", ")}). Confirm their leases.`, "/manager/applications");
  for (const w of waiting) await notify(w.tenantId, "Your landlord just joined CasaVilla. CasaVilla will confirm your lease shortly.", "/tenant");
  return waiting.length;
}
