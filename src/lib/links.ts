import "server-only";
import { db, type User } from "@/db";
import { normalizePhone } from "./format";
import { notify, notifyManagers } from "./notify";
import { audit } from "./audit";

export type LinkResult = { ok: true; found: boolean; landlordName?: string } | { ok: false; error: string };

const firstName = (n: string) => n.split(" ")[0];

/**
 * An existing tenant names their landlord by phone number. If that landlord is on CasaVilla they're asked to
 * confirm and set up the lease; if not, the request waits (CasaVilla is told so it can invite them) and attaches
 * itself automatically when the landlord signs up with that number.
 */
export async function requestLink(tenant: Pick<User, "id" | "name" | "phone">, rawPhone: string, unitNote: string | null): Promise<LinkResult> {
  const phone = normalizePhone(rawPhone);
  if (!/^\+256\d{9}$/.test(phone)) return { ok: false, error: "Enter your landlord's Ugandan phone number, e.g. 0772 123 456" };
  if (phone === tenant.phone) return { ok: false, error: "That's your own number — enter your landlord's phone number" };
  if (await db.lease.findFirst({ where: { tenantId: tenant.id, status: "active" }, select: { id: true } })) {
    return { ok: false, error: "You already have an active lease on CasaVilla" };
  }
  const today = await db.tenantLink.count({ where: { tenantId: tenant.id, createdAt: { gt: new Date(Date.now() - 86400000) } } });
  if (today >= 5) return { ok: false, error: "Too many requests today — try again tomorrow or contact CasaVilla" };

  const landlord = await db.user.findFirst({ where: { phone, role: "landlord", status: { not: "suspended" } }, orderBy: { id: "asc" } });
  const note = unitNote?.trim().slice(0, 120) || null;

  const link = await db.$transaction(async (tx) => {
    // Only one open request at a time: a new one replaces the old.
    await tx.tenantLink.updateMany({ where: { tenantId: tenant.id, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } });
    return tx.tenantLink.create({ data: { tenantId: tenant.id, landlordId: landlord?.id ?? null, landlordPhone: phone, unitNote: note } });
  });
  await audit(tenant.id, "link.requested", "tenant_link", link.id, `${phone}${landlord ? ` → ${landlord.name}` : " (landlord not on CasaVilla yet)"}`);
  const what = note ? ` (${note})` : "";
  if (landlord) {
    await notify(landlord.id, `${tenant.name} says they rent from you${what}. Confirm and set up their lease so they can pay rent in the app.`, "/landlord/applications");
    await notify(tenant.id, `Request sent to your landlord ${firstName(landlord.name)}. You'll be notified as soon as they confirm your lease.`, "/tenant");
    return { ok: true, found: true, landlordName: firstName(landlord.name) };
  }
  await notifyManagers(`${tenant.name} rents from a landlord who isn't on CasaVilla yet (${phone.replace("+256", "0")})${what}. Invite them to join.`, "/manager/applications");
  await notify(tenant.id, `Your landlord (${phone.replace("+256", "0")}) isn't on CasaVilla yet. We'll invite them — you'll be connected automatically when they join.`, "/tenant");
  return { ok: true, found: false };
}

/** A new landlord picks up every tenant who was waiting for them by phone number. */
export async function attachWaitingTenants(landlord: Pick<User, "id" | "phone" | "role">) {
  if (landlord.role !== "landlord") return 0;
  const waiting = await db.tenantLink.findMany({ where: { landlordPhone: landlord.phone, landlordId: null, status: "pending" }, include: { tenant: { select: { name: true } } } });
  if (!waiting.length) return 0;
  await db.tenantLink.updateMany({ where: { id: { in: waiting.map((w) => w.id) } }, data: { landlordId: landlord.id } });
  await notify(landlord.id, `${waiting.length} tenant${waiting.length > 1 ? "s are" : " is"} already waiting to connect with you (${waiting.map((w) => w.tenant.name).join(", ")}). Confirm their leases to start collecting rent in the app.`, "/landlord/applications");
  for (const w of waiting) await notify(w.tenantId, "Your landlord just joined CasaVilla. They'll confirm your lease shortly.", "/tenant");
  return waiting.length;
}
