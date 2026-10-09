import "server-only";
import { db, type User } from "@/db";

/**
 * Who may work on a property: CasaVilla managers (all), the landlord who owns it, and caretakers assigned to it.
 * Caretakers never see statements, other properties, or anything outside their assignment.
 */
export async function caretakerPropertyIds(userId: number) {
  return (await db.caretakerAssignment.findMany({ where: { caretakerId: userId }, select: { propertyId: true } })).map((a) => a.propertyId);
}

export async function assignment(u: User, propertyId: number) {
  if (u.role !== "caretaker") return null;
  return db.caretakerAssignment.findUnique({ where: { caretakerId_propertyId: { caretakerId: u.id, propertyId } } });
}

/** The property, if this person may work on it. */
export async function workableProperty(u: User, propertyId: number) {
  const p = await db.property.findUnique({ where: { id: propertyId } });
  if (!p) return null;
  if (u.role === "manager" || (u.role === "landlord" && p.landlordId === u.id)) return p;
  if (u.role === "caretaker" && (await assignment(u, p.id))) return p;
  return null;
}

export async function workableUnit(u: User, unitId: number) {
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  if (!unit) return null;
  return (await workableProperty(u, unit.propertyId)) ? unit : null;
}

/** Property filter for lists: everything for managers, own for landlords, assigned for caretakers. */
export async function propertyScope(u: User): Promise<{ id?: { in: number[] }; landlordId?: number }> {
  if (u.role === "manager") return {};
  if (u.role === "caretaker") return { id: { in: await caretakerPropertyIds(u.id) } };
  return { landlordId: u.id };
}

/** Can this person open a private file (inspection photos, meter photos, expense receipts, documents, repair photos)? */
export async function canSeeFile(u: User, fileId: number, ownerId: number | null) {
  if (u.role === "manager" || ownerId === u.id) return true;
  const props = u.role === "caretaker" ? await caretakerPropertyIds(u.id) : [];
  const onProperty = (propertyIdField: "property" | "unit") =>
    propertyIdField === "property"
      ? { OR: [{ landlordId: u.id }, ...(props.length ? [{ id: { in: props } }] : [])] }
      : { property: { OR: [{ landlordId: u.id }, ...(props.length ? [{ id: { in: props } }] : [])] } };

  const doc = await db.document.findFirst({
    where: { fileId, OR: [{ lease: { OR: [{ tenantId: u.id }, { landlordId: u.id }] } }, { property: onProperty("property") }] }, select: { id: true },
  });
  if (doc) return true;
  const job = await db.job.findFirst({
    where: { photoId: fileId, OR: [{ requesterId: u.id }, { landlordId: u.id }, { providerId: u.id }, ...(props.length ? [{ propertyId: { in: props } }] : [])] }, select: { id: true },
  });
  if (job) return true;
  const item = await db.inspectionItem.findFirst({
    where: { photoIds: { has: fileId }, inspection: { OR: [{ lease: { tenantId: u.id } }, { unit: onProperty("unit") }] } }, select: { id: true },
  });
  if (item) return true;
  const reading = await db.meterReading.findFirst({
    where: { photoFileId: fileId, meter: { OR: [{ property: onProperty("property") }, { unit: { leases: { some: { tenantId: u.id, status: "active" } } } }] } }, select: { id: true },
  });
  if (reading) return true;
  const expense = await db.expense.findFirst({ where: { receiptFileId: fileId, OR: [{ landlordId: u.id }, ...(props.length ? [{ propertyId: { in: props } }] : [])] }, select: { id: true } });
  return !!expense;
}
