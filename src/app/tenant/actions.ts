"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify, notifyManagers } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { initiateCharge, provider } from "@/lib/momo";
import { completePayment, failPayment, leaseBalance } from "@/lib/billing";
import { dateOnly, kampalaToday, networkFor, normalizePhone, ugx } from "@/lib/format";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { triage } from "@/lib/insights";
import { MAX_ADVANCE_MONTHS } from "@/lib/rules";
import { SERVICE_CATEGORIES } from "@/db";
import { date, id, isUniqueViolation, oneOf, reqText, text } from "@/lib/validate";

const MAX_OPEN_APPLICATIONS = 5;

export async function applyForUnit(fd: FormData) {
  const u = await requireUser("tenant");
  const unitId = id(fd, "unitId");
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { property: { include: { landlord: { select: { status: true } } } } } });
  if (!unit || unit.status !== "vacant" || !unit.listed || unit.property.landlord.status !== "active") return fail("This home is no longer available");
  const current = await db.lease.findFirst({ where: { tenantId: u.id, unitId, status: "active" } });
  if (current) return fail("You already live here");
  const dupe = await db.application.findFirst({ where: { unitId, tenantId: u.id, status: "pending" } });
  if (!dupe) {
    const open = await db.application.count({ where: { tenantId: u.id, status: "pending" } });
    if (open >= MAX_OPEN_APPLICATIONS) return fail(`You already have ${open} applications waiting. Withdraw one before applying for another home.`);
    const moveIn = await date(fd, "moveIn", "a move-in date", true);
    if (moveIn && moveIn < kampalaToday()) return fail("The move-in date can't be in the past");
    try {
      await db.application.create({
        data: { unitId, tenantId: u.id, message: await text(fd, "message", "your message", { optional: true, max: 1000 }), moveIn: moveIn ? dateOnly(moveIn) : null },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // a double-tap: the first application already went through
    }
    await notify(unit.property.landlordId, `${u.name} applied for ${unit.property.name} · ${unit.label}`, "/landlord/applications");
  }
  redirect(`/listings/${unitId}?sent=1`);
}

export async function withdrawApplication(fd: FormData) {
  const u = await requireUser("tenant");
  const done = await db.application.updateMany({ where: { id: id(fd), tenantId: u.id, status: "pending" }, data: { status: "withdrawn" } });
  if (done.count) await audit(u.id, "application.withdrawn", "application", id(fd));
  revalidatePath("/tenant/applications");
}

export async function startPayment(_: { error?: string } | undefined, fd: FormData): Promise<{ error?: string } | undefined> {
  const u = await requireUser("tenant");
  const chargeId = id(fd, "chargeId");
  const c = await db.charge.findFirst({ where: { id: chargeId, lease: { tenantId: u.id } }, include: { lease: true } });
  if (!c) return { error: "Charge not found" };
  const owed = await leaseBalance(c.leaseId);
  if (c.lease.status !== "active" && owed <= 0) return { error: "This lease has ended and nothing is owed" };
  const max = c.lease.status === "active" ? owed + c.lease.rent * MAX_ADVANCE_MONTHS : owed;
  const amount = Math.round(Number(String(fd.get("amount") ?? "").replace(/[,\s]/g, "")));
  if (!Number.isFinite(amount) || amount < 500) return { error: "Enter an amount of at least UGX 500" };
  if (amount > max) return { error: c.lease.status === "active" ? `That's more than you owe plus ${MAX_ADVANCE_MONTHS} months in advance (max ${ugx(max)})` : `Your remaining balance is ${ugx(max)}` };
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter a valid Ugandan phone number" };
  const network = (String(fd.get("network")) || networkFor(phone)) as "mtn" | "airtel";
  if (!["mtn", "airtel"].includes(network)) return { error: "Choose MTN or Airtel" };
  const detected = networkFor(phone);
  if (detected && detected !== network) return { error: `${phone.replace("+256", "0")} looks like an ${detected === "mtn" ? "MTN" : "Airtel"} number — choose ${detected === "mtn" ? "MTN MoMo" : "Airtel Money"}` };

  // A second tap (or a retry) within 3 minutes reuses the request already sent to the phone.
  const recent = await db.payment.findFirst({
    where: { leaseId: c.leaseId, tenantId: u.id, status: "pending", amount, phone, createdAt: { gt: new Date(Date.now() - 3 * 60000) } },
  });
  if (recent) redirect(`/pay/${recent.reference}`);

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
  const lease = await db.lease.findFirst({ where: { tenantId: u.id, status: "active" }, include: { unit: { include: { property: true } } } });
  if (!lease) return fail("You need an active lease to report a repair");
  const title = await reqText(fd, "title", "a short title", { max: 120 });
  const description = await reqText(fd, "description", "a description", { max: 3000 });
  let category = await oneOf(fd, "category", SERVICE_CATEGORIES, "category", "Other");
  let priority = await oneOf(fd, "priority", ["low", "normal", "urgent"] as const, "urgency", "normal");

  // The same problem reported twice in a day is very likely a double submission.
  const dup = await db.job.findFirst({ where: { requesterId: u.id, title: { equals: title, mode: "insensitive" }, status: { notIn: ["done", "cancelled"] }, createdAt: { gt: new Date(Date.now() - 86400000) } } });
  if (dup) redirect(`/tenant/requests/${dup.id}`);

  const t = triage(`${title} ${description}`);
  const notes: string[] = [];
  if (t.urgent && priority !== "urgent") { priority = "urgent"; notes.push("Marked urgent automatically — the description mentions a safety risk or loss of water/power."); }
  if (category === "Other" && t.category) { category = t.category as typeof category; notes.push(`Filed under ${t.category} based on the description.`); }

  const photoId = await saveUpload(fd.get("photo"), u.id, false, true);
  const job = await db.job.create({
    data: {
      requesterId: u.id, landlordId: lease.landlordId, propertyId: lease.unit.propertyId, unitId: lease.unitId, locationId: lease.unit.property.locationId,
      category, title, description, priority, photoId,
      notes: notes.length ? { create: notes.map((body) => ({ authorId: u.id, body, system: true })) } : undefined,
    },
  });
  const where = `${lease.unit.property.name} · ${lease.unit.label}`;
  await notify(lease.landlordId, `${priority === "urgent" ? "URGENT: " : ""}New repair request from ${u.name} (${where}): ${job.title}`, `/landlord/maintenance/${job.id}`);
  await notifyManagers(`Repair request (${job.priority}) at ${where}: ${job.title}`, `/manager/jobs/${job.id}`);
  await audit(u.id, "job.created", "job", job.id, `${title} (${priority})`);
  redirect(`/tenant/requests/${job.id}`);
}
