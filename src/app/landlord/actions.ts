"use server";
import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type User } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { notify, notifyManagers } from "@/lib/notify";
import { addCharge, completePayment, ensureCharges, leaseBalance, settleLease, waiveCharge } from "@/lib/billing";
import { dateOnly, fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { date, id, int, isUniqueViolation, oneOf, reqText, text } from "@/lib/validate";
import { CHARGE_KINDS, CHARGE_KIND_LABEL, MAX_ADVANCE_MONTHS } from "@/lib/rules";
import { triage } from "@/lib/insights";
import { PROPERTY_TYPES } from "@/lib/property-types";
import { placeLine, readPlace } from "@/lib/geo-form";

const refresh = () => revalidatePath("/", "layout");

/** Landlords can act on their own records; CasaVilla managers can act on any landlord's. */
async function actor() { return requireUser("landlord", "manager"); }
const owns = (u: User, landlordId: number) => u.role === "manager" || u.id === landlordId;
const MAX_RENT = 500_000_000;

async function ownedProperty(u: User, pid: number) {
  const p = await db.property.findUnique({ where: { id: pid } });
  if (!p || !owns(u, p.landlordId)) return fail("Property not found");
  return p;
}
async function ownedLease(u: User, lid: number) {
  const l = await db.lease.findUnique({ where: { id: lid } });
  if (!l || !owns(u, l.landlordId)) return fail("Lease not found");
  return l;
}

export async function saveProperty(fd: FormData) {
  const u = await actor();
  const pid = id(fd) || null;
  const existing = pid ? await ownedProperty(u, pid) : null;
  // New properties must be placed in the canonical location list; older ones can be saved until they're verified.
  const place = await readPlace(fd, { required: !existing || !!existing.locationId });
  const name = await reqText(fd, "name", "the property name", { max: 120 });
  const type = await oneOf(fd, "type", PROPERTY_TYPES, "property type");
  const description = await text(fd, "description", "the description", { optional: true, max: 3000 });
  // The readable address follows the structured one. When an old text-only address is verified, the old text
  // is kept as the landmark (unless one was given) so nothing the landlord typed is lost.
  const location = place.locationId ? await placeLine(place) : existing?.location ?? (await reqText(fd, "location", "the address", { max: 200 }));
  if (existing && !existing.locationId && place.locationId && !place.landmark) place.landmark = existing.location;
  const data = { name, type, description, location: location || existing?.location || name, ...place };
  const photoId = await saveUpload(fd.get("photo"), u.id, true, true);
  if (existing) {
    await db.property.update({ where: { id: existing.id }, data: { ...data, ...(photoId ? { photoId } : {}) } });
    if (place.locationId !== existing.locationId) {
      // Open repair jobs travel with the property.
      await db.job.updateMany({ where: { propertyId: existing.id, status: { notIn: ["done", "cancelled"] } }, data: { locationId: place.locationId } });
      await audit(u.id, "property.located", "property", existing.id, `${existing.locationId ?? existing.location} → ${place.locationId}`);
    }
    await audit(u.id, "property.updated", "property", existing.id, name);
    refresh();
    return;
  }
  const landlordId = u.role === "manager" ? id(fd, "landlordId") : u.id;
  const landlord = await db.user.findFirst({ where: { id: landlordId, role: "landlord" } });
  if (!landlord) return fail("Choose a landlord");
  const p = await db.property.create({ data: { ...data, landlordId, photoId } });
  await audit(u.id, "property.created", "property", p.id, `${name} — ${location}`);
  if (landlord.status === "pending") await notifyManagers(`${landlord.name} added a property (${p.name}) — approve them so it can be listed.`, "/manager/people?status=pending");
  redirect(`/${u.role}/properties/${p.id}`);
}

export async function addUnit(fd: FormData) {
  const u = await actor();
  const p = await ownedProperty(u, id(fd, "propertyId"));
  const count = await int(fd, "count", "how many units", { min: 1, max: 50, fallback: 1 });
  const label = await reqText(fd, "label", "a unit name", { max: 40 });
  const rent = await int(fd, "rent", "the rent", { min: 1000, max: MAX_RENT });
  const bedrooms = await int(fd, "bedrooms", "bedrooms", { min: 0, max: 20, fallback: 1 });
  const labels = Array.from({ length: count }, (_, i) => (count > 1 ? `${label} ${i + 1}` : label));
  const clash = await db.unit.findFirst({ where: { propertyId: p.id, label: { in: labels, mode: "insensitive" } }, select: { label: true } });
  if (clash) return fail(`${p.name} already has a unit called "${clash.label}"`);
  await db.unit.createMany({ data: labels.map((l) => ({ propertyId: p.id, label: l, bedrooms, rent, listed: fd.get("listed") === "on" })) });
  await audit(u.id, "unit.created", "property", p.id, `${count} × ${label} at ${ugx(rent)}`);
  refresh();
}

export async function updateUnit(fd: FormData) {
  const u = await actor();
  const unit = await db.unit.findUnique({ where: { id: id(fd) }, include: { property: true } });
  if (!unit || !owns(u, unit.property.landlordId)) return fail("Unit not found");
  const label = await reqText(fd, "label", "a unit name", { max: 40 });
  const rent = await int(fd, "rent", "the rent", { min: 1000, max: MAX_RENT });
  const bedrooms = await int(fd, "bedrooms", "bedrooms", { min: 0, max: 20, fallback: unit.bedrooms });
  const clash = await db.unit.findFirst({ where: { propertyId: unit.propertyId, id: { not: unit.id }, label: { equals: label, mode: "insensitive" } } });
  if (clash) return fail(`${unit.property.name} already has a unit called "${label}"`);
  await db.unit.update({
    where: { id: unit.id },
    // An occupied unit can never be listed; its lease rent is changed through a renewal, not here.
    data: { label, rent, bedrooms, listed: unit.status === "occupied" ? false : fd.get("listed") === "on" },
  });
  if (rent !== unit.rent) await audit(u.id, "unit.rent_changed", "unit", unit.id, `${unit.label}: ${ugx(unit.rent)} → ${ugx(rent)}`);
  refresh();
}

export async function decideApplication(fd: FormData) {
  const u = await actor();
  const a = await db.application.findUnique({ where: { id: id(fd) }, include: { unit: { include: { property: { include: { landlord: true } } } }, tenant: true } });
  if (!a || !owns(u, a.unit.property.landlordId)) return fail("Application not found");
  if (a.status !== "pending") return fail(`This application was already ${a.status}`);
  const where = `${a.unit.property.name} · ${a.unit.label}`;

  if (fd.get("decision") === "reject") {
    const done = await db.application.updateMany({ where: { id: a.id, status: "pending" }, data: { status: "rejected" } });
    if (done.count) {
      await notify(a.tenantId, `Your application for ${where} was not approved. Keep browsing — new homes are listed every week.`, "/listings");
      await audit(u.id, "application.rejected", "application", a.id, `${a.tenant.name} → ${where}`);
    }
    refresh();
    return;
  }
  if (a.unit.property.landlord.status !== "active") return fail("The landlord's account must be approved before a lease can be created");
  if (a.tenant.status !== "active") return fail("This tenant's account is suspended");

  const startDate = (await date(fd, "startDate", "a start date"))!;
  const endDate = (await date(fd, "endDate", "an end date"))!;
  if (endDate <= startDate) return fail("The lease must end after it starts");
  const today = kampalaToday();
  if (startDate < ymd(new Date(Date.parse(today) - 366 * 86400000))) return fail("The start date can't be more than a year ago");
  const months = (Date.parse(endDate) - Date.parse(startDate)) / (30.4 * 86400000);
  if (months < 1) return fail("A lease must be at least one month long");
  if (months > 121) return fail("A lease can't be longer than 10 years");
  const rent = await int(fd, "rent", "the monthly rent", { min: 1000, max: MAX_RENT, fallback: a.unit.rent });
  const deposit = await int(fd, "deposit", "the deposit", { min: 0, max: rent * 12, fallback: 0 });
  const dueDay = await int(fd, "dueDay", "the due day", { min: 1, max: 28, fallback: 5 });
  const lateFeePct = await int(fd, "lateFeePct", "the late fee %", { min: 0, max: 50, fallback: 0 });

  let result;
  try {
    result = await db.$transaction(async (tx) => {
      // Claim the unit: only succeeds while it is still vacant, so two approvals can't both win.
      const claimed = await tx.unit.updateMany({ where: { id: a.unit.id, status: "vacant" }, data: { status: "occupied", listed: false } });
      if (claimed.count === 0) throw new Error("UNIT_TAKEN");
      const app = await tx.application.updateMany({ where: { id: a.id, status: "pending" }, data: { status: "approved" } });
      if (app.count === 0) throw new Error("APP_CHANGED");
      const lease = await tx.lease.create({
        data: {
          unitId: a.unit.id, tenantId: a.tenantId, landlordId: a.unit.property.landlordId,
          startDate: dateOnly(startDate), endDate: dateOnly(endDate), rent, deposit, dueDay, lateFeePct,
        },
      });
      // Everyone else who applied for this unit is told it's taken; the new tenant's other applications close too.
      const others = await tx.application.findMany({ where: { status: "pending", OR: [{ unitId: a.unit.id }, { tenantId: a.tenantId }], id: { not: a.id } } });
      await tx.application.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "rejected" } });
      await tx.tenantLink.updateMany({ where: { tenantId: a.tenantId, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } });
      return { lease, others };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNIT_TAKEN") return fail("This unit has already been let");
    if (e instanceof Error && e.message === "APP_CHANGED") return fail("This application was changed by someone else — refresh");
    if (isUniqueViolation(e)) return fail("This tenant already has an active lease. End it first.");
    throw e;
  }
  const { lease, others } = result;
  for (const o of others) {
    if (o.tenantId === a.tenantId) continue;
    await notify(o.tenantId, `${where} has been let to another tenant. Similar homes are still available.`, "/listings");
  }
  await ensureCharges(lease);
  const firstDue = await leaseBalance(lease.id);
  await notify(a.tenantId, `Approved! Your lease for ${where} starts ${fmtDate(startDate)}. Rent ${ugx(rent)}/month${firstDue ? ` — ${ugx(firstDue)} is due now` : ""}.`, "/tenant");
  await audit(u.id, "lease.created", "lease", lease.id, `${a.tenant.name} → ${where}, ${ugx(rent)}/mo, ${startDate} to ${endDate}`);
  redirect(`/${u.role}/tenants/${lease.id}`);
}

