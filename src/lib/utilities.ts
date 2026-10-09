import "server-only";
import { db, type User } from "@/db";
import { addCharge } from "./billing";
import { audit } from "./audit";
import { kampalaToday, ugx } from "./format";
import { notify } from "./notify";
import { appUrl, queueMessage } from "./messaging";

export const KIND_NAME: Record<string, string> = { electricity: "Electricity (Yaka)", water: "Water (NWSC)" };
export const UNIT_NAME: Record<string, string> = { electricity: "units", water: "m³" };
export const BILLING_NAME: Record<string, string> = {
  prepaid: "Tenant pays the utility directly",
  submeter: "Sub-meter — I bill the tenant from readings",
  shared: "Shared — I split the monthly bill",
};

/** Equal split in whole shillings; the first units take the leftover shillings so the parts add up exactly. */
export function splitEqually(total: number, parts: number) {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts), extra = total - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Charge for a sub-meter reading: (this − last) × rate, rounded to the shilling. */
export function readingCharge(prev: number, now: number, rate: number) {
  return Math.max(0, Math.round((now - prev) * rate));
}

async function tellTenant(tenantId: number, msg: string, dedupeKey: string) {
  await notify(tenantId, msg, "/tenant/rent");
  const t = await db.user.findUnique({ where: { id: tenantId }, select: { name: true } });
  const first = t?.name.split(" ")[0] ?? "there";
  await queueMessage({ userId: tenantId, kind: "notice", dedupeKey, params: [first, `${msg} ${appUrl("/tenant/rent")}`], text: `Hello ${first}, ${msg} ${appUrl("/tenant/rent")} — CasaVilla` });
}

/**
 * Records a reading. On a sub-meter with a tenant, the units used since the last reading are billed to the
 * lease straight away (and the tenant told). Readings can't go backwards unless the meter was replaced.
 */
export async function recordReading(u: User, o: { meterId: number; reading: number; readOn?: string; photoFileId?: number | null; replaced?: boolean }) {
  const m = await db.meter.findUniqueOrThrow({ where: { id: o.meterId }, include: { unit: { include: { leases: { where: { status: "active" } } } } } });
  const last = await db.meterReading.findFirst({ where: { meterId: m.id }, orderBy: [{ readOn: "desc" }, { id: "desc" }] });
  const readOn = o.readOn ?? kampalaToday();
  if (last && !o.replaced && o.reading < last.reading) return { error: `That's lower than the last reading (${last.reading}). If the meter was replaced, tick "New meter".` };
  if (last && readOn < last.readOn.toISOString().slice(0, 10)) return { error: "There's already a later reading for this meter" };
  const r = await db.meterReading.create({ data: { meterId: m.id, reading: o.reading, readOn: new Date(`${readOn}T00:00:00Z`), photoFileId: o.photoFileId ?? null, recordedById: u.id } });
  let charged = 0;
  const lease = m.unit?.leases[0];
  if (m.billing === "submeter" && m.rate && last && !o.replaced && lease) {
    const used = o.reading - last.reading;
    charged = readingCharge(last.reading, o.reading, m.rate);
    if (charged > 0) {
      const c = await addCharge({
        leaseId: lease.id, kind: "utility", amount: charged, dueDate: readOn, actorId: u.id,
        description: `${m.kind === "water" ? "Water" : "Electricity"}: ${last.reading} → ${o.reading} (${Math.round(used * 100) / 100} ${UNIT_NAME[m.kind]} × ${ugx(m.rate)})`,
      });
      await db.meterReading.update({ where: { id: r.id }, data: { chargeId: c.id } });
      await tellTenant(lease.tenantId, `Your ${m.kind === "water" ? "water" : "electricity"} bill is ${ugx(charged)} (${Math.round(used * 100) / 100} ${UNIT_NAME[m.kind]} used).`, `meter:${r.id}`);
    }
  }
  await audit(u.id, "meter.read", "meter", m.id, `${o.reading}${charged ? ` · billed ${ugx(charged)}` : ""}`);
  return { ok: true as const, charged };
}

/** Removes a reading; its bill is withdrawn too if nothing has been paid on it. */
export async function deleteReading(u: User, readingId: number) {
  const r = await db.meterReading.findUniqueOrThrow({ where: { id: readingId } });
  if (r.chargeId) {
    const c = await db.charge.findUnique({ where: { id: r.chargeId } });
    if (c && c.paid > 0) return { error: "The tenant has already paid part of this bill — waive it from their ledger instead" };
    if (c) await db.$transaction([db.meterReading.update({ where: { id: r.id }, data: { chargeId: null } }), db.charge.delete({ where: { id: c.id } })]);
  }
  await db.meterReading.delete({ where: { id: r.id } });
  await audit(u.id, "meter.reading_deleted", "meter", r.meterId, String(r.reading));
  return { ok: true as const };
}

/**
 * A shared meter's monthly bill, split equally between the units that share it and have a tenant. Each tenant
 * gets a "utility" charge. One bill per meter per month.
 */
export async function addSharedBill(u: User, o: { meterId: number; period: string; amount: number; note?: string | null }) {
  const m = await db.meter.findUniqueOrThrow({ where: { id: o.meterId } });
  if (m.billing !== "shared") return { error: "This meter isn't set up as shared" };
  if (await db.utilityBill.findUnique({ where: { meterId_period: { meterId: m.id, period: o.period } } })) return { error: "That month's bill was already added for this meter" };
  const leases = await db.lease.findMany({
    where: { status: "active", unit: { propertyId: m.propertyId, mode: "long", ...(m.shareUnitIds.length ? { id: { in: m.shareUnitIds } } : {}) } },
    orderBy: { unit: { label: "asc" } }, include: { unit: { select: { label: true } } },
  });
  if (!leases.length) return { error: "No tenants share this meter right now" };
  const parts = splitEqually(o.amount, leases.length);
  const bill = await db.utilityBill.create({ data: { meterId: m.id, period: o.period, amount: o.amount, note: o.note ?? null, splitCount: leases.length, createdById: u.id } });
  const what = m.kind === "water" ? "Water" : "Electricity";
  const monthName = new Date(`${o.period}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  for (let i = 0; i < leases.length; i++) {
    const l = leases[i];
    await addCharge({ leaseId: l.id, kind: "utility", amount: parts[i], dueDate: kampalaToday(), actorId: u.id, description: `${what} — ${monthName} (shared bill ${ugx(o.amount)} ÷ ${leases.length})` });
    await tellTenant(l.tenantId, `Your share of the ${what.toLowerCase()} bill for ${monthName} is ${ugx(parts[i])}.`, `ubill:${bill.id}:${l.id}`);
  }
  await audit(u.id, "meter.shared_bill", "meter", m.id, `${o.period}: ${ugx(o.amount)} ÷ ${leases.length}`);
  return { ok: true as const, split: leases.length };
}
