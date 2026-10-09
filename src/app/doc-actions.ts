"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { id, text } from "@/lib/validate";

export async function uploadDocument(fd: FormData) {
  const u = await requireUser();
  const leaseId = id(fd, "leaseId") || null;
  const propertyId = id(fd, "propertyId") || null;
  let otherParty: number | null = null;
  let link = "";
  if (leaseId) {
    const l = await db.lease.findUnique({ where: { id: leaseId } });
    if (!l || !(u.role === "manager" || l.tenantId === u.id || l.landlordId === u.id)) return fail("Not allowed");
    otherParty = u.id === l.tenantId ? l.landlordId : l.tenantId;
    link = u.id === l.tenantId ? `/landlord/tenants/${l.id}` : "/tenant/lease";
  } else if (propertyId) {
    const p = await db.property.findUnique({ where: { id: propertyId } });
    if (!p || !(u.role === "manager" || p.landlordId === u.id)) return fail("Not allowed");
  } else return fail("Choose a lease or property");
  const title = (await text(fd, "title", "a title", { optional: true, max: 120 })) || "Document";
  const fileId = await saveUpload(fd.get("file"), u.id, false);
  if (!fileId) return fail("Choose a file");
  const d = await db.document.create({ data: { fileId, title, leaseId, propertyId, uploadedById: u.id } });
  if (otherParty) await notify(otherParty, `${u.name} shared a document: ${title}`, link);
  await audit(u.id, "document.uploaded", "document", d.id, title);
  revalidatePath("/", "layout");
}

export async function deleteDocument(fd: FormData) {
  const u = await requireUser();
  const d = await db.document.findFirst({ where: u.role === "manager" ? { id: id(fd) } : { id: id(fd), uploadedById: u.id } });
  if (!d) return fail("Document not found");
  await db.$transaction([
    db.document.delete({ where: { id: d.id } }),
    // The stored file goes too, unless something else still points at it.
    db.file.deleteMany({ where: { id: d.fileId, isPublic: false } }),
  ]);
  await audit(u.id, "document.deleted", "document", d.id, d.title);
  revalidatePath("/", "layout");
}
