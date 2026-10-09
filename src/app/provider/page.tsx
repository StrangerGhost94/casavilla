import Link from "next/link";
import { BadgeCheck, Clock, Star } from "lucide-react";
import { providerStats } from "@/lib/insights";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { Avatar, SectionTitle, Stat } from "@/components/ui";
import { JobList } from "@/components/Jobs";

export default async function ProviderHome() {
  const u = await requireUser("provider");
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const count = (statuses: string[]) => db.job.count({ where: { providerId: u.id, status: { in: statuses } } });
  const [newJobs, active, done, svcs, weekJobs, weekOrders, openOrders] = await Promise.all([
    count(["assigned"]), count(["accepted", "in_progress"]), count(["done"]),
    db.service.findMany({ where: { providerId: u.id, active: true }, select: { category: true } }),
    db.job.aggregate({ _sum: { quote: true }, _count: true, where: { providerId: u.id, status: "done", completedAt: { gte: weekAgo } } }),
    db.order.aggregate({ _sum: { total: true }, where: { providerId: u.id, status: "delivered", createdAt: { gte: weekAgo } } }),
    db.order.aggregate({ _count: true, _sum: { total: true }, where: { providerId: u.id, status: { in: ["placed", "confirmed"] } } }),
  ]);
  const categories = [...new Set(svcs.map((s) => s.category))];
  const st = (await providerStats([u.id])).get(u.id);
  const completion = st && st.done + st.cancelled > 0 ? Math.round((st.done / (st.done + st.cancelled)) * 100) : null;
  const earnings = (weekJobs._sum.quote ?? 0) + (weekOrders._sum.total ?? 0);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="card flex items-center gap-4">
        <Avatar name={u.businessName || u.name} className="h-14 w-14 text-base ring-4 ring-gold-100" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-brand-950">{u.businessName || u.name}</div>
          <div className="truncate text-xs text-stone-500">{categories.length ? categories.join(" · ") : "No services listed yet"}</div>
          {u.status === "active"
            ? <span className="pill mt-1 bg-brand-50 text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>
            : <span className="pill mt-1 bg-gold-50 text-gold-700"><Clock className="h-3.5 w-3.5" /> Awaiting approval</span>}
          {st?.rating && <span className="pill ml-1.5 mt-1 bg-gold-50 text-gold-700"><Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> {st.rating} · {st.ratings} review{st.ratings > 1 ? "s" : ""}</span>}
        </div>
      </div>

      {svcs.length === 0 && (
        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">
          Start by listing what you do — cleaning, plumbing, pest control… <Link href="/provider/services" className="link">Add your services →</Link>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl bg-brand-900 p-5 text-white shadow-card">
        <div className="text-xs text-white/70">Earnings this week</div>
        <div className="mt-0.5 text-2xl font-bold">{ugx(earnings)}</div>
        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center text-xs">
          <div><div className="text-lg font-semibold text-gold-300">{weekJobs._count}</div><div className="text-white/60">Jobs this week</div></div>
          <div><div className="text-lg font-semibold text-gold-300">{done}</div><div className="text-white/60">Completed</div></div>
          <div><div className="text-lg font-semibold text-gold-300">{openOrders._count}</div><div className="text-white/60">Open orders</div></div>
        </div>
      </div>

      {completion != null && (
        <p className="mt-3 rounded-xl bg-white px-4 py-2.5 text-xs text-stone-600 shadow-card">
          You finish <b className="text-brand-800">{completion}%</b> of the jobs you take on. Higher ratings and completion put you at the top when landlords and CasaVilla pick a provider.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat label="New jobs to accept" value={newJobs} href="/provider/jobs" />
        <Stat label="In progress" value={active} href="/provider/jobs" />
      </div>

      <SectionTitle title="Today's jobs" href="/provider/jobs" />
      <JobList where={{ providerId: u.id, status: { in: ["assigned", "accepted", "in_progress"] } }} base="/provider/jobs" empty="No active jobs right now" />
      {(openOrders._sum.total ?? 0) > 0 && <p className="mt-3 text-xs text-stone-500">Open shop orders worth {ugx(openOrders._sum.total)} — <Link href="/provider/orders" className="link">view orders</Link></p>}
    </div>
  );
}
