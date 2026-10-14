import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { kampalaToday } from "./format";
import { daysBetween } from "./billing";

/** A reporting period: [from, to) as YYYY-MM-DD dates in Kampala time. */
export type Period = { from: string; to: string; label: string; preset: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymdOf = (y: number, m: number, d = 1) => { const dt = new Date(Date.UTC(y, m - 1, d)); return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; };
const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const PRESETS = [
  ["this-month", "This month"], ["last-month", "Last month"], ["this-quarter", "This quarter"], ["last-quarter", "Last quarter"],
  ["this-year", "This year (Jan–Dec)"], ["last-year", "Last year"], ["tax-year", "This tax year (Jul–Jun)"], ["last-tax-year", "Last tax year"], ["custom", "Custom dates"],
] as const;

/** Turns ?period=…&from=…&to=… into concrete dates. Custom ranges are inclusive of the "to" day. */
export function periodFrom(q: { period?: string; from?: string; to?: string }): Period {
  const t = kampalaToday();
  const [y, m] = t.split("-").map(Number);
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  const tyStart = m >= 7 ? y : y - 1;
  const preset = q.period ?? "this-month";
  const ok = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  switch (preset) {
    case "last-month": { const from = ymdOf(y, m - 1); return { from, to: ymdOf(y, m), label: monthName(from.slice(0, 7)), preset }; }
    case "this-quarter": return { from: ymdOf(y, qStart), to: ymdOf(y, qStart + 3), label: `Q${(qStart + 2) / 3} ${y}`, preset };
    case "last-quarter": { const from = ymdOf(y, qStart - 3); const fy = Number(from.slice(0, 4)), fm = Number(from.slice(5, 7)); return { from, to: ymdOf(y, qStart), label: `Q${(fm + 2) / 3} ${fy}`, preset }; }
    case "this-year": return { from: ymdOf(y, 1), to: ymdOf(y + 1, 1), label: String(y), preset };
    case "last-year": return { from: ymdOf(y - 1, 1), to: ymdOf(y, 1), label: String(y - 1), preset };
    case "tax-year": return { from: ymdOf(tyStart, 7), to: ymdOf(tyStart + 1, 7), label: `Tax year July ${tyStart} – June ${tyStart + 1}`, preset };
    case "last-tax-year": return { from: ymdOf(tyStart - 1, 7), to: ymdOf(tyStart, 7), label: `Tax year July ${tyStart - 1} – June ${tyStart}`, preset };
    case "custom": {
      if (ok(q.from) && ok(q.to) && q.from! <= q.to!) {
        const end = new Date(Date.parse(`${q.to}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
        return { from: q.from!, to: end, label: `${fmt(q.from!)} – ${fmt(q.to!)}`, preset };
      }
      return { from: ymdOf(y, m), to: ymdOf(y, m + 1), label: monthName(t.slice(0, 7)), preset: "this-month" };
    }
    default: return { from: ymdOf(y, m), to: ymdOf(y, m + 1), label: monthName(t.slice(0, 7)), preset: "this-month" };
  }
}

const KIND: Record<string, string> = { rent: "Rent", late_fee: "Late fees", utility: "Utility bills", repair: "Damage / repairs recharged", other: "Other charges", deposit: "Deposits (held for tenants)", credit: "Paid in advance (credit)", short_stay: "Short stays" };
export const METHOD: Record<string, string> = { mtn: "MTN Mobile Money", airtel: "Airtel Money", cash: "Cash", bank: "Bank", stay: "Short-stay bookings" };

type Scope = { landlordId?: number; propertyId?: number };

/**
 * Financial report for the whole portfolio (or one landlord / one property) over a period: what was billed and
 * collected, by what and how it was paid, expenses and CasaVilla's commission, net to landlords, arrears by age,
 * occupancy, deposits held — plus every payment and expense line for the spreadsheet.
 */
export async function financialReport(period: Period, scope: Scope = {}) {
  const start = new Date(`${period.from}T00:00:00+03:00`), end = new Date(`${period.to}T00:00:00+03:00`);
  const dFrom = new Date(`${period.from}T00:00:00Z`), dTo = new Date(`${period.to}T00:00:00Z`);
  const propWhere: Prisma.PropertyWhereInput = { ...(scope.landlordId ? { landlordId: scope.landlordId } : {}), ...(scope.propertyId ? { id: scope.propertyId } : {}) };
  const leaseWhere: Prisma.LeaseWhereInput = { unit: { property: propWhere } };

  const [properties, payments, bookings, expenses, billedCharges, openCharges, depositCharges, landlords] = await Promise.all([
    db.property.findMany({
      where: { ...propWhere, OR: [{ archivedAt: null }, { archivedAt: { gte: start } }] }, orderBy: { name: "asc" },
      select: { id: true, name: true, location: true, landlordId: true, landlord: { select: { name: true } }, units: { select: { id: true, status: true, mode: true } } },
    }),
    db.payment.findMany({
      where: { status: "success", paidAt: { gte: start, lt: end }, lease: leaseWhere },
      orderBy: { paidAt: "asc" },
      select: {
        id: true, amount: true, method: true, reference: true, receiptNo: true, paidAt: true,
        tenant: { select: { name: true } }, recordedBy: { select: { name: true, role: true } },
        lease: { select: { landlordId: true, unit: { select: { label: true, propertyId: true, property: { select: { name: true } } } } } },
        allocations: { select: { amount: true, charge: { select: { kind: true } } } },
      },
    }),
    db.booking.findMany({
      where: { status: { in: ["confirmed", "completed"] }, paidAt: { gte: start, lt: end }, unit: { property: propWhere } },
      select: { id: true, total: true, paidAt: true, reference: true, receiptNo: true, method: true, guest: { select: { name: true } }, unit: { select: { label: true, propertyId: true, property: { select: { name: true, landlordId: true } } } } },
    }),
    db.expense.findMany({
      where: { status: "approved", spentOn: { gte: dFrom, lt: dTo }, ...(scope.landlordId ? { landlordId: scope.landlordId } : {}), ...(scope.propertyId ? { propertyId: scope.propertyId } : {}) },
      orderBy: { spentOn: "asc" }, include: { property: { select: { name: true } }, landlord: { select: { name: true } } },
    }),
    db.charge.findMany({
      where: { kind: { not: "deposit" }, dueDate: { gte: dFrom, lt: dTo }, lease: leaseWhere },
      select: { amount: true, lease: { select: { unit: { select: { propertyId: true } } } } },
    }),
    db.charge.findMany({
      where: { status: { not: "paid" }, kind: { not: "deposit" }, dueDate: { lt: dTo }, lease: { ...leaseWhere, OR: [{ status: "active" }, { status: "ended", settlement: { lt: 0 } }] } },
      orderBy: { dueDate: "asc" },
      select: { amount: true, paid: true, dueDate: true, lease: { select: { id: true, landlordId: true, status: true, tenant: { select: { name: true, phone: true } }, unit: { select: { label: true, propertyId: true, property: { select: { name: true } } } } } } },
    }),
    db.charge.findMany({ where: { kind: "deposit", lease: { ...leaseWhere, status: "active" } }, select: { paid: true } }),
    db.user.findMany({ where: { role: "landlord", ...(scope.landlordId ? { id: scope.landlordId } : {}) }, select: { id: true, name: true, businessName: true, commissionPct: true }, orderBy: { name: "asc" } }),
  ]);

  // Money in, by what it paid for, by property and by method.
  const byKind: Record<string, number> = {};
  const inByProp = new Map<number, number>(), commissionBaseByLandlord = new Map<number, number>(), inByLandlord = new Map<number, number>();
  const methods = new Map<string, { count: number; amount: number }>();
  const add = <K>(m: Map<K, number>, k: K, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  const monthly = new Map<string, { billed: number; collected: number; expenses: number }>();
  const mon = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 7);
  const bump = (ym: string, k: "billed" | "collected" | "expenses", n: number) => { const r = monthly.get(ym) ?? { billed: 0, collected: 0, expenses: 0 }; r[k] += n; monthly.set(ym, r); };
  for (const p of payments) {
    let allocated = 0;
    for (const a of p.allocations) {
      byKind[a.charge.kind] = (byKind[a.charge.kind] ?? 0) + a.amount; allocated += a.amount;
      if (["rent", "late_fee"].includes(a.charge.kind)) add(commissionBaseByLandlord, p.lease.landlordId, a.amount);
    }
    if (p.amount > allocated) byKind.credit = (byKind.credit ?? 0) + p.amount - allocated;
    add(inByProp, p.lease.unit.propertyId, p.amount); add(inByLandlord, p.lease.landlordId, p.amount);
    const m = methods.get(p.method) ?? { count: 0, amount: 0 }; m.count++; m.amount += p.amount; methods.set(p.method, m);
    bump(mon(p.paidAt!), "collected", p.amount);
  }
  for (const b of bookings) {
    byKind.short_stay = (byKind.short_stay ?? 0) + b.total;
    add(inByProp, b.unit.propertyId, b.total); add(inByLandlord, b.unit.property.landlordId, b.total); add(commissionBaseByLandlord, b.unit.property.landlordId, b.total);
    const m = methods.get("stay") ?? { count: 0, amount: 0 }; m.count++; m.amount += b.total; methods.set("stay", m);
    bump(mon(b.paidAt!), "collected", b.total);
  }
  const collectedAll = Object.values(byKind).reduce((s, n) => s + n, 0);
  const deposits = byKind.deposit ?? 0;
  const collected = collectedAll - deposits; // deposits are the tenants' money, not income

  const billed = billedCharges.reduce((s, c) => s + c.amount, 0);
  const billedByProp = new Map<number, number>();
  for (const c of billedCharges) add(billedByProp, c.lease.unit.propertyId, c.amount);
  // Billed per month (by due date) for the trend.
  const billedRows = await db.charge.groupBy({ by: ["dueDate"], where: { kind: { not: "deposit" }, dueDate: { gte: dFrom, lt: dTo }, lease: leaseWhere }, _sum: { amount: true } });
  for (const r of billedRows) bump(r.dueDate.toISOString().slice(0, 7), "billed", r._sum.amount ?? 0);

  const expByCat = new Map<string, number>(), expByProp = new Map<number, number>(), expByLandlord = new Map<number, number>();
  for (const e of expenses) { add(expByCat, e.category, e.amount); if (e.propertyId) add(expByProp, e.propertyId, e.amount); add(expByLandlord, e.landlordId, e.amount); bump(e.spentOn.toISOString().slice(0, 7), "expenses", e.amount); }
  const spent = expenses.reduce((s, e) => s + e.amount, 0);

  // Arrears at the end of the period, by how late.
  const asOf = new Date(Math.min(Date.parse(`${period.to}T00:00:00Z`), Date.parse(`${kampalaToday()}T00:00:00Z`) + 86400000) - 86400000).toISOString().slice(0, 10);
  const aging = { "0–30 days": 0, "31–60 days": 0, "61–90 days": 0, "Over 90 days": 0 };
  const debtors = new Map<number, { tenant: string; phone: string; property: string; unit: string; owed: number; oldest: string; days: number; ended: boolean; landlordId: number; propertyId: number }>();
  const arrByProp = new Map<number, number>(), arrByLandlord = new Map<number, number>();
  for (const c of openCharges) {
    const owed = c.amount - c.paid;
    if (owed <= 0) continue;
    const due = c.dueDate.toISOString().slice(0, 10);
    if (due > asOf) continue;
    const days = daysBetween(due, asOf);
    aging[days <= 30 ? "0–30 days" : days <= 60 ? "31–60 days" : days <= 90 ? "61–90 days" : "Over 90 days"] += owed;
    add(arrByProp, c.lease.unit.propertyId, owed); add(arrByLandlord, c.lease.landlordId, owed);
    const d = debtors.get(c.lease.id) ?? { tenant: c.lease.tenant.name, phone: c.lease.tenant.phone, property: c.lease.unit.property.name, unit: c.lease.unit.label, owed: 0, oldest: due, days, ended: c.lease.status === "ended", landlordId: c.lease.landlordId, propertyId: c.lease.unit.propertyId };
    d.owed += owed; if (due < d.oldest) { d.oldest = due; d.days = days; }
    debtors.set(c.lease.id, d);
  }
  const arrears = Object.values(aging).reduce((s, n) => s + n, 0);

  // Commission per landlord (on rent, late fees and short stays actually collected).
  const lmap = new Map(landlords.map((l) => [l.id, l]));
  const commissionOf = (lid: number) => Math.round(((commissionBaseByLandlord.get(lid) ?? 0) * (lmap.get(lid)?.commissionPct ?? 0)) / 100);
  const landlordIds = [...new Set([...properties.map((p) => p.landlordId), ...inByLandlord.keys(), ...expByLandlord.keys()])];
  const byLandlord = landlordIds.map((lid) => {
    const props = properties.filter((p) => p.landlordId === lid);
    const units = props.flatMap((p) => p.units.filter((u) => u.mode === "long"));
    const income = (inByLandlord.get(lid) ?? 0) - payments.filter((p) => p.lease.landlordId === lid).reduce((s, p) => s + p.allocations.filter((a) => a.charge.kind === "deposit").reduce((x, a) => x + a.amount, 0), 0);
    const commission = commissionOf(lid);
    const exp = expByLandlord.get(lid) ?? 0;
    const l = lmap.get(lid);
    return { id: lid, name: l?.businessName || l?.name || `Landlord ${lid}`, commissionPct: l?.commissionPct ?? 0, properties: props.length, units: units.length, occupied: units.filter((u) => u.status === "occupied").length, collected: income, expenses: exp, commission, net: income - exp - commission, arrears: arrByLandlord.get(lid) ?? 0 };
  }).sort((a, b) => b.collected - a.collected);
  const commission = byLandlord.reduce((s, l) => s + l.commission, 0);

  const byProperty = properties.map((p) => {
    const units = p.units.filter((u) => u.mode === "long");
    const deps = payments.filter((x) => x.lease.unit.propertyId === p.id).reduce((s, x) => s + x.allocations.filter((a) => a.charge.kind === "deposit").reduce((y, a) => y + a.amount, 0), 0);
    const b = billedByProp.get(p.id) ?? 0, c = (inByProp.get(p.id) ?? 0) - deps;
    return { id: p.id, name: p.name, location: p.location, landlord: p.landlord.name, units: units.length, occupied: units.filter((u) => u.status === "occupied").length, billed: b, collected: c, rate: b ? Math.round((Math.min(c, b) / b) * 100) : null, expenses: expByProp.get(p.id) ?? 0, arrears: arrByProp.get(p.id) ?? 0 };
  }).sort((a, b) => b.collected - a.collected);

  const longUnits = properties.flatMap((p) => p.units.filter((u) => u.mode === "long"));
  const occupied = longUnits.filter((u) => u.status === "occupied").length;
  // Every month that overlaps the period (for the trend chart).
  const months: string[] = [];
  const thisMonth = kampalaToday().slice(0, 7); // no empty bars for months that haven't happened yet
  for (let d = period.from.slice(0, 7); `${d}-01` < period.to && d <= thisMonth && months.length < 36; ) {
    months.push(d);
    const [yy, mm] = d.split("-").map(Number);
    d = `${mm === 12 ? yy + 1 : yy}-${pad(mm === 12 ? 1 : mm + 1)}`;
  }
  const rentDue = billedCharges.length ? billed : 0;
  return {
    period, scope, generatedAt: new Date(), asOf,
    totals: {
      collected, deposits, billed: rentDue, collectionRate: rentDue ? Math.round((Math.min(collected - (byKind.short_stay ?? 0) - (byKind.credit ?? 0), rentDue) / rentDue) * 100) : null,
      expenses: spent, commission, netToLandlords: collected - spent - commission,
      arrears, depositsHeld: depositCharges.reduce((s, c) => s + c.paid, 0),
      units: longUnits.length, occupied, occupancy: longUnits.length ? Math.round((occupied / longUnits.length) * 100) : null,
      properties: properties.length, landlords: byLandlord.filter((l) => l.properties).length,
      payments: payments.length, bookings: bookings.length,
    },
    income: Object.entries(byKind).filter(([k, v]) => k !== "deposit" && v > 0).map(([k, v]) => ({ kind: k, label: KIND[k] ?? k, amount: v })).sort((a, b) => b.amount - a.amount),
    methods: [...methods.entries()].map(([k, v]) => ({ method: k, label: METHOD[k] ?? k, ...v })).sort((a, b) => b.amount - a.amount),
    expensesByCategory: [...expByCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    byLandlord, byProperty, aging, debtors: [...debtors.values()].sort((a, b) => b.owed - a.owed),
    monthly: months.map((m) => ({ month: m, label: new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), ...(monthly.get(m) ?? { billed: 0, collected: 0, expenses: 0 }) })),
    paymentRows: [
      ...payments.map((p) => ({ date: p.paidAt!, receipt: p.receiptNo ?? "", payer: p.tenant.name, property: p.lease.unit.property.name, unit: p.lease.unit.label, method: METHOD[p.method] ?? p.method, reference: p.reference, amount: p.amount, recordedBy: p.recordedBy ? `${p.recordedBy.name} (${p.recordedBy.role})` : "Mobile Money (tenant)", forWhat: [...new Set(p.allocations.map((a) => KIND[a.charge.kind] ?? a.charge.kind))].join(", ") || "Credit" })),
      ...bookings.map((b) => ({ date: b.paidAt!, receipt: b.receiptNo ?? "", payer: b.guest.name, property: b.unit.property.name, unit: b.unit.label, method: "Short-stay booking", reference: b.reference, amount: b.total, recordedBy: "Online booking", forWhat: "Short stay" })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime()),
    expenseRows: expenses.map((e) => ({ date: e.spentOn, landlord: e.landlord.name, property: e.property?.name ?? "General", category: e.category, description: e.description, amount: e.amount, fromJob: !!e.jobId })),
  };
}
export type FinancialReport = Awaited<ReturnType<typeof financialReport>>;

/** "All landlords…", "All properties of X" or "Property (Landlord)" for headings and file titles. */
export async function scopeName(landlordId?: number, propertyId?: number) {
  if (propertyId) {
    const p = await db.property.findUnique({ where: { id: propertyId }, select: { name: true, landlord: { select: { name: true } } } });
    return p ? `${p.name} (${p.landlord.name})` : "Property";
  }
  if (landlordId) {
    const l = await db.user.findUnique({ where: { id: landlordId }, select: { name: true, businessName: true } });
    return l ? `All properties of ${l.businessName || l.name}` : "Landlord";
  }
  return "All landlords and properties managed on CasaVilla";
}