export async function recordCashPayment(fd: FormData) {
  const u = await actor();
  const l = await ownedLease(u, id(fd, "leaseId"));
  const owed = await leaseBalance(l.id);
  // After move-out only the remaining balance can be collected (no paying ahead on a finished lease).
  if (l.status !== "active" && owed <= 0) return fail("This lease has ended and nothing is owed");
  const amount = await int(fd, "amount", "the amount", { min: 1, max: l.status === "active" ? owed + l.rent * MAX_ADVANCE_MONTHS : owed });
  const method = await oneOf(fd, "method", ["cash", "bank"] as const, "payment method", "cash");
  const chargeId = id(fd, "chargeId");
  const first = chargeId ? await db.charge.findFirst({ where: { id: chargeId, leaseId: l.id } }) : null;
  const target = first
    ?? (await db.charge.findFirst({ where: { leaseId: l.id, status: { not: "paid" } }, orderBy: { dueDate: "asc" } }))
    ?? (await db.charge.findFirst({ where: { leaseId: l.id }, orderBy: { dueDate: "desc" } }));
  if (!target) return fail("This lease has no charges yet");
  const ref = (await text(fd, "reference", "the reference", { optional: true, max: 60 })) || `${method.toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  if (await db.payment.findUnique({ where: { reference: ref } })) return fail(`A payment with reference ${ref} was already recorded`);
  const p = await db.payment.create({
    data: { chargeId: target.id, leaseId: l.id, tenantId: l.tenantId, amount, method, reference: ref, status: "pending", recordedById: u.id },
  });
  await completePayment(p.id);
  refresh();
  redirect(`/receipts/${p.id}`);
}

export async function addLeaseCharge(fd: FormData) {
  const u = await actor();
  const l = await ownedLease(u, id(fd, "leaseId"));
  if (l.status !== "active") return fail("This lease has ended");
  const kind = await oneOf(fd, "kind", CHARGE_KINDS, "charge type");
  const amount = await int(fd, "amount", "the amount", { min: 500, max: 100_000_000 });
  const description = (await text(fd, "description", "a description", { optional: true, max: 120 })) || CHARGE_KIND_LABEL[kind];
  const dueDate = (await date(fd, "dueDate", "a due date", true)) || kampalaToday();
  await addCharge({ leaseId: l.id, kind, description, amount, dueDate, actorId: u.id });
  await notify(l.tenantId, `New charge on your account: ${description} — ${ugx(amount)}, due ${fmtDate(dueDate)}.`, "/tenant/rent");
  refresh();
}

export async function waiveLeaseCharge(fd: FormData) {
  const u = await actor();
  const c = await db.charge.findUnique({ where: { id: id(fd, "chargeId") }, include: { lease: true } });
  if (!c || !owns(u, c.lease.landlordId)) return fail("Charge not found");
  const open = c.amount - c.paid;
  if (open <= 0) return fail("Nothing left to waive on this charge");
  const amount = await int(fd, "amount", "the amount to waive", { min: 1, max: open, fallback: open });
  const reason = (await text(fd, "reason", "a reason", { optional: true, max: 200 })) ?? "";
  const w = await waiveCharge(c.id, amount, u.id, reason);
  if (w) await notify(c.lease.tenantId, `${ugx(w)} was waived on ${c.description}.${reason ? ` (${reason})` : ""}`, "/tenant/rent");
  refresh();
}

export async function renewLease(fd: FormData) {
  const u = await actor();
  const l = await ownedLease(u, id(fd, "id"));
  if (l.status !== "active") return fail("Only an active lease can be renewed");
  const endDate = (await date(fd, "endDate", "the new end date"))!;
  const today = kampalaToday();
  if (endDate <= ymd(l.endDate) || endDate <= today) return fail("The new end date must be after the current end date and after today");
  const rent = await int(fd, "rent", "the new rent", { min: 1000, max: MAX_RENT, fallback: l.rent });
  if (rent > l.rent * 1.5) return fail("That's more than a 50% increase — check the amount");
  await db.lease.update({ where: { id: l.id }, data: { endDate: dateOnly(endDate), rent } });
  const change = rent !== l.rent ? ` New rent ${ugx(rent)}/month from next month (was ${ugx(l.rent)}).` : "";
  await notify(l.tenantId, `Your lease has been renewed until ${fmtDate(endDate)}.${change}`, "/tenant/lease");
  await audit(u.id, "lease.renewed", "lease", l.id, `to ${endDate}${change ? `, ${ugx(l.rent)} → ${ugx(rent)}` : ""}`);
  refresh();
}

export async function endLease(fd: FormData) {
  const u = await actor();
  const l = await ownedLease(u, id(fd));
  if (l.status !== "active") return fail("This lease has already ended");
  const moveOut = (await date(fd, "moveOut", "the move-out date", true)) || kampalaToday();
  if (moveOut < ymd(l.startDate)) return fail("The move-out date can't be before the lease started");
  const s = await settleLease(l.id, moveOut, fd.get("useDeposit") === "on");
  // Free the unit (the one-active-lease rule guarantees nobody else holds it).
  await db.unit.update({ where: { id: l.unitId }, data: { status: "vacant", listed: fd.get("relist") === "on" } });
  const summary = s.settlement > 0 ? `${ugx(s.settlement)} is due back to you` : s.settlement < 0 ? `${ugx(-s.settlement)} is still owed` : "nothing is owed either way";
  await notify(l.tenantId, `Your lease has ended (move-out ${fmtDate(moveOut)}).${s.depositUsed ? ` ${ugx(s.depositUsed)} of your deposit was applied to unpaid rent.` : ""} Final settlement: ${summary}.`, "/tenant/lease");
  await audit(u.id, "lease.ended", "lease", l.id, `move-out ${moveOut}; deposit used ${ugx(s.depositUsed)}; settlement ${ugx(s.settlement)}; ${s.cancelled} future charge(s) removed`);
  refresh();
}

export async function landlordJob(fd: FormData) {
  const u = await requireUser("landlord");
  const p = await ownedProperty(u, id(fd, "propertyId"));
  const unitId = id(fd, "unitId") || null;
  if (unitId && !(await db.unit.findFirst({ where: { id: unitId, propertyId: p.id } }))) return fail("Choose a unit in this property");
  const title = await reqText(fd, "title", "a short title", { max: 120 });
  const description = await reqText(fd, "description", "a description", { max: 3000 });
  let priority = await oneOf(fd, "priority", ["low", "normal", "urgent"] as const, "priority", "normal");
  const t = triage(`${title} ${description}`);
  if (t.urgent) priority = "urgent";
  const photoId = await saveUpload(fd.get("photo"), u.id, false, true);
  const job = await db.job.create({
    data: {
      requesterId: u.id, landlordId: u.id, propertyId: p.id, unitId, photoId, title, description, priority, locationId: p.locationId,
      category: String(fd.get("category") || t.category || "Other"),
    },
  });
  await audit(u.id, "job.created", "job", job.id, title);
  await notifyManagers(`${priority === "urgent" ? "URGENT repair" : "Repair"} at ${p.name}: ${title}`, `/manager/jobs/${job.id}`);
  redirect(`/landlord/maintenance/${job.id}`);
}

/** Closes a move-out refund once the landlord has paid the tenant back. */
export async function markRefundPaid(fd: FormData) {
  const u = await actor();
  const l = await ownedLease(u, id(fd));
  if (l.status !== "ended" || !l.settlement || l.settlement <= 0) return fail("No refund is due on this lease");
  const method = await oneOf(fd, "method", ["cash", "bank", "mobile money"] as const, "refund method", "cash");
  const done = await db.lease.updateMany({ where: { id: l.id, settlement: l.settlement }, data: { settlement: 0 } });
  if (!done.count) return fail("This lease was just updated — refresh");
  await notify(l.tenantId, `Your deposit refund of ${ugx(l.settlement)} has been paid (${method}). Your account is fully settled.`, "/tenant/lease");
  await audit(u.id, "lease.refund_paid", "lease", l.id, `${ugx(l.settlement)} via ${method}`);
  refresh();
}
