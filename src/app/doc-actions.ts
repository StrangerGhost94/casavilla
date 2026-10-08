"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { fail } from "@/lib/flash";

export async function uploadDocument(fd: FormData) {
  const u = await requireUser();
  const leaseId = Number(fd.get("leaseId")) || null;
  const propertyId = Number(fd.get("propertyId")) || null;
  let otherParty: number | null = null;
  if (leaseId) {
    const l = await db.lease.findUnique({ where: { id: leaseId } });
    if (!l || !(u.role === "manager" || l.tenantId === u.id || l.landlordId === u.id)) return fail("Not allowed");
    otherParty = u.id === l.tenantId ? l.landlordId : l.tenantId;
  } else if (propertyId) {
    const p = await db.property.findUnique({ where: { id: propertyId } });
    if (!p || !(u.role === "manager" || p.landlordId === u.id)) return fail("Not allowed");
  } else return fail("Choose a lease or property");
  const fileId = await saveUpload(fd.get("file"), u.id, false);
  if (!fileId) return fail("Choose a file");
  const title = String(fd.get("title") || "").trim() || "Document";
  await db.document.create({ data: { fileId, title, leaseId, propertyId, uploadedById: u.id } });
  if (otherParty) await notify(otherParty, `${u.name} shared a document: ${title}`);
  revalidatePath("/", "layout");
}

export async function deleteDocument(fd: FormData) {
  const u = await requireUser();
  const id = Number(fd.get("id"));
  await db.document.deleteMany({ where: u.role === "manager" ? { id } : { id, uploadedById: u.id } });
  revalidatePath("/", "layout");
}
