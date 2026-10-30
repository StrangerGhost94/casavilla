import Link from "next/link";
import { ArrowDownUp, BadgeCheck, Check, PackageSearch, Search, Store, Truck, X } from "lucide-react";
import { PRODUCT_CATEGORIES } from "@/db";
import { getUser } from "@/lib/auth";
import { shopProducts } from "@/lib/queries";
import { SearchBand } from "@/components/ListingParts";
import { ProductCard } from "@/components/MarketCards";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Building Materials, Fittings & Furniture — Shop",
  description: "Buy building materials, plumbing and electrical fittings, paint and furniture from vetted CasaVilla providers in Uganda. Pay the seller on delivery.",
  alternates: { canonical: "/shop" },
};

const sorts = [["", "Newest"], ["low", "Lowest price"], ["high", "Highest price"]] as const;

export default async function Shop({ searchParams }: { searchParams: Promise<{ error?: string; q?: string; seller?: string; sort?: string; stock?: string; sec?: string }> }) {
  const sp = await searchParams;
  const [all, me] = await Promise.all([shopProducts(), getUser()]);
  const sellers = [...new Map(all.map((p) => [p.providerId, p.seller || p.sellerName])).entries()];
  const needle = sp.q?.trim().toLowerCase();
  const seller = Number(sp.seller) || undefined;
  const items = all
    .filter((p) => !seller || p.providerId === seller)
    .filter((p) => !sp.sec || (p.category ?? "Other") === sp.sec)
    .filter((p) => !sp.stock || p.stock > 0)
    .filter((p) => !needle || [p.name, p.description, p.seller, p.sellerName].some((s) => s?.toLowerCase().includes(needle)))
    .sort(sp.sort === "low" ? (a, b) => a.price - b.price : sp.sort === "high" ? (a, b) => b.price - a.price : () => 0);
  const keep = { q: sp.q, seller: sp.seller, sort: sp.sort, stock: sp.stock, sec: sp.sec };
  const sections = PRODUCT_CATEGORIES.map((c) => [c, all.filter((p) => (p.category ?? "Other") === c).length] as const).filter(([, n]) => n > 0);
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/shop${p.size ? `?${p}` : ""}`;
  };
  const sortLabel = sorts.find(([k]) => k === (sp.sort ?? ""))?.[1] ?? "Newest";
  const filtered = !!(needle || seller || sp.stock || sp.sec);

  return (
    <main>
      <SearchBand title="Shop for your home" text="Materials, fittings and supplies from CasaVilla's vetted providers, delivered to your door.">
        <form className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-float">
          {Object.entries(keep).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Search className="ml-2.5 h-5 w-5 shrink-0 self-center text-stone-400" />
          <input name="q" defaultValue={sp.q} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder="e.g. tap, bulbs, paint, water tank" enterKeyHint="search" />
          <button className="btn-primary shrink-0 px-4 py-2">Search</button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <li className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-gold-300" /> Pay the seller on delivery</li>
          <li className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5 text-gold-300" /> Sold by vetted providers</li>
        </ul>
      </SearchBand>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        {sp.error && <div className="mb-4 rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{sp.error}</div>}

        {sections.length > 1 && (
          <div className="-mx-4 mb-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            <Link href={href({ sec: undefined })} className={!sp.sec ? "chip-active" : "chip"}>All sections</Link>
            {sections.map(([c, n]) => <Link key={c} href={href({ sec: sp.sec === c ? undefined : c })} className={sp.sec === c ? "chip-active" : "chip"}>{c} <span className="opacity-60">{n}</span></Link>)}
          </div>
        )}
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={href({ seller: undefined })} className={!seller ? "chip-active" : "chip"}>All sellers</Link>
          {sellers.map(([id, name]) => (
            <Link key={id} href={href({ seller: seller === id ? undefined : String(id) })} className={seller === id ? "chip-active" : "chip"}><Store className="h-3.5 w-3.5" /> {name}</Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          <Link href={href({ stock: sp.stock ? undefined : "1" })} className={sp.stock ? "chip-active" : "chip"}>{sp.stock && <Check className="h-3.5 w-3.5" />}In stock</Link>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-950">{needle ? `Results for “${sp.q}”` : sp.sec ? sp.sec : seller ? sellers.find(([id]) => id === seller)?.[1] : "Everything in the shop"}</h2>
            <p className="text-xs text-stone-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
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
        {filtered && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {needle && <Link href={href({ q: undefined })} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">“{sp.q}” <X className="h-3 w-3" /></Link>}
            <Link href="/shop" className="text-xs font-semibold text-stone-500 hover:underline">Clear all</Link>
          </div>
        )}

        {items.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {items.map((p) => <ProductCard key={p.id} p={p} signedIn={!!me} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><PackageSearch className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">{filtered ? "Nothing matches that" : "No items for sale yet"}</div>
            <p className="mt-1 text-sm text-stone-500">{filtered ? "Try another word or seller." : "Providers are adding supplies. Check back soon."}</p>
            {filtered && <Link href="/shop" className="btn-outline btn-sm mt-4">Clear search</Link>}
          </div>
        )}

        {me && <p className="mt-6 text-center text-xs text-stone-500">Your orders and their delivery status are under <Link href="/orders" className="link">My orders</Link>.</p>}
        <div className="mt-6 flex flex-col items-start gap-3 rounded-3xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-brand-950">Sell supplies to landlords and tenants</div>
            <p className="text-sm text-stone-500">Hardware shops and providers can list items here and get orders straight to their phone.</p>
          </div>
          <Link href="/register?role=provider" className="btn-outline shrink-0">Start selling</Link>
        </div>
      </div>
    </main>
  );
}
