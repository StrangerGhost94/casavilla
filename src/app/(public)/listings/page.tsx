import Link from "next/link";
import { AlertButton } from "@/components/AlertButton";
import { ArrowDownUp, Check, MapPin, MessageCircle, Search, X } from "lucide-react";
import { listedUnits, type ListingSort } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { PropertyCard } from "@/components/PropertyCard";
import { LocationPicker } from "@/components/LocationPicker";
import { NearMe } from "@/components/NearMe";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { crumbText, trailFor } from "@/lib/geo";
import { fmtKm, inUganda } from "@/lib/geo-core";
import { waLink } from "@/lib/social";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Houses & Apartments for Rent in Kampala, Wakiso & Mukono",
  description: "Browse houses and apartments for rent in Kampala and across Uganda: prices, photos, video tours and exact locations. Filter by area, bedrooms and budget, book a viewing and pay rent with Mobile Money.",
  alternates: { canonical: "/listings" },
};

const budgets = [300000, 500000, 800000, 1200000, 2000000];
const short = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}k`);
const sorts: [ListingSort, string][] = [["new", "Newest"], ["price_asc", "Lowest price"], ["price_desc", "Highest price"]];

export default async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lat = Number(sp.lat), lng = Number(sp.lng), km = Math.min(50, Math.max(1, Number(sp.km) || 5));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng && inUganda(lat, lng) ? { lat, lng, km } : undefined;
  const area = await trailFor(sp.in);
  const sort = (sorts.find(([k]) => k === sp.sort)?.[0] ?? "new") as ListingSort;
  const homes = await listedUnits({
    q: sp.q, max: Number(sp.max) || undefined, beds: Number(sp.beds) || undefined, in: area.length ? sp.in : undefined, near,
    furnished: sp.furnished === "1", selfContained: sp.sc === "1", sort,
  });
  const keep = { q: sp.q, beds: sp.beds, max: sp.max, in: sp.in, lat: sp.lat, lng: sp.lng, km: sp.km, furnished: sp.furnished, sc: sp.sc, sort: sp.sort };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/listings${p.size ? `?${p}` : ""}`;
  };
  const toggle = (k: string) => href({ [k]: sp[k] === "1" ? undefined : "1" });

  // What's narrowing the list, each removable on its own.
  const active: [string, string][] = [
    ...(sp.q ? [[`“${sp.q}”`, href({ q: undefined })] as [string, string]] : []),
    ...(area.length > 1 ? [[area[area.length - 1].name, href({ in: undefined })] as [string, string]] : []),
    ...(near ? [[`Within ${fmtKm(km)}`, href({ lat: undefined, lng: undefined, km: undefined })] as [string, string]] : []),
    ...(sp.max ? [[`Up to ${ugx(Number(sp.max))}`, href({ max: undefined })] as [string, string]] : []),
    ...(sp.beds ? [[`${sp.beds}+ bedrooms`, href({ beds: undefined })] as [string, string]] : []),
    ...(sp.furnished === "1" ? [["Furnished", href({ furnished: undefined })] as [string, string]] : []),
    ...(sp.sc === "1" ? [["Self-contained", href({ sc: undefined })] as [string, string]] : []),
  ];
  const heading = near ? `Within ${fmtKm(km)} of you` : area.length > 1 ? `Homes in ${area[area.length - 1].name}` : sp.q ? `Homes matching “${sp.q}”` : "Homes to rent";
  const wa = waLink(`Hello CasaVilla, I'm looking for a home to rent${sp.q ? ` in ${sp.q}` : ""}${sp.beds ? `, ${sp.beds}+ bedrooms` : ""}${sp.max ? `, up to ${ugx(Number(sp.max))} a month` : ""}.`);

  return (
    <main>
      {/* Search band, continuing the dark header */}
      <section className="bg-brand-950 text-white">
        <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 md:pb-8 md:pt-8">
          <h1 className="text-2xl font-bold md:text-3xl">Find your next home</h1>
          <p className="mt-0.5 text-sm text-white/70">Vacant homes from CasaVilla landlords, many visited and verified by our team.</p>
          <form className="mt-4 flex gap-2 rounded-2xl bg-white p-1.5 shadow-float">
            {Object.entries(keep).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <Search className="ml-2.5 h-5 w-5 shrink-0 self-center text-stone-400" />
            <input name="q" defaultValue={sp.q} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder="Area, neighbourhood or property name" enterKeyHint="search" />
            <button className="btn-primary shrink-0 px-4 py-2">Search</button>
          </form>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <DiscoverTabs active="rent" />

        {/* Quick filters */}
        <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <NearMe />
          {[1, 2, 3, 4].map((b) => (
            <Link key={b} href={href({ beds: sp.beds === String(b) ? undefined : String(b) })} className={sp.beds === String(b) ? "chip-active" : "chip"}>{b}+ bed</Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          <Link href={toggle("furnished")} className={sp.furnished === "1" ? "chip-active" : "chip"}>{sp.furnished === "1" && <Check className="h-3.5 w-3.5" />}Furnished</Link>
          <Link href={toggle("sc")} className={sp.sc === "1" ? "chip-active" : "chip"}>{sp.sc === "1" && <Check className="h-3.5 w-3.5" />}Self-contained</Link>
        </div>
        <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <span className="shrink-0 text-xs font-semibold text-stone-500">Budget</span>
          {budgets.map((b) => (
            <Link key={b} href={href({ max: sp.max === String(b) ? undefined : String(b) })} className={sp.max === String(b) ? "chip-active" : "chip"}>Under {short(b)}</Link>
          ))}
        </div>

        <details className="mt-3 rounded-2xl border border-stone-200 bg-white p-3" open={area.length > 1}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Choose an area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <form className="mt-3">
            {Object.entries(keep).filter(([k, v]) => k !== "in" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <LocationPicker name="in" initial={area} label="" compact />
            <button className="btn-primary btn-sm mt-3 w-full">Show homes in this area</button>
          </form>
        </details>
        {near && (
          <div className="mt-3 flex flex-wrap gap-2">
            {[2, 5, 10, 25].map((k) => <Link key={k} href={href({ km: String(k) })} className={km === k ? "chip-active" : "chip"}>{k} km</Link>)}
          </div>
        )}

        {/* Results header: count, active filters, sort */}
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-950">{heading}</h2>
            <p className="text-xs text-stone-500">{homes.length} home{homes.length === 1 ? "" : "s"} available{near ? " · only homes with an exact map pin" : ""}</p>
          </div>
          <div className="flex items-center gap-2"><AlertButton kind="rent" params={{ q: sp.q, in: sp.in, beds: sp.beds, max: sp.max, furnished: sp.furnished, sc: sp.sc }} next={href({})} /><details className="group relative">
            <summary className="chip cursor-pointer list-none"><ArrowDownUp className="h-3.5 w-3.5" /> {sorts.find(([k]) => k === sort)![1]}</summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-float">
              {sorts.map(([k, label]) => (
                <Link key={k} href={href({ sort: k === "new" ? undefined : k })} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 ${k === sort ? "font-semibold text-brand-800" : "text-stone-700"}`}>{label}{k === sort && <Check className="h-4 w-4" />}</Link>
              ))}
            </div>
          </details></div>
        </div>
        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {active.map(([label, h]) => (
              <Link key={label} href={h} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">{label} <X className="h-3 w-3" /></Link>
            ))}
            <Link href="/listings" className="text-xs font-semibold text-stone-500 hover:underline">Clear all</Link>
          </div>
        )}

        {homes.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homes.map((h) => <PropertyCard key={h.id} h={h} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Search className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">No homes match all of that</div>
            <p className="mt-1 text-sm text-stone-500">{near ? "Try a bigger distance, or choose an area instead." : "Remove a filter or two, or try a wider area."}</p>
            {active.length > 0 && <Link href="/listings" className="btn-outline btn-sm mt-4">Clear filters</Link>}
          </div>
        )}

        {/* Always offer a person */}
        <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Can&apos;t find the right place?</div>
            <p className="text-sm text-white/70">Tell us what you need. We often have homes before they&apos;re listed.</p>
          </div>
          <a href={wa} className="btn-gold shrink-0"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
        </div>
      </div>
    </main>
  );
}
