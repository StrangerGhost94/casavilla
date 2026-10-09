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

/** Tenant asks for an emailed copy of a receipt (queued until email is configured). */
export async function emailMyReceipt(fd: FormData) {
  const u = await requireUser();
  const { receiptData } = await import("@/lib/receipts");
  const { emailHtml, queueEmail, sendQueuedEmails } = await import("@/lib/mail");
  const r = await receiptData(id(fd), u);
  if (!r || r.tenant.id !== u.id) return fail("Receipt not found");
  const app = process.env.APP_URL || "https://casavilla-production.up.railway.app";
  await queueEmail({
    to: u.email, subject: `Your receipt ${r.p.receiptNo}`, attachKind: "receipt", attachId: r.p.id,
    html: emailHtml({ accent: r.brand.accentColor, title: `Receipt ${r.p.receiptNo}`, lines: [`Here is your receipt for ${r.property} · ${r.unit}.`], button: { label: "View online", href: `${app}/receipts/${r.p.id}` }, footer: r.brand.displayName }),
  });
  await sendQueuedEmails(3).catch(() => 0);
}

/** Landlord (own documents) or manager (CasaVilla default, or a landlord's): customise receipts & agreements. */
export async function saveBrand(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ownerId = u.role === "manager" ? (id(fd, "ownerId") || null) : u.id;
  const color = String(fd.get("accentColor") || "#124331");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return fail("Pick a valid colour");
  const logoFileId = await saveUpload(fd.get("logo"), u.id, true, true);
  if (logoFileId) {
    const f = await db.file.findUnique({ where: { id: logoFileId }, select: { mimeType: true } });
    if (!["image/png", "image/jpeg"].includes(f?.mimeType ?? "")) return fail("The logo must be a PNG or JPG image");
  }
  const data = {
    displayName: (await text(fd, "displayName", "the name on documents", { max: 120 })) as string,
    address: await text(fd, "address", "the address", { optional: true, max: 200 }),
    phone: await text(fd, "phone", "the phone", { optional: true, max: 80 }),
    email: await text(fd, "email", "the email", { optional: true, max: 120 }),
    tin: await text(fd, "tin", "the TIN", { optional: true, max: 30 }),
    footerNote: await text(fd, "footerNote", "the footer note", { optional: true, max: 300 }),
    signatory: await text(fd, "signatory", "the signatory", { optional: true, max: 100 }),
    signatoryTitle: await text(fd, "signatoryTitle", "the signatory title", { optional: true, max: 100 }),
    showCasaVilla: fd.get("showCasaVilla") === "on",
    accentColor: color,
    ...(logoFileId ? { logoFileId } : fd.get("removeLogo") === "on" ? { logoFileId: null } : {}),
  };
  const existing = await db.brandProfile.findFirst({ where: { ownerId } });
  if (existing) await db.brandProfile.update({ where: { id: existing.id }, data });
  else await db.brandProfile.create({ data: { ...data, ownerId } });
  await audit(u.id, "brand.saved", "brand", ownerId, data.displayName);
  revalidatePath("/", "layout");
}
