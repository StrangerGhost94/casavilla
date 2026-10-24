import Link from "next/link";
import { BadgeCheck, BedDouble, Building2, ChevronRight, KeyRound, LayoutDashboard, ShoppingBag, Trees, Wallet, Wrench } from "lucide-react";
import { db, SERVICE_CATEGORIES, type User } from "@/db";
import { getUser, homeFor } from "@/lib/auth";
import { areaMatch, listedUnits } from "@/lib/queries";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { Photo } from "@/components/ui";
import { PropertyCard, StayCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";
import { MarketSearch } from "@/components/MarketSearch";
import { Journey } from "@/components/Journey";
import { MobileFooter } from "@/components/SiteFooter";
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
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }], take: 10, include: { _count: { select: { photos: true } } },
  });
  const liveLandlord = { archivedAt: null, landlord: { status: "active" as const } };
  const [homes, stays, land, buildings, counts, products] = await Promise.all([
    listedUnits({ limit: 10, q: area }),
    db.unit.findMany({
      where: { mode: "short", listed: true, nightlyRate: { not: null }, property: { archivedAt: null, landlord: { status: "active" }, ...(where ? { OR: where } : {}) } },
      include: { property: { select: { name: true, location: true, photoId: true, verifiedAt: true } } }, orderBy: { createdAt: "desc" }, take: 10,
    }),
    forSale(["land", "farm"]),
    forSale(["house", "apartment", "commercial"]),
    Promise.all([
      db.unit.count({ where: { listed: true, status: "vacant", mode: "long", property: liveLandlord } }),
      db.unit.count({ where: { mode: "short", listed: true, nightlyRate: { not: null }, property: liveLandlord } }),
      db.saleListing.count({ where: { status: { in: ["active", "under_offer"] }, kind: { in: ["land", "farm"] } } }),
      db.saleListing.count({ where: { status: { in: ["active", "under_offer"] }, kind: { in: ["house", "apartment", "commercial"] } } }),
      db.user.count({ where: { role: "provider", status: "active" } }),
      db.product.count({ where: { active: true, stock: { gt: 0 }, provider: { status: "active" } } }),
    ]),
    db.product.findMany({ where: { active: true, stock: { gt: 0 }, provider: { status: "active" } }, orderBy: { id: "desc" }, take: 8, select: { id: true, name: true, price: true, photoId: true } }),
  ]);
  const [nRent, nStays, nLand, nHouses, nPros, nShop] = counts;
  const categories: [string, string, React.ComponentType<{ className?: string }>, number, string][] = [
    ["/listings", "Homes to rent", KeyRound, nRent, "home"],
    ["/stays", "Short stays", BedDouble, nStays, "stay"],
    ["/sale?kind=land", "Land & plots", Trees, nLand, "plot"],
    ["/sale", "Houses for sale", Building2, nHouses, "listing"],
    ["/services", "Home services", Wrench, nPros, "provider"],
    ["/shop", "Shop", ShoppingBag, nShop, "item"],
  ];
  const inArea = area ? ` in ${area}` : "";
  const q = area ? `q=${encodeURIComponent(area)}` : "";
  const hour = (new Date().getUTCHours() + 3) % 24;
  const hello = u ? `Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${u.name.split(" ")[0]}` : "Rent, stay or buy in Uganda";
  const nothing = !homes.length && !stays.length && !land.length && !buildings.length;

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
          {!u && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80 md:mt-4 md:text-sm">
              {["Verified landlords & listings", "Pay rent by MTN or Airtel MoMo", "Repairs handled after you move in"].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-gold-300 md:h-4 md:w-4" />{t}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-5 max-w-6xl rounded-t-3xl bg-cream px-4 pt-4 md:rounded-none md:pt-8">
        {u && <div className="mb-4"><MyStrip u={u} /></div>}

        <nav aria-label="Browse the marketplace" className="mb-5 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
          {categories.map(([href, label, I, n, unit]) => (
            <Link key={href} href={href} className="card flex flex-col items-center gap-1.5 px-2 py-3 text-center transition hover:-translate-y-0.5 hover:border-brand-200 md:py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><I className="h-5 w-5" /></span>
              <span className="text-xs font-semibold leading-tight text-brand-950 md:text-sm">{label}</span>
              <span className="text-[10px] text-stone-500 md:text-xs">{n ? `${n} ${unit}${n === 1 ? "" : "s"}` : "Coming soon"}</span>
            </Link>
          ))}
        </nav>

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

        {products.length > 0 && (
          <Rail title="Shop for your home" href="/shop">
            {products.map((p) => (
              <Link key={p.id} href="/shop" className="card w-[42vw] max-w-[11rem] shrink-0 snap-start overflow-hidden p-0 transition hover:-translate-y-0.5">
                <Photo id={p.photoId} alt={p.name} className="h-28 w-full" sizes="(min-width: 768px) 240px, 42vw" />
                <div className="p-3">
                  <div className="truncate text-sm font-semibold text-stone-800">{p.name}</div>
                  <div className="text-sm font-bold text-brand-700">{ugx(p.price)}</div>
                </div>
              </Link>
            ))}
          </Rail>
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

        <Journey signedIn={!!u} tenant={u?.role === "tenant"} />
        <MobileFooter />
      </div>
    </main>
  );
}
