"use server";
import { landlordCodeFor, replaceLandlordCode } from "@/lib/landlord-code";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireSuperAdmin, requireUser } from "@/lib/auth";
import { notify, notifyManagers } from "@/lib/notify";
import { normalizePhone, isEmail, isUgPhone } from "@/lib/format";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { requireSignature } from "@/lib/signature";
import { requireChecklist } from "@/lib/checklist";
import { runHousekeeping } from "@/lib/housekeeping";
import { checkIds, fixCheck } from "@/lib/integrity";
import { advanceOrder } from "@/lib/orders";
import { id, oneOf, reqText } from "@/lib/validate";

export async function setUserStatus(fd: FormData) {
  const me = await requireUser("manager");
  const uid = id(fd);
  const status = await oneOf(fd, "status", ["active", "suspended", "pending"] as const, "status");
  if (uid === me.id) return fail("You can't change your own status");
  const before = await db.user.findUnique({ where: { id: uid } });
  if (!before) return fail("Person not found");
  if (before.status === status) return;
  // Office accounts, and approving a new landlord (which sets their commission), are for super admins only.
  if (!me.superAdmin && before.role === "manager") return fail("Only a super admin can suspend or reactivate office accounts");
  if (!me.superAdmin && (before.role === "landlord" || before.role === "agent") && before.status === "pending" && status === "active") return fail(`Only a super admin can approve ${before.role === "agent" ? "an agent" : "a landlord"} and set their commission`);
  // Approving follows the written checklist. Approving a service provider is otherwise routine; every other change
  // of status (suspending, reactivating, approving a landlord) is also signed.
  const approving = before.status === "pending" && status === "active";
  if (approving && before.role === "agent" && !(before.idFileId && before.agreementFileId)) return fail("The agent must upload their ID and signed agreement first");
  const checklist = approving && (before.role === "landlord" || before.role === "provider" || before.role === "agent") ? await requireChecklist(fd, before.role) : null;
  const routine = approving && before.role === "provider";
  const reason = routine ? null : await requireSignature(fd, me);
  // Approving a new landlord: their commission is agreed at sign-up, and they get their private landlord code.
  let commissionPct: number | undefined, salesCommissionPct: number | undefined;
  const pctOf = (k: string, max: number) => {
    const raw = String(fd.get(k) ?? "").replace("%", "").trim();
    const pct = Number(raw);
    return raw === "" || !Number.isFinite(pct) || pct < 0 || pct > max ? null : Math.round(pct * 100) / 100;
  };
  if (status === "active" && (before.role === "landlord" || before.role === "agent") && before.status === "pending") {
    const c = pctOf("commission", 50);
    if (c === null) return fail(`Set the ${before.role}'s commission (0–50%) before approving them`);
    commissionPct = c;
    if (before.role === "agent") {
      const sc = pctOf("salesCommission", 20);
      if (sc === null) return fail("Set CasaVilla's commission on the agent's sales (0–20%)");
      salesCommissionPct = sc;
    }
  }
  const u = await db.user.update({ where: { id: uid }, data: { status, ...(commissionPct !== undefined ? { commissionPct } : {}), ...(salesCommissionPct !== undefined ? { salesCommissionPct } : {}) } });
  if (u.role === "landlord" && status === "active") await landlordCodeFor(u.id);
  await audit(me.id, `user.${status}`, "user", u.id, `${u.name} (${u.role}): ${before.status} → ${status}${commissionPct !== undefined ? `, commission ${commissionPct}%` : ""}${salesCommissionPct !== undefined ? `, sales ${salesCommissionPct}%` : ""}`, db,
    { reason, signed: !routine, before: { status: before.status, ...(commissionPct !== undefined ? { commissionPct: before.commissionPct } : {}) }, after: { status, ...(commissionPct !== undefined ? { commissionPct } : {}), ...(salesCommissionPct !== undefined ? { salesCommissionPct } : {}), ...(checklist ? { checklist } : {}) } });

  if (status === "active") {
    const link = `/${u.role}`;
    await notify(u.id, "Your CasaVilla account has been approved. Welcome aboard!", link);
  }
  if (status === "suspended" && u.role === "provider") {
    // Their unfinished jobs go back to "waiting for a provider" so the work still gets done.
    const jobs = await db.job.findMany({ where: { providerId: u.id, status: { in: ["assigned", "quoted", "accepted", "in_progress"] } } });
    for (const j of jobs) {
      await db.job.update({ where: { id: j.id }, data: { providerId: null, status: "open", quote: null, assignedAt: null } });
      await db.jobNote.create({ data: { jobId: j.id, authorId: me.id, body: `${u.businessName || u.name} was removed (account suspended). Waiting for a new provider.`, system: true } });
    }
    if (jobs.length) await notifyManagers(`${jobs.length} job(s) from ${u.businessName || u.name} need reassigning.`, "/manager/jobs");
    await db.product.updateMany({ where: { providerId: u.id }, data: { active: false } });
  }
  if (status === "suspended" && u.role === "agent") {
    // A suspended agent's listings and short stays come down straight away.
    await db.saleListing.updateMany({ where: { ownerId: u.id, status: { in: ["pending", "active", "under_offer"] } }, data: { status: "withdrawn", reviewNote: "Agent suspended" } });
    await db.unit.updateMany({ where: { property: { landlordId: u.id } }, data: { listed: false } });
  }
  if (status === "suspended" && u.role === "landlord") {
    await db.unit.updateMany({ where: { property: { landlordId: u.id }, status: "vacant" }, data: { listed: false } });
    const apps = await db.application.findMany({ where: { status: "pending", unit: { property: { landlordId: u.id } } } });
    await db.application.updateMany({ where: { id: { in: apps.map((a) => a.id) } }, data: { status: "rejected" } });
    for (const a of apps) await notify(a.tenantId, "A home you applied for is no longer available.", "/tenant/applications");
  }
  revalidatePath("/", "layout");
}

