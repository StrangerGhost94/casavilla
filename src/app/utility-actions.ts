"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/uploads";
import { workableProperty } from "@/lib/access";
import { addSharedBill, deleteReading, recordReading } from "@/lib/utilities";
import { date, id, int, oneOf, text } from "@/lib/validate";
import { kampalaToday } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

async function meterFor(fd: FormData, roles: ("landlord" | "manager" | "caretaker")[]) {
  const u = await requireUser(...roles);
  const m = await db.meter.findUnique({ where: { id: id(fd, "meterId") } });
  if (!m || !(await workableProperty(u, m.propertyId))) return fail("Meter not found");
  return { u, m };
}

export async function addMeter(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const p = await workableProperty(u, id(fd, "propertyId"));
  if (!p) return fail("Property not found");
  const kind = await oneOf(fd, "kind", ["electricity", "water"] as const, "meter type");
  const billing = await oneOf(fd, "billing", ["prepaid", "submeter", "shared"] as const, "how it's paid");
  const unitId = id(fd, "unitId") || null;
  if (unitId && !(await db.unit.findFirst({ where: { id: unitId, propertyId: p.id } }))) return fail("Choose a unit in this property");
  if (billing === "submeter" && !unitId) return fail("A sub-meter belongs to one unit — choose it");
  if (billing === "shared" && unitId) return fail("A shared meter serves several units — leave the unit empty");
  const rate = billing === "submeter" ? await int(fd, "rate", "the price per unit", { min: 1, max: 1_000_000 }) : null;
  const number = await text(fd, "number", "the meter number", { optional: true, max: 40 });
  const label = await text(fd, "label", "the name", { optional: true, max: 60 });
  const shareUnitIds = billing === "shared" ? fd.getAll("shareUnitId").map(Number).filter(Boolean) : [];
  const m = await db.meter.create({ data: { propertyId: p.id, unitId, kind, billing, rate, number: number || null, label: label || null, shareUnitIds } });
  await audit(u.id, "meter.added", "meter", m.id, `${kind} ${billing}${number ? ` ${number}` : ""}`);
  refresh();
}

export async function retireMeter(fd: FormData) {
  const { u, m } = await meterFor(fd, ["landlord", "manager"]);
  await db.meter.update({ where: { id: m.id }, data: { active: false } });
  await audit(u.id, "meter.retired", "meter", m.id);
  refresh();
}

export async function addReading(fd: FormData) {
  const { u, m } = await meterFor(fd, ["landlord", "manager", "caretaker"]);
  const raw = String(fd.get("reading") ?? "").replace(/,/g, "").trim();
  const reading = Number(raw);
  if (!raw || !Number.isFinite(reading) || reading < 0) return fail("Enter the number shown on the meter");
  const readOn = (await date(fd, "readOn", "the date", true)) || kampalaToday();
  if (readOn > kampalaToday()) return fail("The date can't be in the future");
  const photoFileId = await saveUpload(fd.get("photo"), u.id, false, true);
  const r = await recordReading(u, { meterId: m.id, reading, readOn, photoFileId, replaced: fd.get("replaced") === "on" });
  if ("error" in r && r.error) return fail(r.error);
  refresh();
}

export async function removeReading(fd: FormData) {
  const u = await requireUser("landlord", "manager");
  const r = await db.meterReading.findUnique({ where: { id: id(fd) }, include: { meter: true } });
  if (!r || !(await workableProperty(u, r.meter.propertyId))) return fail("Reading not found");
  const done = await deleteReading(u, r.id);
  if ("error" in done && done.error) return fail(done.error);
  refresh();
}

export async function addBill(fd: FormData) {
  const { u, m } = await meterFor(fd, ["landlord", "manager"]);
  const period = String(fd.get("period") || "");
  if (!/^\d{4}-\d{2}$/.test(period)) return fail("Choose the month the bill is for");
  const amount = await int(fd, "amount", "the bill amount", { min: 500, max: 100_000_000 });
  const note = await text(fd, "note", "the note", { optional: true, max: 200 });
  const r = await addSharedBill(u, { meterId: m.id, period, amount, note: note || null });
  if ("error" in r && r.error) return fail(r.error);
  refresh();
}
