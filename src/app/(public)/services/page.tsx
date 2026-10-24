import Link from "next/link";
import { ArrowDownUp, BadgeCheck, Check, MapPin, MessageCircle, Search, Star, Wrench, X } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/db";
import { activeProviders } from "@/lib/queries";
import { categoryLabel } from "@/lib/icons";
import { LocationPicker } from "@/components/LocationPicker";
import { SearchBand } from "@/components/ListingParts";
import { CategoryTile, ProviderCard } from "@/components/MarketCards";
import { crumbText, trailFor } from "@/lib/geo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

const sorts = [["", "Top rated"], ["price", "Lowest price"], ["jobs", "Most jobs done"]] as const;

export default async function Services({ searchParams }: { searchParams: Promise<{ category?: string; q?: string; in?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { category, q, in: inId } = sp;
  const area = await trailFor(inId);
  const inArea = area.length > 1 ? inId : undefined;
  const [all, everyone] = await Promise.all([activeProviders(category, inArea), category ? activeProviders(undefined, inArea) : null]);
  // How many providers offer each category (in the chosen area), for the tiles.
  const perCat = new Map(SERVICE_CATEGORIES.map((c) => [c, (everyone ?? all).filter((p) => p.categories.has(c)).length]));
  const needle = q?.trim().toLowerCase();
  const found = needle ? all.filter((p) => [p.name, p.area, p.bio, ...p.categories].some((s) => s?.toLowerCase().includes(needle))) : all;
  const list = [...found].sort(
    sp.sort === "price" ? (a, b) => (a.from ?? Infinity) - (b.from ?? Infinity)
      : sp.sort === "jobs" ? (a, b) => b.jobsDone - a.jobsDone
      : (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.jobsDone - a.jobsDone,
  );
  const keep = { category, q, in: inId, sort: sp.sort };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/services${p.size ? `?${p}` : ""}`;
  };
  const sortLabel = sorts.find(([k]) => k === (sp.sort ?? ""))?.[1] ?? "Top rated";
  const label = category ? categoryLabel[category] ?? category : null;
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I need ${label ? label.toLowerCase() : "help at home"}${area.length > 1 ? ` in ${area[area.length - 1].name}` : ""}.`)}`;

  return (
    <main>
      <SearchBand title="Services for your home" text="Cleaners, plumbers, electricians and more, vetted by CasaVilla and rated by people who hired them.">
        <form className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-float">
          {Object.entries(keep).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Search className="ml-2.5 h-5 w-5 shrink-0 self-center text-stone-400" />
          <input name="q" defaultValue={q} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder="What do you need? e.g. leaking tap, deep clean" enterKeyHint="search" />
          <button className="btn-primary shrink-0 px-4 py-2">Search</button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-gold-300" /> Every provider vetted</li>
          <li className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-gold-300" /> Rated after each job</li>
          <li className="flex items-center gap-1.5"><Wrench className="h-3.5 w-3.5 text-gold-300" /> Track the job in the app</li>
        </ul>
      </SearchBand>

      <div className="mx-auto max-w-6xl px-4 pt-5">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
          {SERVICE_CATEGORIES.map((c) => <CategoryTile key={c} c={c} n={perCat.get(c) ?? 0} on={category === c} href={href({ category: category === c ? undefined : c })} />)}
        </div>

        <details className="mt-4 rounded-2xl border border-stone-200 bg-white p-3" open={area.length > 1}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Who covers my area?{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <form className="mt-3">
            {Object.entries(keep).filter(([k, v]) => k !== "in" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <LocationPicker name="in" initial={area} label="" compact />
            <button className="btn-primary btn-sm mt-3 w-full">Show providers here</button>
          </form>
        </details>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-950">{label ?? "All providers"}{area.length > 1 ? ` in ${area[area.length - 1].name}` : ""}</h2>
            <p className="text-xs text-stone-500">{list.length} provider{list.length === 1 ? "" : "s"}</p>
          </div>
          <details className="relative">
            <summary className="chip cursor-pointer list-none"><ArrowDownUp className="h-3.5 w-3.5" /> {sortLabel}</summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-float">
              {sorts.map(([k, l]) => (
                <Link key={l} href={href({ sort: k || undefined })} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 ${l === sortLabel ? "font-semibold text-brand-800" : "text-stone-700"}`}>{l}{l === sortLabel && <Check className="h-4 w-4" />}</Link>
              ))}
            </div>
          </details>
        </div>
        {(category || q || area.length > 1) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {label && <Link href={href({ category: undefined })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">{label} <X className="h-3 w-3" /></Link>}
            {q && <Link href={href({ q: undefined })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">“{q}” <X className="h-3 w-3" /></Link>}
            {area.length > 1 && <Link href={href({ in: undefined })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">{area[area.length - 1].name} <X className="h-3 w-3" /></Link>}
            <Link href="/services" className="text-xs font-semibold text-stone-500 hover:underline">Clear all</Link>
          </div>
        )}

        {list.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => <ProviderCard key={p.id} p={p} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Wrench className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">No providers found</div>
            <p className="mt-1 text-sm text-stone-500">{area.length > 1 ? "Nobody covers this exact area yet. Try the district instead." : "Try another category or a different search."}</p>
            <Link href="/services" className="btn-outline btn-sm mt-4">See all providers</Link>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white">
            <div>
              <div className="font-semibold">Not sure who to call?</div>
              <p className="text-sm text-white/70">Tell us the problem. We&apos;ll send the right person.</p>
            </div>
            <a href={wa} className="btn-gold"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
          </div>
          <div className="flex flex-col items-start gap-3 rounded-3xl border border-stone-200 bg-white p-5">
            <div>
              <div className="font-semibold text-brand-950">Do you offer a service?</div>
              <p className="text-sm text-stone-500">Get jobs from landlords and tenants across Kampala, and sell supplies in the shop.</p>
            </div>
            <Link href="/register?role=provider" className="btn-outline">Become a provider</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
