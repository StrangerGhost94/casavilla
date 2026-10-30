"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { fmtDate, networkFor, normalizePhone, ugx } from "@/lib/format";
import { initiateCharge, provider } from "@/lib/momo";
import { id, oneOf, reqText, text } from "@/lib/validate";
import { MOMO_MAX, canSeeSite, completeBuildPayment, failBuildPayment, newBuildRef, siteSummary } from "@/lib/build-sites";
import { STAGE_STATUS_KEYS, SITE_STATUS_KEYS, STAGE_TEMPLATE } from "@/lib/build";

const refresh = () => revalidatePath("/", "layout");
const num = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").replace(/[,\s]/g, ""); return v === "" ? null : Number(v); };
const day = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? ""); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null; };
const siteHref = (siteId: number) => `/manager/build/sites/${siteId}`;
const clientHref = (siteId: number) => `/build/my/${siteId}`;

// ---------------------------------------------------------------------------------------------------------------
// The client pays a stage by Mobile Money

export type BuildPayState = { error?: string } | undefined;

export async function payBuildStage(_: BuildPayState, fd: FormData): Promise<BuildPayState> {
  const u = await requireUser();
  const sum = await siteSummary(id(fd, "siteId"));
  if (!sum || !canSeeSite(u, sum.site)) return { error: "Project not found" };
  if (!["active", "on_hold"].includes(sum.site.status)) return { error: "This project is closed for payments" };
  const stage = sum.stages.find((s) => s.id === id(fd, "stageId"));
  if (!stage) return { error: "Choose the stage you're paying for" };
  const amount = Math.round(num(fd, "amount") ?? 0);
  if (!amount || amount < 1000) return { error: "Enter the amount to pay" };
  if (amount > stage.balance) return { error: `The balance on “${stage.name}” is ${ugx(stage.balance)}` };
  if (amount > MOMO_MAX) return { error: `Mobile Money payments are up to ${ugx(MOMO_MAX)} each. Pay in parts, or by bank transfer.` };
  const phone = normalizePhone(String(fd.get("phone") || u.phone));
  if (!/^\+256\d{9}$/.test(phone)) return { error: "Enter a valid Ugandan Mobile Money number" };
  const network = (String(fd.get("network")) || networkFor(phone)) as "mtn" | "airtel";
  if (!["mtn", "airtel"].includes(network)) return { error: "Choose MTN or Airtel" };
  const detected = networkFor(phone);
  if (detected && detected !== network) return { error: `${phone.replace("+256", "0")} looks like an ${detected === "mtn" ? "MTN" : "Airtel"} number` };
  const open = await db.buildPayment.findFirst({ where: { siteId: sum.site.id, payerId: u.id, status: "pending", method: { in: ["mtn", "airtel"] } } });
  if (open) return { error: "A payment is already waiting for approval on your phone" };
  const reference = newBuildRef();
  const p = await db.buildPayment.create({ data: { siteId: sum.site.id, stageId: stage.id, payerId: u.id, amount, method: network, phone, reference } });
  const res = await initiateCharge({ reference, amount, phone, network, email: u.email, name: u.name, returnPath: `/build/pay/${reference}` });
  if (!res.ok) { await failBuildPayment(p.id); return { error: res.error }; }
  redirect(res.redirect || `/build/pay/${reference}`);
}

/** Test mode only: approve or decline a build payment. */
export async function sandboxBuildPay(fd: FormData) {
  const u = await requireUser();
  if (provider !== "sandbox") return fail("Not available in live mode");
  const p = await db.buildPayment.findUnique({ where: { reference: String(fd.get("ref")) }, include: { site: { select: { clientId: true } } } });
  if (!p || !canSeeSite(u, p.site)) return fail("Payment not found");
  if (fd.get("outcome") === "approve") await completeBuildPayment(p.id); else await failBuildPayment(p.id);
  redirect(`/build/pay/${p.reference}`);
}

// ---------------------------------------------------------------------------------------------------------------
// CasaVilla staff: set up and run a site

