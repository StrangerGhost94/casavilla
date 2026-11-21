import "server-only";
import { db, type User } from "@/db";

/**
 * Who may work on a property: the CasaVilla office (all of them) and its owner (a landlord, or an agent for their
 * short stays). Actions still decide separately who may change things; landlords only look.
 */
export async function workableProperty(u: User, propertyId: number) {
  const p = await db.property.findUnique({ where: { id: propertyId } });
  return p && (u.role === "manager" || p.landlordId === u.id) ? p : null;
}

export async function workableUnit(u: User, unitId: number) {
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  return unit && (u.role === "manager" || unit.property.landlordId === u.id) ? unit : null;
}

/** Property filter for lists: everything for the office, their own for an owner. */
export async function propertyScope(u: User): Promise<{ landlordId?: number }> {
  return u.role === "manager" ? {} : { landlordId: u.id };
}

/** Can this person open a private file (inspection photos, meter photos, expense receipts, documents, repair photos)? */
export async function canSeeFile(u: User, fileId: number, ownerId: number | null) {
  if (u.role === "manager" || ownerId === u.id) return true;
  const mine = { landlordId: u.id };
  const doc = await db.document.findFirst({
    where: { fileId, OR: [{ lease: { OR: [{ tenantId: u.id }, { landlordId: u.id }] } }, { property: mine }] }, select: { id: true },
  });
  if (doc) return true;
  const job = await db.job.findFirst({ where: { photoId: fileId, OR: [{ requesterId: u.id }, { landlordId: u.id }, { providerId: u.id }] }, select: { id: true } });
  if (job) return true;
  const item = await db.inspectionItem.findFirst({
    where: { photoIds: { has: fileId }, inspection: { OR: [{ lease: { tenantId: u.id } }, { unit: { property: mine } }] } }, select: { id: true },
  });
  if (item) return true;
  const reading = await db.meterReading.findFirst({
    where: { photoFileId: fileId, meter: { OR: [{ property: mine }, { unit: { leases: { some: { tenantId: u.id, status: "active" } } } }] } }, select: { id: true },
  });
  if (reading) return true;
  const expense = await db.expense.findFirst({ where: { receiptFileId: fileId, landlordId: u.id }, select: { id: true } });
  if (expense) return true;
  // URA's copy of an EFRIS receipt: the tenant who paid and their landlord.
  const efris = await db.efrisReceipt.findFirst({ where: { fileId, payment: { lease: { OR: [{ tenantId: u.id }, { landlordId: u.id }] } } }, select: { id: true } });
  if (efris) return true;
  // Progress photos from a building site: its client.
  const site = await db.buildUpdatePhoto.findFirst({ where: { fileId, update: { site: { clientId: u.id } } }, select: { id: true } });
  return !!site;
}
