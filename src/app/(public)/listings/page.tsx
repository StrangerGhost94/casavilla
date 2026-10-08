import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { listedUnits } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Empty } from "@/components/ui";
import { PropertyCard } from "@/components/PropertyCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover homes" };

const budgets = [300000, 500000, 800000, 1200000, 2000000];

export default async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const homes = await listedUnits({ q: sp.q, max: Number(sp.max) || undefined, beds: Number(sp.beds) || undefined });
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, beds: sp.beds, max: sp.max, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/listings${p.size ? `?${p}` : ""}`;
  };
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">Discover</h1>
      <p className="muted mt-0.5">Vacant homes from CasaVilla landlords</p>

      <form className="mt-4 space-y-3">
        {sp.beds && <input type="hidden" name="beds" value={sp.beds} />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
          <input name="q" defaultValue={sp.q} className="input pl-11 pr-24" placeholder="Search location, property or neighbourhood" />
          <button className="btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2 py-2">Search</button>
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-stone-400" />
          <select name="max" defaultValue={sp.max ?? ""} className="input w-auto py-2 text-xs">
            <option value="">Any price</option>
            {budgets.map((b) => <option key={b} value={b}>Up to {ugx(b)}</option>)}
          </select>
          <button className="chip">Apply</button>
        </div>
      </form>

      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={href({ beds: undefined })} className={!sp.beds ? "chip-active" : "chip"}>Any size</Link>
        {[1, 2, 3, 4].map((b) => (
          <Link key={b} href={href({ beds: String(b) })} className={sp.beds === String(b) ? "chip-active" : "chip"}>{b}+ bedroom{b > 1 ? "s" : ""}</Link>
        ))}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="h2">{sp.q ? `Homes in “${sp.q}”` : "Featured properties"}</h2>
        <span className="text-xs text-stone-500">{homes.length} available</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {homes.map((h) => <PropertyCard key={h.id} h={h} wide />)}
      </div>
      {homes.length === 0 && <Empty title="No homes match your search">Try a wider area or a higher budget.</Empty>}
    </main>
  );
}
