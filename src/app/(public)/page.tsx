import Link from "next/link";
import { ChevronRight, ClipboardCheck, KeyRound, LayoutDashboard, MessageCircle, Search, Wallet, Wrench, Building2 } from "lucide-react";
import { db, SERVICE_CATEGORIES, type User } from "@/db";
import { getUser, homeFor } from "@/lib/auth";
import { areaMatch, listedUnits } from "@/lib/queries";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Photo } from "@/components/ui";
import { PropertyCard, StayCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";
import { MarketSearch } from "@/components/MarketSearch";
import { AreaChips } from "@/components/AreaChips";
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

export default async function Home({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const u = await getUser();
  // One chosen area filters every row on the page (only the listed areas are accepted).
  const raw = (await searchParams).area?.trim().toLowerCase();
  const area = AREAS.find((a) => a.toLowerCase() === raw);
  const where = area ? await areaMatch(area) : null;
  const forSale = (kinds: string[]) => db.saleListing.findMany({
    where: { status: { in: ["active", "under_offer"] }, kind: { in: kinds }, ...(where ? { OR: where } : {}) },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }], take: 10,
  });
  const [homes, stays, land, buildings] = await Promise.all([
    listedUnits({ limit: 10, q: area }),
    db.unit.findMany({
      where: { mode: "short", listed: true, nightlyRate: { not: null }, property: { archivedAt: null, landlord: { status: "active" }, ...(where ? { OR: where } : {}) } },
      include: { property: { select: { name: true, location: true, photoId: true, verifiedAt: true } } }, orderBy: { createdAt: "desc" }, take: 10,
    }),
    forSale(["land", "farm"]),
    forSale(["house", "apartment", "commercial"]),
  ]);
  const inArea = area ? ` in ${area}` : "";
  const q = area ? `q=${encodeURIComponent(area)}` : "";
  const hour = (new Date().getUTCHours() + 3) % 24;
  const hello = u ? `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${u.name.split(" ")[0]}` : "Rent, stay or buy in Uganda";
  const nothing = !homes.length && !stays.length && !land.length && !buildings.length;
  const tenant = u?.role === "tenant";
  const join = (next: string) => (u ? next : `/register?role=tenant&next=${encodeURIComponent(next)}`);
  const journey = [
    { icon: Search, title: "Find", body: "Rent, book a stay or buy land. Look for the Verified badge.", href: "/listings" },
    { icon: ClipboardCheck, title: "Move in", body: "Apply, sign the lease and record a move-in inspection in the app.", href: tenant ? "/tenant" : join("/tenant") },
    { icon: Wallet, title: "Pay", body: "Rent and utility bills on Mobile Money, with receipts kept for you.", href: tenant ? "/tenant" : join("/tenant") },
    { icon: Wrench, title: "Fix", body: "Report a repair and a vetted plumber, electrician or cleaner comes.", href: "/services" },
    { icon: Building2, title: "Own", body: "List, sell, or let CasaVilla find tenants and collect rent for you.", href: "/list" },
  ];

  return (
    <main>
      {/* Compact search band: continues the dark header, so listings start high on the screen */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_60%] opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-950 via-brand-950/70 to-brand-950" />
        <div className="relative mx-auto max-w-3xl px-4 pb-9 pt-2 md:pb-14 md:pt-10">
          <h1 className="text-xl font-bold md:text-4xl">{hello}</h1>
          <p className="mt-0.5 hidden text-white/75 md:block">{u ? "What are you looking for today?" : "Homes, short stays, land and property — and everything after you move in."}</p>
          <div className="mt-3 md:mt-5"><MarketSearch /></div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-5 max-w-6xl rounded-t-3xl bg-cream px-4 pt-4 md:rounded-none md:pt-8">
        {u && <div className="mb-4"><MyStrip u={u} /></div>}

        <AreaChips areas={AREAS} active={area} />

        {homes.length > 0 && (
          <Rail title={`Homes to rent${inArea}`} href={`/listings${q ? `?${q}` : ""}`}>
            {homes.map((h) => <PropertyCard key={h.id} h={h} className={CARD} />)}
          </Rail>
        )}
        {land.length > 0 && (
          <Rail title={`Land & plots for sale${inArea}`} href={`/sale?kind=land${q ? `&${q}` : ""}`}>
            {land.map((l) => <SaleCard key={l.id} l={l} className={CARD} />)}
          </Rail>
        )}
        {stays.length > 0 && (
          <Rail title={`Short stays${inArea}`} href="/stays">
            {stays.map((s) => <StayCard key={s.id} u={s} className={CARD} />)}
          </Rail>
        )}
        {buildings.length > 0 && (
          <Rail title={`Houses & buildings for sale${inArea}`} href={`/sale${q ? `?${q}` : ""}`}>
            {buildings.map((l) => <SaleCard key={l.id} l={l} className={CARD} />)}
          </Rail>
        )}
        {nothing && (
          <div className="card mt-6 text-center text-sm text-stone-500">
            {area ? <>Nothing listed{inArea} yet. <Link href="/" scroll={false} className="link">See all areas</Link> or <a href="https://wa.me/256776593482" className="link">ask us on WhatsApp</a> — we often have homes before they&apos;re listed.</> : "New listings are coming soon — check back shortly."}
          </div>
        )}

        {/* Services — a short row; the Services tab has the full list */}
        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="text-lg font-bold text-brand-950">Services for your home</h2>
            <Link href="/services" className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700">See all <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:px-0">
            {SERVICE_CATEGORIES.slice(0, 8).map((c) => (
              <Link key={c} href={`/services?category=${encodeURIComponent(c)}`} className="chip shrink-0 py-2"><CategoryIcon category={c} /> {categoryLabel[c] ?? c}</Link>
            ))}
          </div>
        </section>

        {/* The whole journey in one app: what happens after you find the place */}
        <section className="mt-10 rounded-3xl bg-brand-950 p-5 text-white md:p-10">
          <div className="text-xs font-semibold uppercase tracking-widest text-gold-300">One home, one app</div>
          <h2 className="mt-1 text-xl font-bold md:text-2xl">From finding it to living in it</h2>
          <ol className="relative mt-5 grid grid-cols-1 gap-0 md:grid-cols-5 md:gap-4">
            {journey.map((j, i) => (
              <li key={j.title} className="relative">
                {i < journey.length - 1 && <span aria-hidden className="absolute left-5 top-11 h-[calc(100%-2.25rem)] w-px bg-white/15 md:left-11 md:top-5 md:h-px md:w-[calc(100%-1.75rem)]" />}
                <Link href={j.href} className="relative flex gap-3 rounded-2xl py-2.5 pr-2 transition hover:bg-white/5 md:flex-col md:p-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-brand-950"><j.icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{j.title}</span>
                    <span className="block text-sm leading-snug text-white/65">{j.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
            {!u && <Link href="/register" className="btn-gold">Create a free account</Link>}
            <a href="https://wa.me/256776593482" className="btn border border-white/25 text-white hover:bg-white/10"><MessageCircle className="h-4 w-4" /> WhatsApp CasaVilla</a>
          </div>
        </section>
      </div>
    </main>
  );
}