/** Starts a site, usually from an agreed request, with the standard stages split from the contract sum. */
export async function createBuildSite(fd: FormData) {
  const u = await requireUser("manager");
  const req = id(fd, "requestId") ? await db.buildRequest.findUnique({ where: { id: id(fd, "requestId") }, include: { site: { select: { id: true } } } }) : null;
  if (req?.site) redirect(siteHref(req.site.id));
  const title = await reqText(fd, "title", "a name for the project", { max: 120 });
  const location = await reqText(fd, "location", "where it is", { max: 160 });
  const clientName = await reqText(fd, "clientName", "the client's name", { max: 80 });
  const clientPhone = normalizePhone(String(fd.get("clientPhone") ?? ""));
  if (!/^\+\d{9,15}$/.test(clientPhone)) return fail("Enter the client's phone number");
  const contractSum = num(fd, "contractSum");
  if (contractSum == null || !Number.isFinite(contractSum) || contractSum < 0 || contractSum > 1e13) return fail("Enter the agreed contract sum in UGX");
  const startDate = day(fd, "startDate"), targetDate = day(fd, "targetDate");
  if (startDate && targetDate && targetDate < startDate) return fail("The handover date is before the start");
  const client = (await db.user.findFirst({ where: { phone: clientPhone, phoneVerifiedAt: { not: null } }, select: { id: true } }))
    ?? (req?.userId ? { id: req.userId } : null);
  // Stages: the standard split (staff adjust names and amounts afterwards); the last one takes any rounding.
  let left = contractSum;
  const stages = fd.get("template") === "on" ? STAGE_TEMPLATE.map(([name, pct], i) => {
    const amount = i === STAGE_TEMPLATE.length - 1 ? left : Math.round((contractSum * pct) / 100 / 1000) * 1000;
    left -= amount;
    return { name, amount, sort: i };
  }) : [];
  const site = await db.buildSite.create({
    data: {
      requestId: req?.id ?? null, clientId: client?.id ?? null, clientName, clientPhone, planId: req?.planId ?? null,
      title, location, contractSum, startDate, targetDate, stages: { create: stages },
    },
  });
  if (req) await db.buildRequest.update({ where: { id: req.id }, data: { status: "won", quote: req.quote ?? contractSum } });
  await audit(u.id, "site.created", "build_site", site.id, `${title} · ${ugx(contractSum)}`);
  if (site.clientId) await notify(site.clientId, `Your building project “${title}” is set up. Follow progress, see photos and pay stages here.`, clientHref(site.id));
  refresh();
  redirect(siteHref(site.id));
}

export async function saveBuildSite(fd: FormData) {
  const u = await requireUser("manager");
  const s = await db.buildSite.findUnique({ where: { id: id(fd) } });
  if (!s) return fail("Project not found");
  const title = await reqText(fd, "title", "a name for the project", { max: 120 });
  const location = await reqText(fd, "location", "where it is", { max: 160 });
  const contractSum = num(fd, "contractSum");
  if (contractSum == null || !Number.isFinite(contractSum) || contractSum < 0 || contractSum > 1e13) return fail("Enter the contract sum in UGX");
  const status = await oneOf(fd, "status", SITE_STATUS_KEYS, "status");
  const startDate = day(fd, "startDate"), targetDate = day(fd, "targetDate");
  await db.buildSite.update({ where: { id: s.id }, data: { title, location, contractSum, status, startDate, targetDate } });
  if (status !== s.status) {
    await audit(u.id, "site.status", "build_site", s.id, status);
    const msg = status === "handed_over" ? `Congratulations — “${title}” has been handed over. Thank you for building with CasaVilla!`
      : status === "on_hold" ? `Work on “${title}” is on hold for now. CasaVilla will be in touch.`
      : status === "active" ? `Work on “${title}” is back under way.` : null;
    if (msg && s.clientId) await notify(s.clientId, msg, clientHref(s.id));
  }
  refresh();
}

