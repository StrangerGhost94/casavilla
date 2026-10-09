import "server-only";
import { db, type User } from "@/db";
import { addCharge } from "./billing";
import { audit } from "./audit";
import { kampalaToday, ugx, fmtDate } from "./format";
import { notify, notifyManagers } from "./notify";
import { appUrl, queueMessage } from "./messaging";
import { PdfWriter, embedLogo, safe } from "./pdf";
import { brandFor } from "./brand";

export const CONDITIONS = ["good", "fair", "poor", "damaged", "missing", "na"] as const;
export type Condition = (typeof CONDITIONS)[number];
export const CONDITION_LABEL: Record<Condition, string> = { good: "Good", fair: "Fair", poor: "Poor", damaged: "Damaged", missing: "Missing", na: "N/A" };
export const KIND_LABEL: Record<string, string> = { move_in: "Move-in", move_out: "Move-out", routine: "Routine check" };
/** Worse = higher, for spotting what changed between move-in and move-out. */
export const conditionRank: Record<string, number> = { na: -1, good: 0, fair: 1, poor: 2, damaged: 3, missing: 4 };

const ITEMS: Record<string, string[]> = {
  outside: ["Gate & door", "Locks & keys", "Compound / parking", "Outside lights"],
  living: ["Walls & paint", "Floor", "Ceiling", "Windows & burglar-proofing", "Doors & locks", "Lights & sockets", "Curtain rails"],
  kitchen: ["Walls & paint", "Floor", "Sink & taps", "Cupboards & shelves", "Cooker / gas point", "Lights & sockets", "Windows"],
  bedroom: ["Walls & paint", "Floor", "Ceiling", "Windows & burglar-proofing", "Door & lock", "Wardrobe", "Lights & sockets"],
  bathroom: ["Toilet & cistern", "Shower / bath", "Sink & taps", "Tiles", "Water heater", "Door & lock", "Drainage"],
  space: ["Walls & paint", "Floor", "Ceiling", "Shutters / doors & locks", "Windows", "Lights & sockets"],
};

/** Room-by-room checklist from the unit's bedrooms and bathrooms (commercial units get one main space). */
export function checklistFor(u: { bedrooms: number; bathrooms: number }) {
  const out: { area: string; item: string }[] = [];
  const add = (area: string, key: string) => ITEMS[key].forEach((item) => out.push({ area, item }));
  add("Entrance & outside", "outside");
  if (u.bedrooms === 0) add("Main space", "space");
  else { add("Sitting room", "living"); add("Kitchen", "kitchen"); }
  for (let b = 1; b <= u.bedrooms; b++) add(u.bedrooms > 1 ? `Bedroom ${b}` : "Bedroom", "bedroom");
  for (let b = 1; b <= u.bathrooms; b++) add(u.bathrooms > 1 ? `Bathroom ${b}` : "Bathroom", "bathroom");
  return out;
}

/**
 * Starts an inspection. A move-out report copies the move-in report's rooms and items so the two line up
 * item by item; otherwise the checklist comes from the unit.
 */
export async function startInspection(u: User, o: { unitId: number; leaseId: number | null; kind: "move_in" | "move_out" | "routine" }) {
  const unit = await db.unit.findUniqueOrThrow({ where: { id: o.unitId } });
  if (o.leaseId && o.kind !== "routine") {
    const existing = await db.inspection.findFirst({ where: { leaseId: o.leaseId, kind: o.kind } });
    if (existing) return existing;
  }
  const base = o.kind === "move_out" && o.leaseId
    ? await db.inspection.findFirst({ where: { leaseId: o.leaseId, kind: "move_in" }, include: { items: { orderBy: { sort: "asc" } } } })
    : null;
  const items = base?.items.length ? base.items.map((i) => ({ area: i.area, item: i.item })) : checklistFor(unit);
  const ins = await db.inspection.create({
    data: {
      unitId: unit.id, leaseId: o.leaseId, kind: o.kind, conductedById: u.id, conductedOn: new Date(`${kampalaToday()}T00:00:00Z`),
      items: { create: items.map((x, i) => ({ ...x, sort: i })) },
    },
  });
  await audit(u.id, "inspection.started", "inspection", ins.id, `${KIND_LABEL[o.kind]} · ${unit.label}`);
  return ins;
}

export async function inspectionFull(id: number) {
  return db.inspection.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sort: "asc" } },
      unit: { include: { property: true, meters: { where: { active: true } } } },
      lease: { include: { tenant: { select: { id: true, name: true, phone: true } } } },
      conductedBy: { select: { name: true, role: true } },
      readings: { include: { meter: true } },
    },
  });
}
export type FullInspection = NonNullable<Awaited<ReturnType<typeof inspectionFull>>>;

