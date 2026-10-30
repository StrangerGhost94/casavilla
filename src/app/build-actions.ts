"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { getUser, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { notifyManagers } from "@/lib/notify";
import { saveUpload } from "@/lib/uploads";
import { normalizePhone } from "@/lib/format";
import { id, oneOf, reqText, text } from "@/lib/validate";
import { BUILD_KIND_KEYS, BUILD_KINDS, PLAN_STYLE_KEYS, PLOT, PROJECT_KINDS, REQUEST_STATUS, REQUEST_STATUS_KEYS, TIMELINE } from "@/lib/build";
import { shortUgx } from "@/lib/sales";

const refresh = () => revalidatePath("/", "layout");
const num = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").replace(/[,\s]/g, ""); return v === "" ? null : Number(v); };
const keys = <T extends object>(o: T) => Object.keys(o) as (keyof T & string)[];

export type BuildRequestState = { ok?: boolean; error?: string } | undefined;

/** Someone asks CasaVilla to design or build. Works without an account (name + phone), with simple flood limits. */
export async function sendBuildRequest(_: BuildRequestState, fd: FormData): Promise<BuildRequestState> {
  const me = await getUser();
  const kind = String(fd.get("kind") ?? "");
  if (!(BUILD_KIND_KEYS as string[]).includes(kind)) return { error: "Choose what you'd like to build." };
  const name = String(fd.get("name") || me?.name || "").trim().slice(0, 80);
  const phone = normalizePhone(String(fd.get("phone") || me?.phone || ""));
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^\+256\d{9}$/.test(phone) && !/^\+\d{9,15}$/.test(phone)) return { error: "Enter a phone number we can call, e.g. 0772 123 456." };
  const email = String(fd.get("email") || me?.email || "").trim().slice(0, 120) || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Check the email address, or leave it blank." };
  const location = String(fd.get("location") ?? "").trim().slice(0, 160) || null;
  const plotRaw = String(fd.get("plot") ?? "");
  const plot = keys(PLOT).includes(plotRaw as keyof typeof PLOT) ? plotRaw : null;
  const tl = String(fd.get("timeline") ?? "");
  const timeline = keys(TIMELINE).includes(tl as keyof typeof TIMELINE) ? tl : null;
  const budget = num(fd, "budget");
  if (budget != null && (!Number.isFinite(budget) || budget < 0 || budget > 1e13)) return { error: "Check the budget, or leave it blank." };
  const message = String(fd.get("message") ?? "").trim().slice(0, 2000) || null;
  const planId = id(fd, "planId") || null;
  const plan = planId ? await db.housePlan.findFirst({ where: { id: planId, published: true }, select: { id: true, title: true } }) : null;
  const listingId = id(fd, "saleListingId") || null;
  const listing = listingId ? await db.saleListing.findFirst({ where: { id: listingId, status: { in: ["active", "under_offer"] } }, select: { id: true, title: true, location: true } }) : null;

  const [recent, today] = await Promise.all([
    db.buildRequest.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 10 * 60000) } } }),
    db.buildRequest.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 86400000) } } }),
  ]);
  if (recent) return { error: "We already have your request — CasaVilla will call you shortly." };
  if (today >= 5) return { error: "You've sent several requests today. Please call CasaVilla instead." };

  const r = await db.buildRequest.create({
    data: {
      userId: me?.id ?? null, name, phone, email, kind, planId: plan?.id ?? null, saleListingId: listing?.id ?? null,
      location: location ?? listing?.location ?? null, plot: plot ?? (listing ? "buying" : null), budget, timeline, message,
    },
  });
  const what = plan ? `${BUILD_KINDS[kind as keyof typeof BUILD_KINDS].short} · plan “${plan.title}”` : listing ? `${BUILD_KINDS[kind as keyof typeof BUILD_KINDS].short} on “${listing.title}”` : BUILD_KINDS[kind as keyof typeof BUILD_KINDS].label;
  await notifyManagers(`New build request from ${name} (${phone}): ${what}${budget ? `, budget ${shortUgx(budget)}` : ""}.`, `/manager/build/${r.id}`);
  await audit(me?.id ?? null, "build.request", "build_request", r.id, `${name} ${phone}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------------------------
// CasaVilla staff: follow up requests

export async function updateBuildRequest(fd: FormData) {
  const u = await requireUser("manager");
  const r = await db.buildRequest.findUnique({ where: { id: id(fd) } });
  if (!r) return fail("Request not found");
  const status = await oneOf(fd, "status", REQUEST_STATUS_KEYS, "status");
  const quote = num(fd, "quote");
  if (quote != null && (!Number.isFinite(quote) || quote < 0 || quote > 1e13)) return fail("Check the quote amount");
  if (status === "quoted" && quote == null && r.quote == null) return fail("Enter the quote you sent");
  const staffNote = await text(fd, "staffNote", "the note", { optional: true, max: 3000 });
  await db.buildRequest.update({ where: { id: r.id }, data: { status, quote: quote ?? r.quote, staffNote } });
  if (status !== r.status) await audit(u.id, "build.status", "build_request", r.id, REQUEST_STATUS[status].label);
  refresh();
}

// ---------------------------------------------------------------------------------------------------------------
// House plans

export async function saveHousePlan(fd: FormData) {
  const u = await requireUser("manager");
  const existing = id(fd) ? await db.housePlan.findUnique({ where: { id: id(fd) } }) : null;
  if (id(fd) && !existing) return fail("Plan not found");
  const title = await reqText(fd, "title", "the plan's name", { max: 100 });
  const style = await oneOf(fd, "style", PLAN_STYLE_KEYS, "the type of building");
  const whole = (k: string, label: string, max: number) => {
    const n = num(fd, k);
    if (n == null) return null;
    if (!Number.isInteger(n) || n < 0 || n > max) return fail(`Check ${label}`);
    return n;
  };
  const bedrooms = await whole("bedrooms", "the bedrooms", 200);
  const bathrooms = await whole("bathrooms", "the bathrooms", 200);
  const floors = (await whole("floors", "the floors", 60)) || 1;
  const areaSqm = await whole("areaSqm", "the floor area", 1_000_000);
  const price = num(fd, "price");
  if (price == null || !Number.isInteger(price) || price < 0 || price > 2_000_000_000) return fail("Enter the price of the plan in UGX (0 if it's free with a build)");
  const buildFrom = num(fd, "buildFrom"), buildTo = num(fd, "buildTo");
  for (const v of [buildFrom, buildTo]) if (v != null && (!Number.isFinite(v) || v <= 0 || v > 1e13)) return fail("Check the estimated build cost");
  if (buildFrom != null && buildTo != null && buildTo < buildFrom) return fail("The top of the build cost range is below the bottom");
  const plotSize = await text(fd, "plotSize", "the plot size", { optional: true, max: 40 });
  const summary = await text(fd, "summary", "the short description", { optional: true, max: 200 });
  const description = await text(fd, "description", "the description", { optional: true, max: 5000 });
  const features = String(fd.get("features") ?? "").split(/\n|,/).map((s) => s.trim()).filter(Boolean).slice(0, 20).map((s) => s.slice(0, 60));
  const data = { title, style, bedrooms, bathrooms, floors, areaSqm, price, buildFrom, buildTo, plotSize, summary, description, features };
  const p = existing ? await db.housePlan.update({ where: { id: existing.id }, data }) : await db.housePlan.create({ data });
  await audit(u.id, existing ? "plan.updated" : "plan.created", "house_plan", p.id, title);
  refresh();
  redirect(`/manager/build/plans/${p.id}${existing ? "" : "?fresh=1"}`);
}

export async function setPlanPublished(fd: FormData) {
  const u = await requireUser("manager");
  const p = await db.housePlan.findUnique({ where: { id: id(fd) }, include: { _count: { select: { photos: true } } } });
  if (!p) return fail("Plan not found");
  const on = fd.get("on") === "1";
  if (on && !p._count.photos) return fail("Add at least one drawing or picture before publishing");
  await db.housePlan.update({ where: { id: p.id }, data: { published: on } });
  await audit(u.id, on ? "plan.published" : "plan.hidden", "house_plan", p.id, p.title);
  refresh();
}

export async function deleteHousePlan(fd: FormData) {
  const u = await requireUser("manager");
  const p = await db.housePlan.findUnique({ where: { id: id(fd) } });
  if (!p) return fail("Plan not found");
  await db.housePlan.delete({ where: { id: p.id } });
  await audit(u.id, "plan.deleted", "house_plan", p.id, p.title);
  refresh();
  redirect("/manager/build/plans");
}

// ---------------------------------------------------------------------------------------------------------------
// Past projects (the gallery on the Build page)

export async function saveBuildProject(fd: FormData) {
  const u = await requireUser("manager");
  const existing = id(fd) ? await db.buildProject.findUnique({ where: { id: id(fd) } }) : null;
  if (id(fd) && !existing) return fail("Project not found");
  const title = await reqText(fd, "title", "the project's name", { max: 100 });
  const kind = await oneOf(fd, "kind", keys(PROJECT_KINDS), "the type of project");
  const location = await reqText(fd, "location", "where it is", { max: 120 });
  const year = num(fd, "year");
  if (year != null && (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1)) return fail("Check the year");
  const summary = await text(fd, "summary", "the description", { optional: true, max: 600 });
  const data = { title, kind, location, year, summary };
  const p = existing ? await db.buildProject.update({ where: { id: existing.id }, data }) : await db.buildProject.create({ data });
  await audit(u.id, existing ? "project.updated" : "project.created", "build_project", p.id, title);
  refresh();
  redirect(`/manager/build/projects/${p.id}${existing ? "" : "?fresh=1"}`);
}

export async function setProjectPublished(fd: FormData) {
  await requireUser("manager");
  const p = await db.buildProject.findUnique({ where: { id: id(fd) }, include: { _count: { select: { photos: true } } } });
  if (!p) return fail("Project not found");
  const on = fd.get("on") === "1";
  if (on && !p._count.photos) return fail("Add at least one photo before showing it");
  await db.buildProject.update({ where: { id: p.id }, data: { published: on } });
  refresh();
}

export async function deleteBuildProject(fd: FormData) {
  const u = await requireUser("manager");
  const p = await db.buildProject.findUnique({ where: { id: id(fd) } });
  if (!p) return fail("Project not found");
  await db.buildProject.delete({ where: { id: p.id } });
  await audit(u.id, "project.deleted", "build_project", p.id, p.title);
  refresh();
  redirect("/manager/build/projects");
}

// ---------------------------------------------------------------------------------------------------------------
// Photos of plans and projects (the first one is the cover)

/** Which plan or project a photo belongs to, from "plan:3" / "project:5". */
function target(v: FormDataEntryValue | null) {
  const m = /^(plan|project):(\d+)$/.exec(String(v ?? ""));
  return m ? { kind: m[1] as "plan" | "project", id: Number(m[2]) } : null;
}
const coverOf = (t: { kind: "plan" | "project"; id: number }, photoId: number | null) =>
  t.kind === "plan" ? db.housePlan.update({ where: { id: t.id }, data: { photoId } }) : db.buildProject.update({ where: { id: t.id }, data: { photoId } });
const owner = (t: { kind: "plan" | "project"; id: number }) => (t.kind === "plan" ? { planId: t.id } : { projectId: t.id });

export async function uploadBuildPhoto(fd: FormData) {
  const u = await requireUser("manager");
  const t = target(fd.get("listingId"));
  if (!t) return { error: "Photo target missing" };
  const exists = t.kind === "plan" ? await db.housePlan.count({ where: { id: t.id } }) : await db.buildProject.count({ where: { id: t.id } });
  if (!exists) return { error: "Not found" };
  const count = await db.buildPhoto.count({ where: owner(t) });
  if (count >= 20) return { error: "Up to 20 pictures each" };
  const fileId = await saveUpload(fd.get("photo"), u.id, true, true);
  if (!fileId) return { error: "Choose a picture" };
  const cover = count === 0;
  await db.$transaction([
    db.buildPhoto.create({ data: { ...owner(t), fileId, sort: count, isCover: cover } }),
    ...(cover ? [coverOf(t, fileId)] : []),
  ]);
  revalidatePath(`/manager/build/${t.kind}s/${t.id}`);
  return { ok: true, fileId };
}

export async function setBuildCover(fd: FormData) {
  await requireUser("manager");
  const ph = await db.buildPhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  const t = ph.planId ? { kind: "plan" as const, id: ph.planId } : { kind: "project" as const, id: ph.projectId! };
  await db.$transaction([
    db.buildPhoto.updateMany({ where: owner(t), data: { isCover: false } }),
    db.buildPhoto.update({ where: { id: ph.id }, data: { isCover: true } }),
    coverOf(t, ph.fileId),
  ]);
  refresh();
}

export async function deleteBuildPhoto(fd: FormData) {
  await requireUser("manager");
  const ph = await db.buildPhoto.findUnique({ where: { id: id(fd) } });
  if (!ph) return fail("Photo not found");
  const t = ph.planId ? { kind: "plan" as const, id: ph.planId } : { kind: "project" as const, id: ph.projectId! };
  await db.buildPhoto.delete({ where: { id: ph.id } });
  if (ph.isCover) {
    const next = await db.buildPhoto.findFirst({ where: owner(t), orderBy: { sort: "asc" } });
    if (next) await db.buildPhoto.update({ where: { id: next.id }, data: { isCover: true } });
    await coverOf(t, next?.fileId ?? null);
  }
  refresh();
}
