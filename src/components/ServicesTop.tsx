import Link from "next/link";
import { BadgeCheck, ChevronRight, HardHat, Search, Star, Wrench } from "lucide-react";
import { BUILD_CATEGORIES, SERVICE_CATEGORIES } from "@/db";
import { SearchBand } from "./ListingParts";
import { CategoryTile } from "./MarketCards";

/**
 * The top of the Services page: heading, search and category tiles. None of it waits for data, so the loading
 * screen shows the same thing and only the provider cards fill in below (nothing jumps).
 */
export function ServicesTop({ q, keep = {}, category, counts, href = (patch) => (patch.category ? `/services?category=${encodeURIComponent(patch.category)}` : "/services") }: {
  q?: string; keep?: Record<string, string | undefined>; category?: string; counts?: Map<string, number>; href?: (patch: Record<string, string | undefined>) => string;
}) {
  const perCat = counts ?? new Map<string, number>();
  return (
    <>
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

        {/* Construction and house plans are CasaVilla's own service; interiors and materials stay with providers and the shop */}
        <section className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Link href="/build" className="group relative flex items-center gap-4 overflow-hidden rounded-3xl bg-brand-900 p-5 text-white md:col-span-2">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><HardHat className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-300">Building or renovating?</span>
              <span className="block text-lg font-bold">Build with CasaVilla</span>
              <span className="block text-sm text-white/75">House plans, approvals and construction — designed and built by CasaVilla.</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-white/60 group-hover:text-white" />
          </Link>
          <div className="flex flex-col gap-2 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-card">
            <div className="text-sm font-bold text-brand-950">Fit-out</div>
            <div className="grid grid-cols-2 gap-2">
              {BUILD_CATEGORIES.map((c) => <CategoryTile key={c} c={c} n={perCat.get(c) ?? 0} on={category === c} href={href({ category: category === c ? undefined : c })} />)}
              <Link href="/shop?sec=Building%20materials" className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-stone-300 px-1 py-3 text-center text-[11px] font-semibold text-stone-600 hover:border-brand-300">Building materials<span className="text-[10px] font-normal text-stone-400">in the shop</span></Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
