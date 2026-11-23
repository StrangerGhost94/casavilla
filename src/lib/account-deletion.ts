import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { db, type User } from "@/db";
import { systemScope } from "@/db/track";
import { ugx } from "@/lib/format";

/**
 * Deleting an account (Google Play requires it in the app and on the web).
 *
 * The person's details are erased: name, email, phone, password, documents, saved searches, notifications and
 * open requests. Money and legal records stay, because the law requires them (URA, the Landlord and Tenant Act):
 * payments, receipts, leases, bookings and the activity history. They are no longer linked to a name, email or phone.
 */
export const KEPT = ["Rent payments, receipts and leases", "Short-stay bookings and their receipts", "The office's activity history"] as const;

/** Why an account can't be deleted straight away. Empty = it can. `byOffice` skips "ask the office" reasons. */
export async function deletionBlockers(u: Pick<User, "id" | "role">, byOffice = false): Promise<string[]> {
  const out: string[] = [];
  if (u.role === "manager" && !byOffice) out.push("Office accounts are closed by a super admin, from People & approvals.");
  const [lease, owed, props, listings, jobs, stays, sites] = await Promise.all([
    db.lease.count({ where: { tenantId: u.id, status: "active" } }),
    db.charge.findMany({ where: { lease: { tenantId: u.id }, status: { not: "paid" } }, select: { amount: true, paid: true } }),
    db.property.count({ where: { landlordId: u.id, archivedAt: null } }),
    db.saleListing.count({ where: { ownerId: u.id, status: { in: ["pending", "active", "under_offer"] } } }),
    db.job.count({ where: { providerId: u.id, status: { in: ["assigned", "quoted", "accepted", "in_progress"] } } }),
    db.booking.count({ where: { guestId: u.id, status: "confirmed", checkOut: { gt: new Date() } } }),
    db.buildSite.count({ where: { clientId: u.id, status: { in: ["active", "on_hold"] } } }),
  ]);
  const balance = owed.reduce((n, c) => n + c.amount - c.paid, 0);
  if (lease) out.push("You have an active lease. Moving out is arranged with the CasaVilla office first.");
  if (balance > 0) out.push(`You still owe ${ugx(balance)} on your rent account.`);
  if (props) out.push(byOffice ? `They still have ${props} propert${props === 1 ? "y" : "ies"}. Archive or remove them first.` : "Your properties are managed by CasaVilla, so the office closes the account with you.");
  if (listings) out.push(byOffice ? "They have live listings for sale. Withdraw them first." : "You have listings for sale. Withdraw them first.");
  if (jobs) out.push(byOffice ? "They have repair jobs in progress. Reassign them first." : "You have repair jobs in progress. Finish them or hand them back to CasaVilla first.");
  if (stays) out.push("There is an upcoming short stay booked. It needs to finish or be cancelled first.");
  if (sites) out.push("There is a building project in progress with CasaVilla.");
  return out;
}

/**
 * Erases the person's details and closes the account. Background-scoped so the audit trail doesn't copy the
 * erased details into its permanent record; only "account deleted" is written.
 */
export async function eraseAccount(userId: number, actorId: number | null, by: "self" | "office") {
  await systemScope.run(true, async () => {
    const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const docs = [u.idFileId, u.agreementFileId].filter((x): x is number => !!x);
    await db.$transaction([
      db.user.update({ where: { id: u.id }, data: {
        name: "Deleted user", email: `deleted-${u.id}@deleted.casavillaproperties.com`, phone: "+256000000000",
        businessName: null, bio: null, area: null, locationId: null, landlordCode: null, idFileId: null, agreementFileId: null,
        passwordHash: await bcrypt.hash(randomBytes(24).toString("hex"), 10), status: "suspended", superAdmin: false,
        emailReceipts: false, messageOptIn: false, phoneVerifiedAt: null, lastLoginAt: null, mustChangePassword: false,
      } }),
      db.pushSubscription.deleteMany({ where: { userId: u.id } }),
      db.notification.deleteMany({ where: { userId: u.id } }),
      db.savedListing.deleteMany({ where: { userId: u.id } }),
      db.searchAlert.deleteMany({ where: { userId: u.id } }),
      db.brandProfile.deleteMany({ where: { ownerId: u.id } }),
      db.phoneCode.deleteMany({ where: { phone: { in: [u.phone, u.email.toLowerCase()] } } }),
      db.messageOutbox.deleteMany({ where: { userId: u.id, status: { not: "sent" } } }),
      db.emailOutbox.deleteMany({ where: { toEmail: u.email } }),
      db.saleEnquiry.deleteMany({ where: { userId: u.id } }),
      db.listingReport.deleteMany({ where: { userId: u.id } }),
      db.application.updateMany({ where: { tenantId: u.id, status: "pending" }, data: { status: "withdrawn" } }),
      db.tenantLink.updateMany({ where: { tenantId: u.id, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } }),
      db.viewing.updateMany({ where: { requesterId: u.id, status: { in: ["requested", "proposed", "confirmed"] } }, data: { status: "cancelled" } }),
      db.service.updateMany({ where: { providerId: u.id }, data: { active: false } }),
      db.product.updateMany({ where: { providerId: u.id }, data: { active: false } }),
      db.saleListing.updateMany({ where: { ownerId: u.id, status: { in: ["pending", "rejected", "expired"] } }, data: { status: "withdrawn" } }),
      ...(docs.length ? [db.file.deleteMany({ where: { id: { in: docs } } })] : []),
      db.auditLog.create({ data: { actorId, action: "account.deleted", entity: "user", entityId: u.id, detail: by === "self" ? "Deleted by the account holder" : "Deleted by the CasaVilla office on request" } }),
    ]);
  });
}
