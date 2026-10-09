import Link from "next/link";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { listedUnits } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Empty } from "@/components/ui";
import { PropertyCard } from "@/components/PropertyCard";
import { LocationPicker } from "@/components/LocationPicker";
import { NearMe } from "@/components/NearMe";
import { crumbText, trailFor } from "@/lib/geo";
import { fmtKm, inUganda } from "@/lib/geo-core";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover homes" };

const budgets = [300000, 500000, 800000, 1200000, 2000000];

export default async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const lat = Number(sp.lat), lng = Number(sp.lng), km = Math.min(50, Math.max(1, Number(sp.km) || 5));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && sp.lat && sp.lng && inUganda(lat, lng) ? { lat, lng, km } : undefined;
  const area = await trailFor(sp.in);
  const homes = await listedUnits({ q: sp.q, max: Number(sp.max) || undefined, beds: Number(sp.beds) || undefined, in: area.length ? sp.in : undefined, near });
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, beds: sp.beds, max: sp.max, in: sp.in, lat: sp.lat, lng: sp.lng, km: sp.km, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/listings${p.size ? `?${p}` : ""}`;
  };
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">Discover</h1>
      <p className="muted mt-0.5">Vacant homes from CasaVilla landlords</p>

      <form className="mt-4 space-y-3">
        {sp.beds && <input type="hidden" name="beds" value={sp.beds} />}
        {near && <><input type="hidden" name="lat" value={sp.lat} /><input type="hidden" name="lng" value={sp.lng} /><input type="hidden" name="km" value={km} /></>}
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
        <details className="rounded-2xl border border-stone-200 bg-white p-3" open={!!area.length}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Filter by area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <div className="mt-3"><LocationPicker name="in" initial={area} label="" compact /></div>
          <button className="btn-primary btn-sm mt-3 w-full">Show homes in this area</button>
        </details>
      </form>

      <div className="-mx-4 mt-3 flex items-start gap-2 overflow-x-auto px-4 pb-1">
        <NearMe />
        <Link href={href({ beds: undefined })} className={!sp.beds ? "chip-active" : "chip"}>Any size</Link>
        {[1, 2, 3, 4].map((b) => (
          <Link key={b} href={href({ beds: String(b) })} className={sp.beds === String(b) ? "chip-active" : "chip"}>{b}+ bedroom{b > 1 ? "s" : ""}</Link>
        ))}
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="h2">{near ? `Within ${fmtKm(km)} of you` : area.length > 1 ? `Homes in ${area[area.length - 1].name}` : sp.q ? `Homes in “${sp.q}”` : "Featured properties"}</h2>
        <span className="text-xs text-stone-500">{homes.length} available</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {homes.map((h) => <PropertyCard key={h.id} h={h} wide />)}
      </div>
      {(near || area.length > 1) && (
        <div className="-mt-1 mb-3 flex flex-wrap gap-2">
          {near && [2, 5, 10, 25].map((k) => <Link key={k} href={href({ km: String(k) })} className={km === k ? "chip-active" : "chip"}>{k} km</Link>)}
          <Link href={href({ in: undefined, lat: undefined, lng: undefined, km: undefined })} className="chip">✕ Clear area</Link>
        </div>
      )}
      {near && <p className="-mt-1 mb-3 text-[11px] text-stone-500">Only homes whose landlord pinned the exact position appear in distance searches.</p>}
      {homes.length === 0 && <Empty title="No homes match your search">{near ? "Try a bigger distance, or filter by area instead." : "Try a wider area or a higher budget."}</Empty>}
    </main>
  );
}