/** The move-in report to compare a move-out against, keyed by "area|item". */
export async function moveInBaseline(leaseId: number | null) {
  if (!leaseId) return new Map<string, { condition: string; note: string | null; photoIds: number[] }>();
  const base = await db.inspection.findFirst({ where: { leaseId, kind: "move_in" }, include: { items: true } });
  return new Map((base?.items ?? []).map((i) => [`${i.area}|${i.item}`, { condition: i.condition, note: i.note, photoIds: i.photoIds }]));
}

/**
 * Hands the report to the tenant. On a move-out, the deductions become one "damage" charge on the lease, so the
 * deposit settlement includes them; on a lease that already ended, the final settlement is adjusted instead.
 */
export async function submitInspection(u: User, id: number) {
  const ins = await db.inspection.findUniqueOrThrow({ where: { id }, include: { items: true, unit: { include: { property: true } }, lease: true } });
  if (ins.status !== "draft") return ins;
  const deductions = ins.kind === "move_out" ? ins.items.reduce((s, i) => s + i.deduction, 0) : 0;
  let chargeId: number | null = null;
  if (deductions > 0 && ins.lease) {
    const c = await addCharge({ leaseId: ins.lease.id, kind: "repair", description: `Damage found at move-out (inspection #${ins.id})`, amount: deductions, dueDate: kampalaToday(), actorId: u.id });
    chargeId = c.id;
    if (ins.lease.status === "ended") await db.lease.update({ where: { id: ins.lease.id }, data: { settlement: (ins.lease.settlement ?? 0) - deductions } });
  }
  const done = await db.inspection.update({ where: { id }, data: { status: ins.lease ? "submitted" : "agreed", submittedAt: new Date(), deductions, chargeId } });
  await audit(u.id, "inspection.submitted", "inspection", id, `${KIND_LABEL[ins.kind]} · ${ins.unit.label}${deductions ? ` · deductions ${ugx(deductions)}` : ""}`);
  if (ins.lease) {
    const where = `${ins.unit.property.name} · ${ins.unit.label}`;
    const msg = `Your ${KIND_LABEL[ins.kind].toLowerCase()} inspection report for ${where} is ready${deductions ? ` (deductions: ${ugx(deductions)})` : ""}. Please check it and agree or raise a concern.`;
    await notify(ins.lease.tenantId, msg, `/tenant/inspections/${id}`);
    const t = await db.user.findUnique({ where: { id: ins.lease.tenantId }, select: { name: true } });
    const first = t?.name.split(" ")[0] ?? "there";
    await queueMessage({ userId: ins.lease.tenantId, kind: "notice", dedupeKey: `inspection:${id}`, params: [first, `${msg} ${appUrl(`/tenant/inspections/${id}`)}`], text: `Hello ${first}, ${msg} ${appUrl(`/tenant/inspections/${id}`)} — CasaVilla` });
  }
  return done;
}

/** Back to draft for corrections. An unpaid damage charge is withdrawn (and re-raised on the next submit). */
export async function reopenInspection(u: User, id: number) {
  const ins = await db.inspection.findUniqueOrThrow({ where: { id }, include: { lease: true } });
  if (ins.status === "draft") return { ok: true as const };
  if (ins.chargeId) {
    const c = await db.charge.findUnique({ where: { id: ins.chargeId } });
    if (c && c.paid > 0) return { ok: false as const, error: "Part of the damage charge has already been paid — adjust it from the tenant's ledger instead" };
    if (c) {
      await db.$transaction([db.inspection.update({ where: { id }, data: { chargeId: null } }), db.charge.delete({ where: { id: c.id } })]);
      if (ins.lease?.status === "ended") await db.lease.update({ where: { id: ins.lease.id }, data: { settlement: (ins.lease.settlement ?? 0) + c.amount } });
    }
  }
  await db.inspection.update({ where: { id }, data: { status: "draft", submittedAt: null, tenantAnsweredAt: null, tenantComment: null, deductions: 0 } });
  await audit(u.id, "inspection.reopened", "inspection", id);
  return { ok: true as const };
}

