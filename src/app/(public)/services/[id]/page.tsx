import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { shopProducts } from "@/lib/queries";
import { fmtDate, ugx } from "@/lib/format";
import { ArrowLeft, BadgeCheck, Briefcase, MapPin, MessageCircle, Star } from "lucide-react";
import { CategoryIcon } from "@/lib/icons";
import { Avatar } from "@/components/ui";
import { Submit } from "@/components/client";
import { bookService } from "@/app/market-actions";
import { ActionBar } from "@/components/ListingParts";
import { ProductCard, Stars } from "@/components/MarketCards";

export const dynamic = "force-dynamic";

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.user.findFirst({ where: { id: Number(id) || 0, role: "provider", status: "active" }, include: { serviceAreas: { include: { location: { select: { name: true } } } } } });
  if (!p) notFound();
  const [svcs, prods, me, stats, reviews] = await Promise.all([
    db.service.findMany({ where: { providerId: p.id, active: true }, orderBy: { category: "asc" } }),
    shopProducts(p.id),
    getUser(),
    db.job.aggregate({ where: { providerId: p.id, status: "done" }, _count: { _all: true, rating: true }, _avg: { rating: true } }),
    db.job.findMany({ where: { providerId: p.id, status: "done", rating: { not: null } }, orderBy: { completedAt: "desc" }, take: 6, select: { id: true, rating: true, review: true, category: true, completedAt: true, requester: { select: { name: true } } } }),
  ]);
  const canBook = me && ["tenant", "landlord", "manager"].includes(me.role);
  const myProps = me?.role === "landlord" ? await db.property.findMany({ where: { landlordId: me.id }, orderBy: { name: "asc" } }) : [];
  const name = p.businessName || p.name;
  const areas = p.serviceAreas.length ? p.serviceAreas.map((a) => a.location.name) : [p.area || "Kampala"];
  const prices = svcs.map((s) => s.priceFrom).filter((n): n is number => n != null);
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'd like to book ${name}.`)}`;

  return (
    <main>
      {/* Profile header */}
      <section className="bg-brand-950 text-white">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-4 md:pb-8 md:pt-6">
          <Link href="/services" className="inline-flex items-center gap-1 text-sm font-medium text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" /> All providers</Link>
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={name} className="h-20 w-20 text-xl ring-4 ring-white/10" />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold md:text-3xl">{name}</h1>
              <span className="pill mt-1 bg-white/10 text-gold-300"><BadgeCheck className="h-3.5 w-3.5" /> Verified by CasaVilla</span>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="flex items-center justify-center gap-1 text-lg font-bold"><Star className="h-4 w-4 fill-gold-400 text-gold-400" />{stats._avg.rating ? stats._avg.rating.toFixed(1) : "New"}</div>
              <div className="text-[11px] text-white/60">{stats._count.rating ? `${stats._count.rating} review${stats._count.rating === 1 ? "" : "s"}` : "No reviews yet"}</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="text-lg font-bold">{stats._count._all}</div>
              <div className="text-[11px] text-white/60">Jobs done</div>
            </div>
            <div className="rounded-2xl bg-white/5 px-2 py-3">
              <div className="text-lg font-bold">{prices.length ? ugx(Math.min(...prices)).replace("UGX ", "") : "Quote"}</div>
              <div className="text-[11px] text-white/60">{prices.length ? "From (UGX)" : "On request"}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 pb-24 pt-5 lg:pb-10">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-600">
          <MapPin className="h-4 w-4 text-stone-400" /> Works in {areas.map((a) => <span key={a} className="pill bg-white ring-1 ring-stone-200">{a}</span>)}
        </div>
        {p.bio && (
          <section className="mt-5">
            <h2 className="h2">About</h2>
            <p className="mt-2 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-stone-600">{p.bio}</p>
          </section>
        )}

        <section id="services" className="mt-7 scroll-mt-20">
          <h2 className="h2">Services</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            {svcs.map((s) => (
              <div key={s.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><CategoryIcon category={s.category} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-brand-950">{s.title}</div>
                    <div className="text-xs text-stone-500">{s.category}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {s.priceFrom != null ? <><div className="text-[10px] text-stone-400">From</div><div className="text-sm font-bold text-brand-800">{ugx(s.priceFrom)}</div></> : <div className="text-xs font-semibold text-stone-500">Quote</div>}
                  </div>
                </div>
                {s.description && <p className="mt-3 text-sm text-stone-600">{s.description}</p>}
                {canBook ? (
                  <details className="group/req mt-3">
                    <summary className="btn-primary btn-sm w-full cursor-pointer list-none group-open/req:hidden">Request this service</summary>
                    <form action={bookService} className="space-y-2">
                      <input type="hidden" name="serviceId" value={s.id} />
                      {myProps.length > 0 && (
                        <select name="propertyId" className="input">
                          <option value="">Which property? (optional)</option>
                          {myProps.map((mp) => <option key={mp.id} value={mp.id}>{mp.name}</option>)}
                        </select>
                      )}
                      <textarea name="description" rows={3} className="input" placeholder="What needs doing, where, and when suits you" required />
                      <Submit className="btn-primary btn-sm w-full">Send request</Submit>
                      <p className="text-center text-[11px] text-stone-400">{name} replies with a quote. Nothing is charged until you accept.</p>
                    </form>
                  </details>
                ) : !me ? (
                  <Link href={`/login?next=/services/${p.id}`} className="btn-outline btn-sm mt-3 w-full">Sign in to request</Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {reviews.length > 0 && (
          <section className="mt-8">
            <h2 className="h2">What clients say</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              {reviews.map((r) => (
                <figure key={r.id} className="card p-4">
                  <div className="flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-4 w-4 ${i <= (r.rating ?? 0) ? "fill-gold-400 text-gold-400" : "text-stone-200"}`} />)}</div>
                  {r.review && <blockquote className="mt-2 text-sm text-stone-700">“{r.review}”</blockquote>}
                  <figcaption className="mt-2 text-xs text-stone-500">{r.requester?.name.split(" ")[0] ?? "Client"} · {r.category}{r.completedAt ? ` · ${fmtDate(r.completedAt)}` : ""}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {prods.length > 0 && (
          <section className="mt-8">
            <div className="flex items-end justify-between"><h2 className="h2">Items for sale</h2><Link href={`/shop?seller=${p.id}`} className="text-sm font-semibold text-brand-700">In the shop</Link></div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {prods.map((pr) => <ProductCard key={pr.id} p={pr} signedIn={!!me} next={`/services/${p.id}`} />)}
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-sm">
          <Briefcase className="h-5 w-5 shrink-0 text-brand-700" />
          <span className="min-w-0 flex-1 text-stone-600">Booked through CasaVilla, so the job, quote and rating are kept in your account.</span>
          <a href={wa} className="btn-outline btn-sm shrink-0"><MessageCircle className="h-4 w-4" /> Ask us</a>
        </div>
      </div>

      {svcs.length > 0 && (
        <ActionBar price={prices.length ? `From ${ugx(Math.min(...prices))}` : "Free quote"} sub={name}>
          <Stars rating={stats._avg.rating} count={stats._count.rating} className="hidden min-[400px]:inline-flex" />
          <a href="#services" className="btn-primary btn-sm">{canBook || !me ? "Book" : "Services"}</a>
        </ActionBar>
      )}
    </main>
  );
}
