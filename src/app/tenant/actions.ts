"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { initiateCharge, provider } from "@/lib/momo";
import { completePayment, failPayment } from "@/lib/billing";
import { dateOnly, networkFor, normalizePhone, ugx } from "@/lib/format";
import { fail } from "@/lib/flash";

export async function applyForUnit(fd: FormData) {
  const u = await requireUser("tenant");
  const unitId = Number(fd.get("unitId"));
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { property: true } });
  if (!unit || unit.status !== "vacant") return fail("This unit is no longer available");
  const dupe = await db.application.findFirst({ where: { unitId, tenantId: u.id, status: { in: ["pending", "approved"] } } });
  if (!dupe) {
    const moveIn = String(fd.get("moveIn") || "");
    await db.application.create({
      data: { unitId, tenantId: u.id, message: String(fd.get("message") || "") || null, moveIn: moveIn ? dateOnly(moveIn) : null },
    });
    await notify(unit.property.landlordId, `${u.name} applied for ${unit.property.name} · ${unit.label}`, "/landlord/applications");
  }
  redirect(`/listings/${unitId}?sent=1`);
}

export async function withdrawApplication(fd: FormData) {
  const u = await requireUser("tenant");
  await db.application.updateMany({ where: { id: Number(fd.get("id")), tenantId: u.id, status: "pending" }, data: { status: "withdrawn" } });
  revalidatePath("/tenant/applications");
}

export async function startPayment(_: { error?: string } | undefined, fd: FormData): Promise<{ error?: string } | undefined> {
  const u = await requireUser("tenant");
  const chargeId = Number(fd.get("chargeId"));
  const c = await db.charge.findFirst({ where: { id: chargeId, lease: { tenantId: u.id } } });
  if (!c) return { error: "Charge not found" };
  const balance = c.amount - c.paid;
  const amount = Math.round(Number(fd.get("amount")));
  if (!amount || amount < 500) return { error: "Enter an amount of at least UGX 500" };
  if (amount > balance) return { error: `You only owe ${ugx(balance)} on this charge` };
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter a valid Ugandan phone number" };
  const network = (String(fd.get("network")) || networkFor(phone)) as "mtn" | "airtel";
  if (!["mtn", "airtel"].includes(network)) return { error: "Choose MTN or Airtel" };

  const reference = `CV${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
  await db.payment.create({ data: { chargeId, leaseId: c.leaseId, tenantId: u.id, amount, method: network, phone, reference, status: "pending" } });
  const res = await initiateCharge({ reference, amount, phone, network, email: u.email, name: u.name });
  if (!res.ok) {
    await db.payment.update({ where: { reference }, data: { status: "failed" } });
    return { error: res.error };
  }
  redirect(res.redirect || `/pay/${reference}`);
}

/** Sandbox only: lets you approve or decline a test payment without real money. */
export async function sandboxResolve(fd: FormData) {
  const u = await requireUser();
  if (provider !== "sandbox") return fail("Not available in live mode");
  const ref = String(fd.get("ref"));
  const p = await db.payment.findUnique({ where: { reference: ref } });
  if (!p || (p.tenantId !== u.id && u.role !== "manager")) return fail("Not found");
  if (fd.get("outcome") === "approve") await completePayment(p.id);
  else await failPayment(p.id);
  redirect(`/pay/${ref}`);
}

export async function createRequest(fd: FormData) {
  const u = await requireUser("tenant");
  const lease = await db.lease.findFirst({ where: { tenantId: u.id, status: "active" }, include: { unit: true } });
  if (!lease) return fail("You need an active lease to report a repair");
  const photoId = await saveUpload(fd.get("photo"), u.id, false, true);
  const job = await db.job.create({
    data: {
      requesterId: u.id, landlordId: lease.landlordId, propertyId: lease.unit.propertyId, unitId: lease.unitId,
      category: String(fd.get("category")), title: String(fd.get("title")).trim(), description: String(fd.get("description")).trim(),
      priority: String(fd.get("priority") || "normal"), photoId,
    },
  });
  await notify(lease.landlordId, `New repair request from ${u.name}: ${job.title}`, `/landlord/maintenance/${job.id}`);
  const managers = await db.user.findMany({ where: { role: "manager" }, select: { id: true } });
  for (const m of managers) await notify(m.id, `Repair request (${job.priority}): ${job.title}`, `/manager/jobs/${job.id}`);
  redirect(`/tenant/requests/${job.id}`);
}