/** Links (or changes) the client's account, by phone or email. */
export async function linkBuildClient(fd: FormData) {
  const u = await requireUser("manager");
  const s = await db.buildSite.findUnique({ where: { id: id(fd) } });
  if (!s) return fail("Project not found");
  const q = String(fd.get("who") ?? "").trim();
  if (!q) { await db.buildSite.update({ where: { id: s.id }, data: { clientId: null } }); refresh(); return; }
  const who = q.includes("@") ? await db.user.findFirst({ where: { email: { equals: q, mode: "insensitive" } } }) : await db.user.findFirst({ where: { phone: normalizePhone(q) } });
  if (!who) return fail("No CasaVilla account with that phone or email. Ask the client to sign up, then link them.");
  await db.buildSite.update({ where: { id: s.id }, data: { clientId: who.id } });
  await audit(u.id, "site.client", "build_site", s.id, `${who.name} (${who.id})`);
  await notify(who.id, `Your building project “${s.title}” is now in your CasaVilla account.`, clientHref(s.id));
  refresh();
}

export async function saveBuildStage(fd: FormData) {
  await requireUser("manager");
  const siteId = id(fd, "siteId");
  const site = await db.buildSite.findUnique({ where: { id: siteId }, select: { id: true } });
  if (!site) return fail("Project not found");
  const name = await reqText(fd, "name", "the stage name", { max: 80 });
  const amount = num(fd, "amount");
  if (amount == null || !Number.isFinite(amount) || amount < 0 || amount > 1e13) return fail("Enter the amount for this stage");
  const stageId = id(fd, "stageId");
  if (stageId) {
    const st = await db.buildStage.findFirst({ where: { id: stageId, siteId } });
    if (!st) return fail("Stage not found");
    const paid = (await db.buildPayment.aggregate({ where: { stageId, status: "success" }, _sum: { amount: true } }))._sum.amount ?? 0;
    if (amount < paid) return fail(`The client has already paid ${ugx(paid)} on this stage`);
    await db.buildStage.update({ where: { id: stageId }, data: { name, amount } });
  } else {
    const sort = await db.buildStage.count({ where: { siteId } });
    await db.buildStage.create({ data: { siteId, name, amount, sort } });
  }
  refresh();
}

export async function deleteBuildStage(fd: FormData) {
  await requireUser("manager");
  const st = await db.buildStage.findUnique({ where: { id: id(fd) }, include: { _count: { select: { payments: true } } } });
  if (!st) return fail("Stage not found");
  if (st._count.payments) return fail("Payments are recorded on this stage — change its amount instead");
  await db.buildStage.delete({ where: { id: st.id } });
  refresh();
}

/** Starts or finishes a stage; the client is told, and asked to pay what's now due. */
export async function setBuildStageStatus(fd: FormData) {
  const u = await requireUser("manager");
  const st = await db.buildStage.findUnique({ where: { id: id(fd) }, include: { site: true } });
  if (!st) return fail("Stage not found");
  const status = await oneOf(fd, "status", STAGE_STATUS_KEYS, "status");
  await db.buildStage.update({
    where: { id: st.id },
    data: { status, startedAt: status === "upcoming" ? null : st.startedAt ?? new Date(), doneAt: status === "done" ? st.doneAt ?? new Date() : null },
  });
  await audit(u.id, "stage.status", "build_stage", st.id, `${st.name}: ${status}`);
  if (st.site.clientId && status !== st.status && status !== "upcoming") {
    const paid = (await db.buildPayment.aggregate({ where: { stageId: st.id, status: "success" }, _sum: { amount: true } }))._sum.amount ?? 0;
    const owe = Math.max(0, st.amount - paid);
    await notify(st.site.clientId, `${status === "done" ? "Finished" : "Started"}: ${st.name} on ${st.site.title}.${owe > 0 ? ` ${ugx(owe)} is now due for this stage.` : ""}`, clientHref(st.siteId));
  }
  refresh();
}

/** A progress note from the site; photos are added right after. */
export async function postBuildUpdate(fd: FormData) {
  const u = await requireUser("manager");
  const site = await db.buildSite.findUnique({ where: { id: id(fd, "siteId") } });
  if (!site) return fail("Project not found");
  const note = await reqText(fd, "note", "what happened on site", { max: 2000 });
  const stageId = id(fd, "stageId") || null;
  if (stageId && !(await db.buildStage.count({ where: { id: stageId, siteId: site.id } }))) return fail("Stage not found");
  const up = await db.buildUpdate.create({ data: { siteId: site.id, stageId, authorId: u.id, note } });
  if (site.clientId) await notify(site.clientId, `New update on ${site.title}: ${note.slice(0, 120)}${note.length > 120 ? "…" : ""}`, clientHref(site.id));
  refresh();
  redirect(`${siteHref(site.id)}?update=${up.id}#update-${up.id}`);
}

