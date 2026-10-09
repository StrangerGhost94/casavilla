import "server-only";
import { db, type Job } from "@/db";
import { kampalaToday, ugx, ymd } from "./format";
import { daysBetween } from "./billing";

// ── Tenant payment reliability ────────────────────────────────────────────────

export type TenantScore = {
  score: number | null; label: string; tone: "green" | "gold" | "red" | "gray";
  months: number; onTimePct: number | null; avgLateDays: number; arrears: number; pastLeases: number;
};

/**
 * How reliably a tenant has paid rent at CasaVilla: each past rent charge is checked for when it was fully paid.
 * Paid within 3 days of the due date counts as on time. Unpaid overdue charges count against them.
 */
export async function tenantScore(tenantId: number): Promise<TenantScore> {
  const today = kampalaToday();
  const [charges, pastLeases] = await Promise.all([
    db.charge.findMany({
      where: { kind: "rent", lease: { tenantId }, dueDate: { lt: new Date(`${today}T00:00:00Z`) } },
      select: { amount: true, paid: true, dueDate: true, status: true, allocations: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.lease.count({ where: { tenantId, status: "ended" } }),
  ]);
  if (!charges.length) return { score: null, label: "New — no rent history yet", tone: "gray", months: 0, onTimePct: null, avgLateDays: 0, arrears: 0, pastLeases };
  let penalty = 0, onTime = 0, lateSum = 0, arrears = 0;
  for (const c of charges) {
    const due = ymd(c.dueDate);
    const paidOn = c.status === "paid" ? (c.allocations[0] ? c.allocations[0].createdAt.toISOString().slice(0, 10) : due) : today;
    const late = Math.max(0, daysBetween(due, paidOn));
    if (c.status !== "paid") arrears += c.amount - c.paid;
    if (late <= 3 && c.status === "paid") { onTime++; continue; }
    lateSum += late;
    penalty += late <= 14 ? 5 : late <= 30 ? 12 : 20;
    if (c.status !== "paid") penalty += 5;
  }
  const score = Math.max(0, Math.min(100, 100 - penalty));
  const label = score >= 85 ? "Excellent payer" : score >= 70 ? "Good payer" : score >= 50 ? "Sometimes late" : "High risk";
  const tone = score >= 85 ? "green" : score >= 50 ? "gold" : "red";
  return {
    score, label, tone, months: charges.length, onTimePct: Math.round((onTime / charges.length) * 100),
    avgLateDays: charges.length - onTime ? Math.round(lateSum / (charges.length - onTime)) : 0, arrears, pastLeases,
  };
}

// ── Provider ranking ──────────────────────────────────────────────────────────

const STOP = new Set(["road", "kampala", "uganda", "street", "plot", "avenue", "lane", "close", "near", "opposite", "the", "and"]);
export const placeWords = (s: string | null | undefined) =>
  new Set((s ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)));

export type ProviderStats = { id: number; jobs: number; done: number; cancelled: number; active: number; rating: number | null; ratings: number };

export async function providerStats(ids?: number[]): Promise<Map<number, ProviderStats>> {
  const jobs = await db.job.groupBy({
    by: ["providerId", "status"], _count: true, where: { providerId: ids ? { in: ids } : { not: null } },
  });
  const rated = await db.job.groupBy({
    by: ["providerId"], _avg: { rating: true }, _count: { rating: true }, where: { providerId: ids ? { in: ids } : { not: null }, rating: { not: null } },
  });
  const m = new Map<number, ProviderStats>();
  const get = (id: number) => m.get(id) ?? (m.set(id, { id, jobs: 0, done: 0, cancelled: 0, active: 0, rating: null, ratings: 0 }), m.get(id)!);
  for (const r of jobs) {
    if (!r.providerId) continue;
    const s = get(r.providerId);
    s.jobs += r._count;
    if (r.status === "done") s.done += r._count;
    if (r.status === "cancelled") s.cancelled += r._count;
    if (["assigned", "quoted", "accepted", "in_progress"].includes(r.status)) s.active += r._count;
  }
  for (const r of rated) {
    if (!r.providerId) continue;
    const s = get(r.providerId);
    s.rating = r._avg.rating ? Math.round(r._avg.rating * 10) / 10 : null;
    s.ratings = r._count.rating;
  }
  return m;
}

export type RankedProvider = { id: number; name: string; score: number; reasons: string[]; category: boolean; rating: number | null };

/** Best providers for a job: does this kind of work, works in the area, rated well, finishes jobs, isn't overloaded. */
export async function rankProviders(job: Pick<Job, "category" | "propertyId" | "providerId">): Promise<RankedProvider[]> {
  const [providers, property] = await Promise.all([
    db.user.findMany({ where: { role: "provider", status: "active" }, include: { services: { where: { active: true }, select: { category: true, priceFrom: true } } } }),
    job.propertyId ? db.property.findUnique({ where: { id: job.propertyId }, select: { location: true } }) : null,
  ]);
  const stats = await providerStats(providers.map((p) => p.id));
  const here = placeWords(property?.location);
  return providers.map((p) => {
    const s = stats.get(p.id);
    const reasons: string[] = [];
    let score = 0;
    const category = p.services.some((x) => x.category === job.category);
    if (category) { score += 50; reasons.push(`Does ${job.category.toLowerCase()}`); }
    const area = [...placeWords(p.area)].some((w) => here.has(w));
    if (area) { score += 20; reasons.push(`Works in ${p.area}`); }
    if (s?.rating) { score += s.rating * 5; reasons.push(`★ ${s.rating} (${s.ratings})`); }
    if (s && s.jobs >= 2) {
      const rate = s.done / Math.max(1, s.done + s.cancelled);
      score += rate * 10;
      if (s.done) reasons.push(`${s.done} job${s.done > 1 ? "s" : ""} done`);
    }
    if (s?.active) { score -= Math.min(15, s.active * 4); reasons.push(`${s.active} active now`); }
    else reasons.push("Available");
    return { id: p.id, name: p.businessName || p.name, score: Math.round(score), reasons, category, rating: s?.rating ?? null };
  }).sort((a, b) => b.score - a.score);
}

// ── Market rent ───────────────────────────────────────────────────────────────

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/** Typical rent for units like this one: same bedrooms in the same area, otherwise same bedrooms anywhere. */
export async function marketRent(location: string, bedrooms: number, excludeUnitId?: number) {
  const units = await db.unit.findMany({
    where: { bedrooms, id: excludeUnitId ? { not: excludeUnitId } : undefined, rent: { gt: 0 } },
    select: { rent: true, property: { select: { location: true } } },
  });
  const here = placeWords(location);
  const near = units.filter((u) => [...placeWords(u.property.location)].some((w) => here.has(w))).map((u) => u.rent);
  if (near.length >= 2) return { median: median(near)!, n: near.length, scope: "nearby" as const };
  if (units.length >= 2) return { median: median(units.map((u) => u.rent))!, n: units.length, scope: "across CasaVilla" as const };
  return null;
}

// ── Repair triage ─────────────────────────────────────────────────────────────

const EMERGENCY = /\b(fire|smoke|gas|spark(s|ing)?|shock|electrocut|burst|flood(ing|ed)?|sewage|sewer|overflow(ing)?|no water|no power|no electricity|black ?out|collaps|crack(ed)? (wall|ceiling)|break[- ]?in|broken (door|lock|window)|can'?t lock|exposed wire|live wire)/i;
const CATEGORY_WORDS: [string, RegExp][] = [
  ["Plumbing", /\b(leak|tap|pipe|toilet|sink|drain|water|shower|sewage|blocked|geyser|tank)\b/i],
  ["Electrical", /\b(power|socket|switch|bulb|light|wire|wiring|electric|yaka|meter|breaker|fuse|spark)\b/i],
  ["Pest control", /\b(cockroach|roach|rat|rats|mice|mouse|termite|bed ?bug|ants|mosquito|pest|snake)\b/i],
  ["Carpentry", /\b(door|cupboard|wardrobe|hinge|shelf|wood|window frame|drawer)\b/i],
  ["Structural", /\b(crack|wall|roof|ceiling|floor|tiles?|foundation)\b/i],
  ["Painting", /\b(paint|peeling|stain|repaint)\b/i],
  ["Security", /\b(lock|gate|key|alarm|cctv|guard|burglar|padlock)\b/i],
  ["Cleaning", /\b(clean|dirty|garbage|rubbish|trash|mould|mold)\b/i],
  ["Gardening", /\b(grass|garden|hedge|tree|compound|slash)\b/i],
];

/** Reads a repair description: is it an emergency, and what kind of work does it sound like? */
export function triage(text: string) {
  const urgent = EMERGENCY.test(text);
  const category = CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
  return { urgent, category };
}

// ── Landlord / portfolio insights ─────────────────────────────────────────────

export type Suggestion = { text: string; href: string; tone: "red" | "gold" | "green" | "blue" };

export async function portfolioInsights(landlordId: number | undefined, base: "/landlord" | "/manager") {
  const today = kampalaToday();
  const todayD = new Date(`${today}T00:00:00Z`);
  const byLease = landlordId ? { landlordId } : {};
  const [open, leases, vacantUnits, yearJobs] = await Promise.all([
    db.charge.findMany({ where: { status: { not: "paid" }, dueDate: { lt: todayD }, lease: { ...byLease, status: "active" } }, select: { amount: true, paid: true, dueDate: true, leaseId: true } }),
    db.lease.findMany({
      where: { ...byLease, status: "active" },
      select: { id: true, endDate: true, tenant: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } },
    }),
    db.unit.findMany({
      where: { status: "vacant", ...(landlordId ? { property: { landlordId } } : {}) },
      select: { id: true, label: true, rent: true, bedrooms: true, listed: true, createdAt: true, propertyId: true, property: { select: { name: true, location: true } }, leases: { where: { status: "ended" }, orderBy: { endedAt: "desc" }, take: 1, select: { endedAt: true, endDate: true } } },
    }),
    db.job.aggregate({
      _sum: { quote: true }, _count: true,
      where: { status: "done", serviceId: null, ...(landlordId ? { landlordId } : {}), completedAt: { gte: new Date(`${today.slice(0, 4)}-01-01T00:00:00Z`) } },
    }),
  ]);

  const aging = { d30: 0, d60: 0, d90: 0 };
  const perLease = new Map<number, number>();
  for (const c of open) {
    const d = daysBetween(ymd(c.dueDate), today);
    const owed = c.amount - c.paid;
    if (d <= 30) aging.d30 += owed; else if (d <= 60) aging.d60 += owed; else aging.d90 += owed;
    perLease.set(c.leaseId, Math.max(perLease.get(c.leaseId) ?? 0, d));
  }
  const expiring = leases.map((l) => ({ ...l, days: daysBetween(today, ymd(l.endDate)) })).filter((l) => l.days <= 60).sort((a, b) => a.days - b.days);
  const vacant = await Promise.all(vacantUnits.map(async (u) => {
    const since = u.leases[0]?.endedAt ?? u.leases[0]?.endDate ?? u.createdAt;
    const market = await marketRent(u.property.location, u.bedrooms, u.id);
    return { ...u, days: Math.max(0, daysBetween(since.toISOString().slice(0, 10), today)), market };
  }));
  vacant.sort((a, b) => b.days - a.days);

  const s: Suggestion[] = [];
  const longLate = [...perLease.values()].filter((d) => d > 30).length;
  if (longLate) s.push({ tone: "red", href: `${base}/tenants`, text: `${longLate} tenant${longLate > 1 ? "s are" : " is"} more than 30 days behind. Call them and agree a payment plan before it grows.` });
  for (const l of expiring.slice(0, 3)) {
    s.push({
      tone: l.days < 0 ? "red" : "gold", href: `${base}/tenants/${l.id}`,
      text: l.days < 0
        ? `${l.tenant.name}'s lease (${l.unit.property.name} · ${l.unit.label}) ended ${-l.days} days ago — they're month-to-month. Renew it or plan the move-out.`
        : `${l.tenant.name}'s lease (${l.unit.property.name} · ${l.unit.label}) ends in ${l.days} days. Offer a renewal now to avoid a vacancy.`,
    });
  }
  for (const u of vacant.slice(0, 4)) {
    if (!u.listed) s.push({ tone: "blue", href: `${base}/properties/${u.propertyId}`, text: `${u.property.name} · ${u.label} is vacant but not listed. List it so tenants can apply.` });
    else if (u.market && u.rent > u.market.median * 1.15 && u.days >= 21)
      s.push({ tone: "gold", href: `${base}/properties/${u.propertyId}`, text: `${u.property.name} · ${u.label} has been empty ${u.days} days at ${ugx(u.rent)}. Similar ${u.bedrooms}-bed units ${u.market.scope} rent for about ${ugx(u.market.median)}.` });
    else if (u.days >= 45) s.push({ tone: "gold", href: `${base}/properties/${u.propertyId}`, text: `${u.property.name} · ${u.label} has been empty ${u.days} days. Add better photos or review the rent.` });
  }
  if (!s.length) s.push({ tone: "green", href: base, text: "Everything looks healthy — rent is on track and no leases need attention." });

  return { aging, expiring, vacant, maintenance: { spent: yearJobs._sum.quote ?? 0, jobs: yearJobs._count }, suggestions: s };
}
