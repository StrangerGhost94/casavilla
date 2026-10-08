import Link from "next/link";
import { listedUnits } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Empty, Photo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Homes for rent" };

export default async function Listings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const homes = await listedUnits({ q: sp.q, max: Number(sp.max) || undefined, beds: Number(sp.beds) || undefined });
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="h1">Homes for rent</h1>
      <form className="mt-4 grid gap-2 sm:grid-cols-4">
        <input name="q" defaultValue={sp.q} className="input sm:col-span-2" placeholder="Area or property name" />
        <select name="beds" defaultValue={sp.beds} className="input">
          <option value="">Any bedrooms</option>
          {[1, 2, 3, 4].map((b) => <option key={b} value={b}>{b}+ bedrooms</option>)}
        </select>
        <div className="flex gap-2">
          <input name="max" defaultValue={sp.max} type="number" className="input" placeholder="Max rent (UGX)" />
          <button className="btn-primary">Filter</button>
        </div>
      </form>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {homes.map((h) => (
          <Link key={h.id} href={`/listings/${h.id}`} className="card overflow-hidden p-0 hover:shadow-md">
            <Photo id={h.photoId} alt={h.property} className="h-44 w-full" />
            <div className="p-4">
              <div className="font-semibold text-stone-900">{h.property} · {h.label}</div>
              <div className="muted">{h.location} · {h.type} · {h.bedrooms} bed</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-brand-600">{ugx(h.rent)}<span className="text-xs font-normal text-stone-500"> / month</span></span>
                <span className="text-xs text-stone-500">Landlord: {h.landlord}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {homes.length === 0 && <div className="mt-6"><Empty title="No homes match your search">Try a wider area or higher budget.</Empty></div>}
    </main>
  );
}