export async function deleteBuildUpdate(fd: FormData) {
  await requireUser("manager");
  const up = await db.buildUpdate.findUnique({ where: { id: id(fd) } });
  if (!up) return fail("Update not found");
  await db.buildUpdate.delete({ where: { id: up.id } });
  refresh();
}

// Photos on an update (the shared photo uploader posts "update:12" as listingId)
const updateIdOf = (v: FormDataEntryValue | null) => { const m = /^update:(\d+)$/.exec(String(v ?? "")); return m ? Number(m[1]) : 0; };

export async function uploadUpdatePhoto(fd: FormData) {
  const u = await requireUser("manager");
  const up = await db.buildUpdate.findUnique({ where: { id: updateIdOf(fd.get("listingId")) } });
  if (!up) return { error: "Update not found" };
  const count = await db.buildUpdatePhoto.count({ where: { updateId: up.id } });
  if (count >= 20) return { error: "Up to 20 photos per update" };
  const fileId = await saveUpload(fd.get("photo"), u.id, false, true);
  if (!fileId) return { error: "Choose a photo" };
  await db.buildUpdatePhoto.create({ data: { updateId: up.id, fileId, sort: count, isCover: count === 0 } });
  revalidatePath(siteHref(up.siteId));
  return { ok: true, fileId };
}

export async function setUpdateCover(fd: FormData) {
  await requireUser("manager");
  const ph = await db.buildUpdatePhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await db.$transaction([
    db.buildUpdatePhoto.updateMany({ where: { updateId: ph.updateId }, data: { isCover: false } }),
    db.buildUpdatePhoto.update({ where: { id: ph.id }, data: { isCover: true } }),
  ]);
  refresh();
}

export async function deleteUpdatePhoto(fd: FormData) {
  await requireUser("manager");
  const ph = await db.buildUpdatePhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  await db.buildUpdatePhoto.delete({ where: { id: ph.id } });
  if (ph.isCover) {
    const next = await db.buildUpdatePhoto.findFirst({ where: { updateId: ph.updateId }, orderBy: { sort: "asc" } });
    if (next) await db.buildUpdatePhoto.update({ where: { id: next.id }, data: { isCover: true } });
  }
  refresh();
}

/** Cash, bank transfer or Mobile Money received outside the app, recorded by staff. */
export async function recordBuildPayment(fd: FormData) {
  const u = await requireUser("manager");
  const sum = await siteSummary(id(fd, "siteId"));
  if (!sum) return fail("Project not found");
  const amount = num(fd, "amount");
  if (amount == null || !Number.isFinite(amount) || amount <= 0 || amount > 1e13) return fail("Enter the amount received");
  const method = await oneOf(fd, "method", ["cash", "bank", "mtn", "airtel"] as const, "how it was paid");
  const stageId = id(fd, "stageId") || null;
  const stage = stageId ? sum.stages.find((s) => s.id === stageId) : null;
  if (stageId && !stage) return fail("Stage not found");
  if (stage && amount > stage.balance) return fail(`That's more than the ${ugx(stage.balance)} left on “${stage.name}”`);
  const ref = await text(fd, "reference", "the reference", { optional: true, max: 80 });
  const paidOn = day(fd, "paidOn");
  if (paidOn && paidOn.getTime() > Date.now() + 86400000) return fail("The payment date is in the future");
  const p = await db.buildPayment.create({
    data: { siteId: sum.site.id, stageId, payerId: sum.site.clientId, amount, method, reference: newBuildRef(), note: ref, recordedById: u.id },
  });
  await completeBuildPayment(p.id);
  if (paidOn) await db.buildPayment.update({ where: { id: p.id }, data: { paidAt: paidOn } });
  await audit(u.id, "build.payment", "build_payment", p.id, `${ugx(amount)} ${method}${paidOn ? ` on ${fmtDate(paidOn)}` : ""}`);
  refresh();
}
