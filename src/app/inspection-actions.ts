"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type User } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { saveUpload } from "@/lib/uploads";
import { workableUnit } from "@/lib/access";
import { CONDITIONS, answerInspection, reopenInspection, startInspection, submitInspection } from "@/lib/inspections";
import { id, oneOf, text } from "@/lib/validate";
import { kampalaToday } from "@/lib/format";

const staff = () => requireUser("landlord", "manager", "caretaker");

async function editable(u: User, inspectionId: number) {
  const ins = await db.inspection.findUnique({ where: { id: inspectionId } });
  if (!ins || !(await workableUnit(u, ins.unitId))) return null;
  return ins;
}

/** Start (or open the existing) move-in / move-out / routine report and go to it. */
export async function startInspectionAction(fd: FormData) {
  const u = await staff();
  const kind = await oneOf(fd, "kind", ["move_in", "move_out", "routine"] as const, "inspection type");
  const leaseId = id(fd, "leaseId") || null;
  let unitId = id(fd, "unitId");
  if (leaseId) {
    const l = await db.lease.findUnique({ where: { id: leaseId } });
    if (!l) return fail("Lease not found");
    unitId = l.unitId;
  }
  if (!unitId || !(await workableUnit(u, unitId))) return fail("Unit not found");
  if (kind !== "routine" && !leaseId) return fail("Move-in and move-out reports belong to a tenancy");
  const ins = await startInspection(u, { unitId, leaseId, kind });
  redirect(`/${u.role}/inspections/${ins.id}`);
}

/** Autosave for one checklist line. Returns an error message instead of redirecting (called from the editor). */
export async function saveInspectionItem(itemId: number, patch: { condition?: string; note?: string; deduction?: number }) {
  const u = await staff();
  const item = await db.inspectionItem.findUnique({ where: { id: itemId }, include: { inspection: true } });
  if (!item || !(await editable(u, item.inspectionId))) return { error: "Not found" };
  if (item.inspection.status !== "draft") return { error: "This report has been submitted — reopen it to make changes" };
  const data: { condition?: string; note?: string | null; deduction?: number } = {};
  if (patch.condition !== undefined) {
    if (!(CONDITIONS as readonly string[]).includes(patch.condition)) return { error: "Unknown condition" };
    data.condition = patch.condition;
  }
  if (patch.note !== undefined) data.note = patch.note.trim().slice(0, 500) || null;
  if (patch.deduction !== undefined) {
    if (item.inspection.kind !== "move_out") return { error: "Deductions are only for move-out reports" };
    const d = Math.round(Number(patch.deduction) || 0);
    if (d < 0 || d > 50_000_000) return { error: "Enter a deduction between 0 and 50,000,000" };
    data.deduction = d;
  }
  await db.inspectionItem.update({ where: { id: itemId }, data });
  return { ok: true };
}

export async function addInspectionPhoto(fd: FormData) {
  const u = await staff();
  const item = await db.inspectionItem.findUnique({ where: { id: id(fd, "itemId") }, include: { inspection: true } });
  if (!item || !(await editable(u, item.inspectionId))) return { error: "Not found" };
  if (item.inspection.status !== "draft") return { error: "Reopen the report to add photos" };
  if (item.photoIds.length >= 6) return { error: "Up to 6 photos per item" };
  const fileId = await saveUpload(fd.get("photo"), u.id, false, true);
  if (!fileId) return { error: "Choose a photo" };
  await db.inspectionItem.update({ where: { id: item.id }, data: { photoIds: { push: fileId } } });
  return { ok: true, fileId };
}

export async function removeInspectionPhoto(itemId: number, fileId: number) {
  const u = await staff();
  const item = await db.inspectionItem.findUnique({ where: { id: itemId }, include: { inspection: true } });
  if (!item || !(await editable(u, item.inspectionId)) || item.inspection.status !== "draft") return { error: "Not found" };
  await db.inspectionItem.update({ where: { id: itemId }, data: { photoIds: item.photoIds.filter((x) => x !== fileId) } });
  return { ok: true };
}

/** An extra line the checklist didn't have (e.g. "Water tank", "Fridge"). */
export async function addInspectionItem(fd: FormData) {
  const u = await staff();
  const ins = await editable(u, id(fd, "inspectionId"));
  if (!ins || ins.status !== "draft") return fail("Reopen the report to add items");
  const area = (await text(fd, "area", "the room", { max: 60 })) || "Other";
  const item = await text(fd, "item", "the item", { max: 80 });
  if (!item) return fail("Name the item, e.g. Fridge");
  const last = await db.inspectionItem.aggregate({ _max: { sort: true }, where: { inspectionId: ins.id } });
  await db.inspectionItem.create({ data: { inspectionId: ins.id, area, item, sort: (last._max.sort ?? 0) + 1 } });
  revalidatePath(`/${u.role}/inspections/${ins.id}`);
}

/** Keys, notes and meter readings for the report. */
export async function saveInspectionHeader(fd: FormData) {
  const u = await staff();
  const ins = await editable(u, id(fd));
  if (!ins || ins.status !== "draft") return fail("Reopen the report to change it");
  const keysRaw = String(fd.get("keys") ?? "").trim();
  const keys = keysRaw === "" ? null : Math.max(0, Math.min(99, Math.round(Number(keysRaw) || 0)));
  const notes = await text(fd, "notes", "the notes", { optional: true, max: 3000 });
  await db.inspection.update({ where: { id: ins.id }, data: { keys, notes: notes || null } });
  // Meter readings taken during the inspection (one per meter, replaced if entered again).
  const meters = await db.meter.findMany({ where: { active: true, OR: [{ unitId: ins.unitId }, { unitId: null, property: { units: { some: { id: ins.unitId } } } }] } });
  for (const m of meters) {
    const raw = String(fd.get(`meter_${m.id}`) ?? "").trim();
    if (raw === "") continue;
    const reading = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(reading) || reading < 0) return fail(`Check the reading for meter ${m.number ?? m.id}`);
    await db.meterReading.deleteMany({ where: { inspectionId: ins.id, meterId: m.id } });
    await db.meterReading.create({ data: { meterId: m.id, reading, readOn: new Date(`${kampalaToday()}T00:00:00Z`), recordedById: u.id, inspectionId: ins.id } });
  }
  revalidatePath(`/${u.role}/inspections/${ins.id}`);
}

export async function submitInspectionAction(fd: FormData) {
  const u = await staff();
  const ins = await editable(u, id(fd));
  if (!ins) return fail("Not found");
  await submitInspection(u, ins.id);
  revalidatePath("/", "layout");
}

export async function reopenInspectionAction(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const ins = await editable(u, id(fd));
  if (!ins) return fail("Not found");
  const r = await reopenInspection(u, ins.id);
  if (!r.ok) return fail(r.error);
  revalidatePath("/", "layout");
}

export async function answerInspectionAction(fd: FormData) {
  const u = await requireUser("tenant");
  const answer = fd.get("answer");
  if (answer !== "agree" && answer !== "dispute") return fail("Choose agree or raise a concern");
  const agree = answer === "agree";
  const comment = await text(fd, "comment", "your comment", { optional: true, max: 1000 });
  if (!agree && !comment) return fail("Tell your landlord what you disagree with");
  const r = await answerInspection(u.id, id(fd), agree, comment || null);
  if (!r) return fail("This report can't be answered now");
  revalidatePath("/", "layout");
}