/** The tenant agrees, or disputes with a reason (which goes to the landlord and CasaVilla). */
export async function answerInspection(tenantId: number, id: number, agree: boolean, comment: string | null) {
  const ins = await db.inspection.findUnique({ where: { id }, include: { lease: true, unit: { include: { property: true } } } });
  if (!ins || ins.lease?.tenantId !== tenantId || !["submitted", "disputed"].includes(ins.status)) return null;
  const done = await db.inspection.update({ where: { id }, data: { status: agree ? "agreed" : "disputed", tenantAnsweredAt: new Date(), tenantComment: comment } });
  const where = `${ins.unit.property.name} · ${ins.unit.label}`;
  const t = await db.user.findUnique({ where: { id: tenantId }, select: { name: true } });
  if (agree) await notify(ins.lease!.landlordId, `${t?.name} agreed with the ${KIND_LABEL[ins.kind].toLowerCase()} inspection for ${where}.`, `/landlord/inspections/${id}`);
  else {
    const msg = `${t?.name} disputes the ${KIND_LABEL[ins.kind].toLowerCase()} inspection for ${where}: “${(comment ?? "").slice(0, 140)}”`;
    await notify(ins.lease!.landlordId, msg, `/landlord/inspections/${id}`);
    await notifyManagers(msg, `/manager/inspections/${id}`);
  }
  await audit(tenantId, agree ? "inspection.agreed" : "inspection.disputed", "inspection", id, comment ?? undefined);
  return done;
}

/** A4 report: every room and item, the move-in condition next to the move-out one, photos listed, signatures. */
export async function inspectionPdf(ins: FullInspection) {
  const brand = await brandFor(ins.unit.property.landlordId);
  const w = await PdfWriter.create({ accent: brand.accentColor, title: `${KIND_LABEL[ins.kind]} inspection — ${ins.unit.label}`, author: brand.displayName, footer: `${brand.displayName} · Inspection #${ins.id}` });
  const logo = await embedLogo(w, brand.logoFileId);
  if (logo) { w.image(logo, 120, 46); w.gap(54); }
  w.text(`${KIND_LABEL[ins.kind]} inspection report`, { size: 18, bold: true, color: w.accent });
  w.text(`${ins.unit.property.name} · ${ins.unit.label} · ${ins.unit.property.location}`, { size: 10 });
  w.gap(6);
  w.facts([
    ["Date", fmtDate(ins.conductedOn)], ["Inspected by", ins.conductedBy.name],
    ["Tenant", ins.lease?.tenant.name ?? "—"], ["Status", ins.status === "agreed" ? "Agreed by tenant" : ins.status === "disputed" ? "Disputed by tenant" : ins.status === "submitted" ? "Waiting for tenant" : "Draft"],
    ["Keys handed over", ins.keys != null ? String(ins.keys) : "—"], ["Deductions", ins.kind === "move_out" ? ugx(ins.deductions) : "—"],
  ]);
  if (ins.readings.length) {
    w.heading("Meter readings");
    w.table(["Meter", "Reading"], ins.readings.map((r) => [`${r.meter.kind === "water" ? "Water" : "Electricity"}${r.meter.number ? ` · ${r.meter.number}` : ""}`, String(r.reading)]));
  }
  const base = ins.kind === "move_out" ? await moveInBaseline(ins.leaseId) : new Map();
  const areas = [...new Set(ins.items.map((i) => i.area))];
  for (const a of areas) {
    w.heading(a, 11);
    const rows = ins.items.filter((i) => i.area === a).map((i) => {
      const was = base.get(`${i.area}|${i.item}`);
      const cond = `${CONDITION_LABEL[i.condition as Condition] ?? i.condition}${was ? ` (was ${CONDITION_LABEL[was.condition as Condition] ?? was.condition})` : ""}`;
      return [`${i.item}${i.note ? ` — ${i.note}` : ""}${i.photoIds.length ? ` [${i.photoIds.length} photo${i.photoIds.length > 1 ? "s" : ""}]` : ""}`, cond, ...(ins.kind === "move_out" ? [i.deduction ? ugx(i.deduction) : ""] : [])];
    });
    w.table(ins.kind === "move_out" ? ["Item", "Condition", "Deduction"] : ["Item", "Condition"], rows, { widths: ins.kind === "move_out" ? [270, 140, 89] : [330, 169] });
  }
  if (ins.notes) { w.heading("Notes"); w.text(ins.notes); }
  if (ins.tenantComment) { w.heading(ins.status === "disputed" ? "Tenant's concern" : "Tenant's comment"); w.text(ins.tenantComment); }
  w.gap(10);
  w.text(safe("Photos are kept in CasaVilla with this report and can be viewed by the landlord, the tenant and CasaVilla."), { size: 8, italic: true });
  w.signature([{ label: "Landlord / agent", name: ins.conductedBy.name }, { label: "Tenant", name: ins.lease?.tenant.name }]);
  return w.bytes();
}
