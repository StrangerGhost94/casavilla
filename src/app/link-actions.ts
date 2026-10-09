"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { requestLink } from "@/lib/links";
import { ensureCharges, completePayment } from "@/lib/billing";
import { dateOnly, fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { fail } from "@/lib/flash";
import { date, id, int, isUniqueViolation, text } from "@/lib/validate";

const refresh = () => revalidatePath("/", "layout");

/** Tenant (already signed in, no lease yet) asks to be connected to their landlord. */
export async function connectLandlord(fd: FormData) {
  const u = await requireUser("tenant");
  const r = await requestLink(u, String(fd.get("landlordPhone") || ""), await text(fd, "unitNote", "your house or unit", { optional: true, max: 120 }));
  if (!r.ok) return fail(r.error);
  refresh();
}

export async function cancelLink(fd: FormData) {
  const u = await requireUser("tenant");
  await db.tenantLink.updateMany({ where: { id: id(fd), tenantId: u.id, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } });
  refresh();
}

async function loadLink(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const l = await db.tenantLink.findUnique({ where: { id: id(fd) }, include: { tenant: true } });
  if (!l || (u.role !== "manager" && l.landlordId !== u.id)) return fail("Request not found");
  if (l.status !== "pending") return fail(`This request was already ${l.status}`);
  return { u, l };
}

export async function declineLink(fd: FormData) {
  const { u, l } = await loadLink(fd);
  const done = await db.tenantLink.updateMany({ where: { id: l.id, status: "pending" }, data: { status: "declined", decidedAt: new Date() } });
  if (done.count) {
    await notify(l.tenantId, "Your landlord couldn't confirm that you rent from them. Check the phone number, or contact CasaVilla for help.", "/tenant");
    await audit(u.id, "link.declined", "tenant_link", l.id, l.tenant.name);
  }
  refresh();
}

/**
 * Landlord confirms an existing tenant: picks the unit they live in and the lease terms.
 * Rent is billed from the chosen month onwards — earlier months were settled outside the app
 * (any old arrears can be added as a one-off charge). A deposit already held is recorded as an opening cash payment.
 */
export async function confirmLink(fd: FormData) {
  const { u, l } = await loadLink(fd);
  if (l.tenant.status !== "active") return fail("This tenant's account is suspended");
  const unit = await db.unit.findUnique({ where: { id: id(fd, "unitId") }, include: { property: { include: { landlord: true } } } });
  if (!unit || (u.role !== "manager" && unit.property.landlordId !== u.id)) return fail("Choose one of your units");
  if (u.role === "manager" && l.landlordId && unit.property.landlordId !== l.landlordId) return fail("Choose a unit that belongs to this tenant's landlord");
  if (unit.property.landlord.status !== "active") return fail("The landlord's account must be approved by CasaVilla first");
  if (unit.mode === "short") return fail("That unit is set up for short stays — choose a monthly unit");

  const today = kampalaToday();
  const startDate = (await date(fd, "startDate", "the date rent billing starts"))!;
  const endDate = (await date(fd, "endDate", "the lease end date"))!;
  if (startDate < ymd(new Date(Date.parse(today) - 366 * 86400000))) return fail("Billing can't start more than a year ago");
  if (endDate <= startDate || endDate <= today) return fail("The lease must end after billing starts and after today");
  const rent = await int(fd, "rent", "the monthly rent", { min: 1000, max: 500_000_000, fallback: unit.rent });
  const dueDay = await int(fd, "dueDay", "the due day", { min: 1, max: 28, fallback: 5 });
  const lateFeePct = await int(fd, "lateFeePct", "the late fee %", { min: 0, max: 50, fallback: 0 });
  const depositHeld = await int(fd, "depositHeld", "the deposit you hold (at most one month's rent — Landlord and Tenant Act s.30)", { min: 0, max: rent, fallback: 0 });

  let lease;
  try {
    lease = await db.$transaction(async (tx) => {
      const claimed = await tx.unit.updateMany({ where: { id: unit.id, status: "vacant" }, data: { status: "occupied", listed: false } });
      if (claimed.count === 0) throw new Error("UNIT_TAKEN");
      const created = await tx.lease.create({
        data: {
          unitId: unit.id, tenantId: l.tenantId, landlordId: unit.property.landlordId, rent, deposit: depositHeld, dueDay, lateFeePct,
          startDate: dateOnly(startDate), endDate: dateOnly(endDate),
        },
      });
      const ok = await tx.tenantLink.updateMany({ where: { id: l.id, status: "pending" }, data: { status: "linked", leaseId: created.id, landlordId: unit.property.landlordId, decidedAt: new Date() } });
      if (!ok.count) throw new Error("CHANGED");
      // Their open applications elsewhere are no longer needed; others waiting on this unit are told it's taken.
      const others = await tx.application.findMany({ where: { status: "pending", OR: [{ tenantId: l.tenantId }, { unitId: unit.id }] } });
      await tx.application.updateMany({ where: { id: { in: others.map((o) => o.id) } }, data: { status: "rejected" } });
      return { created, others };
    });
  } catch (e) {
    if (e instanceof Error && e.message === "UNIT_TAKEN") return fail("That unit already has a tenant on CasaVilla — choose the right unit");
    if (e instanceof Error && e.message === "CHANGED") return fail("This request was just changed — refresh");
    if (isUniqueViolation(e)) return fail("This tenant already has an active lease");
    throw e;
  }
  const { created, others } = lease;
  for (const o of others) if (o.tenantId !== l.tenantId) await notify(o.tenantId, `${unit.property.name} · ${unit.label} has been let to another tenant.`, "/listings");

  await ensureCharges(created);
  if (depositHeld > 0) {
    // The landlord already has this money: record it so the deposit shows as paid and counts at move-out.
    const dep = await db.charge.findFirst({ where: { leaseId: created.id, kind: "deposit" } });
    if (dep) {
      const p = await db.payment.create({
        data: { chargeId: dep.id, leaseId: created.id, tenantId: l.tenantId, amount: depositHeld, method: "cash", reference: `OPENING-DEP-${created.id}`, status: "pending", recordedById: u.id },
      });
      await completePayment(p.id);
    }
  }
  const where = `${unit.property.name} · ${unit.label}`;
  await notify(l.tenantId, `You're connected! Your lease for ${where} is now on CasaVilla — rent ${ugx(rent)}/month from ${fmtDate(startDate)}. Pay with Mobile Money in the app.`, "/tenant");
  const { saveAgreementSnapshot } = await import("@/lib/agreement");
  await saveAgreementSnapshot(created.id, u.id, "connected tenant");
  await audit(u.id, "link.confirmed", "lease", created.id, `${l.tenant.name} → ${where}, ${ugx(rent)}/mo from ${startDate}${depositHeld ? `, deposit held ${ugx(depositHeld)}` : ""}`);
  redirect(`/${u.role}/tenants/${created.id}`);
}