/** Replaces a landlord's code (e.g. it was shared with the wrong people). The old code stops working at once. */
export async function newLandlordCode(fd: FormData) {
  const me = await requireSuperAdmin();
  const u = await db.user.findFirst({ where: { id: id(fd), role: "landlord" }, select: { id: true, name: true, landlordCode: true } });
  if (!u) return fail("Landlord not found");
  const reason = await requireSignature(fd, me);
  const code = await replaceLandlordCode(u.id);
  await audit(me.id, "landlord.code_replaced", "user", u.id, `${u.name}: ${u.landlordCode ?? "none"} → ${code}`, db, { reason, signed: true });
  revalidatePath("/", "layout");
}

export async function createStaff(fd: FormData) {
  const me = await requireSuperAdmin();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  if (!isEmail(email)) return fail("Enter a valid email");
  const password = String(fd.get("password") || "");
  if (password.length < 8) return fail("Password must be at least 8 characters");
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (!isUgPhone(phone)) return fail("Enter a valid Ugandan phone number");
  if (await db.user.findUnique({ where: { email } })) return fail("Someone already uses that email");
  const reason = await requireSignature(fd, me);
  const u = await db.user.create({
    data: { name: await reqText(fd, "name", "a name", { max: 100 }), email, phone, passwordHash: await bcrypt.hash(password, 10), role: "manager", status: "active", superAdmin: fd.get("superAdmin") === "on", mustChangePassword: true },
  });
  await audit(me.id, u.superAdmin ? "user.super_admin_created" : "user.staff_created", "user", u.id, `${u.name} · ${email}`, db, { reason, signed: true });
  revalidatePath("/manager/people");
}

/** Makes a staff account a super admin, or back to ordinary staff. A super admin can't change their own level, so one always remains. */
export async function setSuperAdmin(fd: FormData) {
  const me = await requireSuperAdmin();
  const u = await db.user.findFirst({ where: { id: id(fd), role: "manager" } });
  if (!u) return fail("Staff account not found");
  if (u.id === me.id) return fail("You can't change your own level");
  const reason = await requireSignature(fd, me);
  const on = fd.get("on") === "1";
  await db.user.update({ where: { id: u.id }, data: { superAdmin: on } });
  await audit(me.id, on ? "user.super_admin_on" : "user.super_admin_off", "user", u.id, `${u.name} · ${u.email}`, db, { reason, signed: true, before: { superAdmin: u.superAdmin }, after: { superAdmin: on } });
  revalidatePath("/", "layout");
}

export async function generateCharges() {
  await requireUser("manager");
  await runHousekeeping(true);
  revalidatePath("/manager", "layout");
}

export async function runMaintenance() {
  const me = await requireSuperAdmin();
  const r = await runHousekeeping(true);
  await audit(me.id, "system.housekeeping", "system", null, JSON.stringify(r));
  revalidatePath("/", "layout");
}

export async function repairCheck(fd: FormData) {
  const me = await requireSuperAdmin();
  const check = String(fd.get("check"));
  if (!checkIds.includes(check)) return fail("Unknown check");
  const n = await fixCheck(check);
  await audit(me.id, "system.repair", "system", null, `${check}: ${n} row(s)`);
  revalidatePath("/", "layout");
}

export async function managerOrder(fd: FormData) {
  const me = await requireUser("manager");
  const status = await oneOf(fd, "status", ["confirmed", "delivered", "cancelled"] as const, "status");
  await advanceOrder(id(fd), status, me.id);
  revalidatePath("/manager/orders");
}
