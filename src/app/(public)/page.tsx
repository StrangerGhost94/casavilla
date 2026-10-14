import Link from "next/link";
import { BedDouble, Building2, CalendarDays, ChevronRight, Home as HomeIcon, KeyRound, LayoutDashboard, MapPin, ShoppingBag, Sparkles, Store, Trees, UserRound, Wallet, Wrench } from "lucide-react";
import { db, SERVICE_CATEGORIES, type User } from "@/db";
import { getUser, homeFor } from "@/lib/auth";
import { listedUnits } from "@/lib/queries";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { BuildingArt, Photo } from "@/components/ui";
import { PropertyCard, StayCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";
import { MarketSearch } from "@/components/MarketSearch";
import { NearMe } from "@/components/NearMe";
import { chargesSummary } from "@/components/Ledger";
import { activeLease } from "@/app/tenant/lib";

export const dynamic = "force-dynamic";

const AREAS = ["Ntinda", "Kira", "Muyenga", "Naalya", "Bukoto", "Rubaga", "Kansanga", "Najjera", "Entebbe", "Mukono", "Wakiso", "Kololo"];
const CARD = "w-[78vw] max-w-[19rem] shrink-0 snap-start";

function Rail({ title, href, cta = "See all", children }: { title: string; href: string; cta?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-950">{title}</h2>
        <Link href={href} className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700">{cta} <ChevronRight className="h-4 w-4" /></Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:[&>*]:w-auto md:[&>*]:max-w-none">
        {children}
      </div>
    </section>
  );
}

/** The signed-in person's own things, one tap away — the marketplace stays the main screen. */
async function MyStrip({ u }: { u: User }) {
  if (u.role === "tenant") {
    const lease = await activeLease(u.id);
    if (!lease) {
      return (
        <Link href="/tenant" className="card flex items-center gap-3 p-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><KeyRound className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-950">Already renting?</span><span className="block text-xs text-stone-500">Connect to your landlord to pay rent and report repairs here.</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      );
    }
    const { owed, next } = await chargesSummary(lease.l.id);
    const today = kampalaToday();
    const late = next && ymd(next.dueDate) < today;
    return (
      <div className="card flex items-center gap-3 p-3.5">
        <Photo id={lease.l.unit.property.photoId} alt={lease.property} className="h-12 w-12 shrink-0 rounded-xl" />
        <Link href="/tenant" className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-stone-500">My home · {lease.property} · {lease.unit}</span>
          {owed > 0
            ? <span className={`block text-sm font-semibold ${late ? "text-maroon-600" : "text-brand-950"}`}>{ugx(owed)} {late ? "overdue" : `due ${fmtDate(next!.dueDate)}`}</span>
            : <span className="block text-sm font-semibold text-brand-700">All paid up</span>}
        </Link>
        {owed > 0 && next ? <Link href={`/tenant/pay/${next.id}`} className="btn-primary btn-sm shrink-0"><Wallet className="h-4 w-4" /> Pay</Link> : <Link href="/tenant" className="btn-outline btn-sm shrink-0">Open</Link>}
      </div>
    );
  }
  const label = { landlord: "Your properties, tenants & rent", manager: "Manage CasaVilla", provider: "Your jobs & orders", caretaker: "Today's tasks" }[u.role] ?? "Your dashboard";
  return (
    <Link href={homeFor(u.role)} className="card flex items-center gap-3 p-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-gold-300"><LayoutDashboard className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-brand-950">Go to my dashboard</span><span className="block text-xs text-stone-500">{label}</span></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
    </Link>
  );
}

export default async function Home() {
  const u = await getUser();
  const [homes, stays, land, buildings] = await Promise.all([
    listedUnits({ limit: 10 }),
    db.unit.findMany({
      where: { mode: "short", listed: true, nightlyRate: { not: null }, property: { archivedAt: null, landlord: { status: "active" } } },
      include: { property: { select: { name: true, location: true, photoId: true } } }, orderBy: { createdAt: "desc" }, take: 10,
    }),
    db.saleListing.findMany({ where: { status: { in: ["active", "under_offer"] }, kind: { in: ["land", "farm"] } }, orderBy: [{ status: "asc" }, { publishedAt: "desc" }], take: 10 }),
    db.saleListing.findMany({ where: { status: { in: ["active", "under_offer"] }, kind: { in: ["house", "apartment", "commercial"] } }, orderBy: [{ status: "asc" }, { publishedAt: "desc" }], take: 10 }),
  ]);
  const hour = (new Date().getUTCHours() + 3) % 24;
  const hello = u ? `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${u.name.split(" ")[0]}` : "Rent, stay or buy in Uganda";
  const tiles = [
    { href: "/listings", label: "Homes to rent", icon: HomeIcon },
    { href: "/stays", label: "Short stays", icon: CalendarDays },
    { href: "/sale?kind=land", label: "Land & plots", icon: Trees },
    { href: "/sale?kind=house", label: "Houses for sale", icon: Building2 },
    { href: "/listings?beds=1", label: "1-bedroom", icon: BedDouble },
    { href: "/sale?kind=commercial", label: "Commercial", icon: Store },
    { href: "/services", label: "Services", icon: Sparkles },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
  ];
  const nothing = !homes.length && !stays.length && !land.length && !buildings.length;

  return (
    <main>
      {/* Search first: the marketplace is the home screen */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_60%] opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950/40 via-brand-950/60 to-brand-950" />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-6 md:pb-14 md:pt-12">
          <h1 className="text-2xl font-bold drop-shadow md:text-4xl">{hello}</h1>
          <p className="mt-1 text-sm text-white/80 md:text-base">{u ? "What are you looking for today?" : "Verified homes, short stays, land and property — all in one place."}</p>
          <div className="mt-4"><MarketSearch /></div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-5 max-w-6xl rounded-t-3xl bg-cream px-4 pt-5 md:rounded-none md:pt-8">
        {u && <div className="mb-5"><MyStrip u={u} /></div>}

        {/* Categories */}
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="flex flex-col items-center gap-1.5 rounded-2xl border border-stone-200/70 bg-white px-1 py-3 text-center shadow-card transition hover:border-brand-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><t.icon className="h-5 w-5" /></span>
              <span className="text-[11px] font-medium leading-tight text-stone-700">{t.label}</span>
            </Link>
          ))}
        </div>

        {/* Popular areas */}
        <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <NearMe />
          {AREAS.map((a) => <Link key={a} href={`/listings?q=${encodeURIComponent(a)}`} className="chip"><MapPin className="h-3.5 w-3.5" /> {a}</Link>)}
        </div>

        {homes.length > 0 && (
          <Rail title="New homes to rent" href="/listings">
            {homes.map((h) => <PropertyCard key={h.id} h={h} className={CARD} />)}
          </Rail>
        )}
        {land.length > 0 && (
          <Rail title="Land & plots for sale" href="/sale?kind=land">
            {land.map((l) => <SaleCard key={l.id} l={l} className={CARD} />)}
          </Rail>
        )}
        {stays.length > 0 && (
          <Rail title="Short stays" href="/stays">
            {stays.map((s) => <StayCard key={s.id} u={s} className={CARD} />)}
          </Rail>
        )}
        {buildings.length > 0 && (
          <Rail title="Houses & buildings for sale" href="/sale">
            {buildings.map((l) => <SaleCard key={l.id} l={l} className={CARD} />)}
          </Rail>
        )}
        {nothing && <div className="card mt-8 text-center text-sm text-stone-500">New listings are coming soon — check back shortly.</div>}

        {/* Sell or let with CasaVilla */}
        <section className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link href={u && (u.role === "landlord" || u.role === "manager") ? `/${u.role}/properties/new` : "/register?role=landlord"} className="card flex items-center gap-3 p-4 hover:border-brand-200">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-brand-950"><KeyRound className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">Rent out your property</span><span className="block text-xs text-stone-500">List units, collect rent on Mobile Money, manage tenants.</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
          <Link href={u && (u.role === "landlord" || u.role === "manager") ? `/${u.role}/sale/new` : "/register?role=landlord&next=/landlord/sale/new"} className="card flex items-center gap-3 p-4 hover:border-brand-200">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-gold-300"><Trees className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">Sell land or a property</span><span className="block text-xs text-stone-500">Reviewed by CasaVilla, with title verification for buyers.</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
        </section>

        {/* Services */}
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-950">Services for your property</h2>
            <Link href="/services" className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700">See all <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-11">
            {SERVICE_CATEGORIES.map((c) => (
              <Link key={c} href={`/services?category=${encodeURIComponent(c)}`} className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200/70 bg-white px-1 py-3 text-center shadow-card transition hover:border-brand-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><CategoryIcon category={c} /></span>
                <span className="text-[11px] font-medium leading-tight text-stone-700">{categoryLabel[c] ?? c}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* New here? */}
        {!u && (
          <section className="mt-8">
            <h2 className="text-lg font-bold text-brand-950">New to CasaVilla?</h2>
            <p className="muted mt-0.5">Create a free account — each person gets their own dashboard, and everything links together.</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                { id: "tenant", title: "Tenant", body: "Apply for homes, pay rent, report repairs", icon: UserRound, tone: "bg-brand-800 text-gold-300" },
                { id: "landlord", title: "Landlord or seller", body: "Let or sell property, track income", icon: HomeIcon, tone: "bg-gold-400 text-brand-950" },
                { id: "provider", title: "Service provider", body: "Offer your services, get hired", icon: Wrench, tone: "bg-brand-800 text-gold-300" },
              ].map((r) => (
                <Link key={r.id} href={`/register?role=${r.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${r.tone}`}><r.icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">{r.title}</span><span className="block text-xs text-stone-500">{r.body}</span></span>
                  <ChevronRight className="h-4 w-4 text-stone-400" />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section id="contact" className="relative mt-10 overflow-hidden rounded-3xl bg-brand-900 p-7 text-white md:flex md:items-center md:justify-between md:p-10">
          <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-white/[0.06]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-gold-300"><Building2 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-widest">Better living starts here</span></div>
            <div className="mt-2 text-2xl font-semibold">Want CasaVilla to manage your property?</div>
            <p className="mt-1 text-sm text-white/70">Call, email or WhatsApp our team on Rubaga Road.</p>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 md:mt-0">
            <a href="https://wa.me/256776593482" className="btn-gold">WhatsApp us</a>
            <a href="tel:+256776593482" className="btn border border-white/30 text-white hover:bg-white/10">+256 776 593 482</a>
          </div>
        </section>
      </div>
    </main>
  );
}
