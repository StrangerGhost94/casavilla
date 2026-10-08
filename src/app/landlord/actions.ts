"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type User } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { completePayment, ensureCharges } from "@/lib/billing";
import { dateOnly, ugx } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

/** Landlords can act on their own records; CasaVilla managers can act on any landlord's. */
async function actor() { return requireUser("landlord", "manager"); }
const owns = (u: User, landlordId: number) => u.role === "manager" || u.id === landlordId;

async function ownedProperty(u: User, id: number) {
  const p = await db.property.findUnique({ where: { id } });
  if (!p || !owns(u, p.landlordId)) throw new Error("Property not found");
  return p;
}

export async function saveProperty(fd: FormData) {
  const u = await actor();
  const id = Number(fd.get("id")) || null;
  const photoId = await saveUpload(fd.get("photo"), u.id, true, true);
  const data = {
    name: String(fd.get("name")).trim(), type: String(fd.get("type")), location: String(fd.get("location")).trim(),
    description: String(fd.get("description") || "").trim() || null,
  };
  if (id) {
    await ownedProperty(u, id);
    await db.property.update({ where: { id }, data: { ...data, ...(photoId ? { photoId } : {}) } });
    refresh();
    return;
  }
  const landlordId = u.role === "manager" ? Number(fd.get("landlordId")) : u.id;
  if (!landlordId) throw new Error("Choose a landlord");
  const p = await db.property.create({ data: { ...data, landlordId, photoId } });
  redirect(`/${u.role}/properties/${p.id}`);
}

export async function addUnit(fd: FormData) {
  const u = await actor();
  const p = await ownedProperty(u, Number(fd.get("propertyId")));
  const count = Math.min(50, Math.max(1, Number(fd.get("count")) || 1));
  const label = String(fd.get("label")).trim();
  await db.unit.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      propertyId: p.id, label: count > 1 ? `${label} ${i + 1}` : label,
      bedrooms: Number(fd.get("bedrooms")) || 1, rent: Number(fd.get("rent")), listed: fd.get("listed") === "on",
    })),
  });
  refresh();
}

export async function updateUnit(fd: FormData) {
  const u = await actor();
  const unit = await db.unit.findUnique({ where: { id: Number(fd.get("id")) }, include: { property: true } });
  if (!unit || !owns(u, unit.property.landlordId)) throw new Error("Unit not found");
  await db.unit.update({
    where: { id: unit.id },
    data: {
      label: String(fd.get("label")).trim(), rent: Number(fd.get("rent")), bedrooms: Number(fd.get("bedrooms")) || 1,
      listed: unit.status === "occupied" ? false : fd.get("listed") === "on",
    },
  });
  refresh();
}

export async function decideApplication(fd: FormData) {
  const u = await actor();
  const a = await db.application.findUnique({ where: { id: Number(fd.get("id")) }, include: { unit: { include: { property: true } } } });
  if (!a || !owns(u, a.unit.property.landlordId) || a.status !== "pending") throw new Error("Application not found");
  const where = `${a.unit.property.name} · ${a.unit.label}`;

  if (fd.get("decision") === "reject") {
    await db.application.update({ where: { id: a.id }, data: { status: "rejected" } });
    await notify(a.tenantId, `Your application for ${where} was not approved.`, "/tenant/applications");
    refresh();
    return;
  }
  if (a.unit.status !== "vacant") throw new Error("Unit is already occupied");
  const existing = await db.lease.findFirst({ where: { tenantId: a.tenantId, status: "active" } });
  if (existing) throw new Error("This tenant already has an active lease. End it first.");

  const startDate = String(fd.get("startDate"));
  const endDate = String(fd.get("endDate"));
  if (!startDate || !endDate || endDate <= startDate) throw new Error("Choose valid lease dates");

  const { lease, others } = await db.$transaction(async (tx) => {
    const lease = await tx.lease.create({
      data: {
        unitId: a.unit.id, tenantId: a.tenantId, landlordId: a.unit.property.landlordId,
        startDate: dateOnly(startDate), endDate: dateOnly(endDate),
        rent: Number(fd.get("rent")) || a.unit.rent, deposit: Number(fd.get("deposit")) || 0,
        dueDay: Math.min(28, Math.max(1, Number(fd.get("dueDay")) || 5)),
      },
    });
    await tx.unit.update({ where: { id: a.unit.id }, data: { status: "occupied", listed: false } });
    await tx.application.update({ where: { id: a.id }, data: { status: "approved" } });
    // Others who applied for the same unit are told it's taken.
    const others = await tx.application.findMany({ where: { unitId: a.unit.id, status: "pending", id: { not: a.id } } });
    await tx.application.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "rejected" } });
    return { lease, others };
  });
  for (const o of others) await notify(o.tenantId, `${where} has been let to another tenant.`, "/tenant/applications");
  await ensureCharges(lease);
  await notify(a.tenantId, `Approved! Your lease for ${where} starts ${startDate}. Rent ${ugx(lease.rent)}/month.`, "/tenant");
  redirect(`/${u.role}/tenants/${lease.id}`);
}

export async function recordCashPayment(fd: FormData) {
  const u = await actor();
  const c = await db.charge.findUnique({ where: { id: Number(fd.get("chargeId")) }, include: { lease: true } });
  if (!c || !owns(u, c.lease.landlordId)) throw new Error("Charge not found");
  const amount = Math.round(Number(fd.get("amount")));
  if (!amount || amount > c.amount - c.paid) throw new Error("Amount must not exceed the balance on this charge");
  const method = fd.get("method") === "bank" ? "bank" : "cash";
  const reference = String(fd.get("reference") || "").trim() || `${method.toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const p = await db.payment.create({
    data: { chargeId: c.id, leaseId: c.leaseId, tenantId: c.lease.tenantId, amount, method, reference, status: "pending", recordedById: u.id },
  });
  await completePayment(p.id);
  refresh();
}

export async function endLease(fd: FormData) {
  const u = await actor();
  const l = await db.lease.findUnique({ where: { id: Number(fd.get("id")) } });
  if (!l || !owns(u, l.landlordId)) throw new Error("Lease not found");
  await db.lease.update({ where: { id: l.id }, data: { status: "ended" } });
  await db.unit.update({ where: { id: l.unitId }, data: { status: "vacant", listed: fd.get("relist") === "on" } });
  await notify(l.tenantId, "Your lease has been ended by the landlord. Contact CasaVilla with any questions.", "/tenant");
  refresh();
}

export async function landlordJob(fd: FormData) {
  const u = await requireUser("landlord");
  const p = await ownedProperty(u, Number(fd.get("propertyId")));
  const photoId = await saveUpload(fd.get("photo"), u.id, false, true);
  const job = await db.job.create({
    data: {
      requesterId: u.id, landlordId: u.id, propertyId: p.id, unitId: Number(fd.get("unitId")) || null,
      category: String(fd.get("category")), title: String(fd.get("title")).trim(), description: String(fd.get("description")).trim(),
      priority: String(fd.get("priority") || "normal"), photoId,
    },
  });
  redirect(`/landlord/maintenance/${job.id}`);
}
