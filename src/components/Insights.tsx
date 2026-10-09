import Link from "next/link";
import { AlertTriangle, CalendarClock, ChevronRight, Lightbulb, Sparkles, TrendingUp } from "lucide-react";
import { db } from "@/db";
import { portfolioInsights, tenantScore, type Suggestion } from "@/lib/insights";
import { kampalaToday, ugx, ymd } from "@/lib/format";
import { SectionTitle } from "./ui";

const toneIcon: Record<Suggestion["tone"], { cls: string; Icon: typeof Lightbulb }> = {
  red: { cls: "bg-maroon-50 text-maroon-600", Icon: AlertTriangle },
  gold: { cls: "bg-gold-50 text-gold-700", Icon: CalendarClock },
  blue: { cls: "bg-sky-50 text-sky-700", Icon: Lightbulb },
  green: { cls: "bg-brand-50 text-brand-700", Icon: Sparkles },
};

/**
 * "What to do next" for a landlord (or the whole company for managers): smart suggestions, arrears by age,
 * and a collection forecast that weighs each tenant's payment history.
 */
export async function SmartPanel({ landlordId, base }: { landlordId?: number; base: "/landlord" | "/manager" }) {
  const ins = await portfolioInsights(landlordId, base);
  const f = await collectionForecast(landlordId);
  const totalAging = ins.aging.d30 + ins.aging.d60 + ins.aging.d90;
  return (
    <>
      <SectionTitle title="Smart suggestions" />
      <div className="card divide-y divide-stone-100 p-0">
        {ins.suggestions.slice(0, 6).map((s, i) => {
          const { cls, Icon } = toneIcon[s.tone];
          return (
            <Link key={i} href={s.href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cls}`}><Icon className="h-4 w-4" /></span>
              <span className="flex-1 text-sm text-stone-700">{s.text}</span>
              <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-stone-400" />
            </Link>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-950"><TrendingUp className="h-4 w-4 text-brand-700" /> Expected this month</div>
          <div className="mt-2 text-2xl font-bold text-brand-950">{ugx(f.expected)}</div>
          <div className="mt-1 text-xs text-stone-500">
            of {ugx(f.outstanding)} still to collect for {f.monthLabel}, based on how reliably each tenant has paid before.
            {f.atRisk > 0 && <> <span className="font-semibold text-maroon-600">{ugx(f.atRisk)}</span> of it is owed by tenants who often pay late — follow up early.</>}
          </div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold text-brand-950">Overdue by age</div>
          {totalAging === 0 ? <p className="mt-2 text-sm text-brand-700">Nothing overdue.</p> : (
            <>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-100">
                <div className="bg-gold-400" style={{ width: `${(ins.aging.d30 / totalAging) * 100}%` }} />
                <div className="bg-orange-500" style={{ width: `${(ins.aging.d60 / totalAging) * 100}%` }} />
                <div className="bg-maroon-600" style={{ width: `${(ins.aging.d90 / totalAging) * 100}%` }} />
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-stone-500">
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-gold-400" />≤30d<br /><b className="text-stone-800">{ugx(ins.aging.d30)}</b></span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" />31–60d<br /><b className="text-stone-800">{ugx(ins.aging.d60)}</b></span>
                <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-maroon-600" />60d+<br /><b className="text-stone-800">{ugx(ins.aging.d90)}</b></span>
              </div>
            </>
          )}
        </div>
      </div>
      {ins.maintenance.jobs > 0 && (
        <p className="mt-3 text-xs text-stone-500">Repairs this year: {ins.maintenance.jobs} completed, {ugx(ins.maintenance.spent)} in provider costs.</p>
      )}
    </>
  );
}

/** What is still owed for this month's rent, and how much of it is likely to come in. */
async function collectionForecast(landlordId?: number) {
  const today = kampalaToday();
  const month = today.slice(0, 7);
  const open = await db.charge.findMany({
    where: { period: month, kind: "rent", status: { not: "paid" }, lease: { status: "active", ...(landlordId ? { landlordId } : {}) } },
    select: { amount: true, paid: true, dueDate: true, lease: { select: { tenantId: true } } },
  });
  let expected = 0, outstanding = 0, atRisk = 0;
  const cache = new Map<number, number>();
  for (const c of open) {
    const owed = c.amount - c.paid;
    outstanding += owed;
    let p = cache.get(c.lease.tenantId);
    if (p === undefined) {
      const s = await tenantScore(c.lease.tenantId);
      // New tenants get the benefit of the doubt; poor payers are less likely to pay in full this month.
      p = s.score == null ? 0.85 : Math.max(0.2, s.score / 100);
      if (ymd(c.dueDate) < today) p *= 0.85;
      cache.set(c.lease.tenantId, p);
    }
    expected += owed * p;
    if (p < 0.6) atRisk += owed;
  }
  const [y, m] = month.split("-").map(Number);
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
  return { expected: Math.round(expected / 1000) * 1000, outstanding, atRisk, monthLabel };
}
