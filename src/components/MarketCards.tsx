import Link from "next/link";
import { BadgeCheck, ChevronRight, MapPin, Package, Star, Truck } from "lucide-react";
import { ugx } from "@/lib/format";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { placeOrder } from "@/app/market-actions";
import { Avatar, Photo } from "./ui";
import { Submit } from "./client";

/** "★ 4.6 (12)" — or "New on CasaVilla" before anyone has rated them. */
export function Stars({ rating, count, className = "" }: { rating: number | null; count: number; className?: string }) {
  if (!rating || !count) return <span className={`text-xs text-stone-500 ${className}`}>New on CasaVilla</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${className}`}>
      <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />
      <b className="text-stone-800">{rating.toFixed(1)}</b>
      <span className="text-stone-500">({count})</span>
    </span>
  );
}

export type ProviderRow = { id: number; name: string; area: string | null; bio: string | null; categories: Set<string>; from: number | null; jobsDone: number; ratings: number; rating: number | null };

export function ProviderCard({ p }: { p: ProviderRow }) {
  const cats = [...p.categories];
  return (
    <Link href={`/services/${p.id}`} className="card group flex min-w-0 flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex items-start gap-3.5">
        <div className="relative shrink-0">
          <Avatar name={p.name} className="h-14 w-14 text-base" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white"><BadgeCheck className="h-4 w-4 text-brand-600" /></span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-brand-950 group-hover:underline">{p.name}</div>
          <Stars rating={p.rating} count={p.ratings} className="mt-0.5" />
          <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /> {p.area || "Kampala"}</div>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-300" />
      </div>
      {p.bio && <p className="line-clamp-2 text-sm text-stone-600">{p.bio}</p>}
      <div className="flex flex-wrap gap-1.5">
        {cats.slice(0, 3).map((c) => <span key={c} className="pill bg-brand-50 text-brand-700"><CategoryIcon category={c} className="h-3.5 w-3.5" /> {c}</span>)}
        {cats.length > 3 && <span className="pill bg-stone-100 text-stone-600">+{cats.length - 3}</span>}
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
        <span className="text-stone-500">{p.jobsDone ? `${p.jobsDone} job${p.jobsDone === 1 ? "" : "s"} done` : "Vetted by CasaVilla"}</span>
        {p.from != null ? <span className="font-semibold text-stone-800">From {ugx(p.from)}</span> : <span className="font-semibold text-brand-700">Get a quote</span>}
      </div>
    </Link>
  );
}

export type ProductRow = { id: number; name: string; description: string | null; price: number; stock: number; photoId: number | null; providerId: number; seller: string | null; sellerName: string; category?: string | null };

/** A shop item. Signed-in buyers order in place; others are sent to sign in and come back. */
export function ProductCard({ p, signedIn, next = "/shop" }: { p: ProductRow; signedIn: boolean; next?: string }) {
  const low = p.stock > 0 && p.stock <= 3;
  return (
    <div className="card group flex flex-col overflow-hidden p-0 transition hover:shadow-float">
      <div className="relative aspect-[4/3] overflow-hidden">
        <Photo id={p.photoId} alt={p.name} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.04]" sizes="(min-width: 1024px) 300px, (min-width: 640px) 33vw, 50vw" />
        {p.stock === 0 ? <span className="pill absolute left-2 top-2 bg-stone-900/80 text-[10px] text-white sm:left-3 sm:top-3">Sold out</span>
          : low ? <span className="pill absolute left-2 top-2 bg-gold-400 text-[10px] text-brand-950 sm:left-3 sm:top-3">Only {p.stock} left</span> : null}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <div className="text-base font-bold tracking-tight text-brand-950 sm:text-lg">{ugx(p.price)}</div>
        <div className="mt-0.5 line-clamp-2 text-sm font-semibold text-stone-800 sm:text-base">{p.name}</div>
        <Link href={`/services/${p.providerId}`} className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-stone-500 hover:underline sm:text-xs"><BadgeCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" /> <span className="truncate">{p.seller || p.sellerName}</span></Link>
        {p.description && <p className="mt-2 line-clamp-2 hidden text-sm text-stone-600 sm:block">{p.description}</p>}
        <div className="mt-auto pt-3 sm:pt-4">
          {p.stock === 0 ? (
            <div className="rounded-xl bg-stone-100 py-2 text-center text-xs font-semibold text-stone-500">Out of stock</div>
          ) : signedIn ? (
            <details className="group/order">
              <summary className="btn-primary btn-sm w-full cursor-pointer list-none group-open/order:hidden"><Package className="h-4 w-4" /> Order</summary>
              <form action={placeOrder} className="space-y-2">
                <input type="hidden" name="productId" value={p.id} />
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-stone-500" htmlFor={`q${p.id}`}>Qty</label>
                  <input id={`q${p.id}`} type="number" name="quantity" min={1} max={p.stock} defaultValue={1} className="input w-16 px-2 py-2" />
                  <span className="hidden text-[11px] text-stone-400 sm:inline">{p.stock} in stock</span>
                </div>
                <input name="deliveryNote" className="input py-2" placeholder="Where to deliver, and when" />
                <Submit className="btn-primary btn-sm w-full">Place order</Submit>
              </form>
            </details>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="btn-outline btn-sm w-full">Sign in to order</Link>
          )}
          <div className="mt-2 hidden items-center justify-center gap-1 text-[11px] text-stone-400 sm:flex"><Truck className="h-3 w-3" /> Pay the seller on delivery</div>
        </div>
      </div>
    </div>
  );
}

/** Category tile for the services page. */
export function CategoryTile({ c, n, on, href }: { c: string; n: number; on: boolean; href: string }) {
  return (
    <Link href={href} aria-current={on ? "page" : undefined}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-3 text-center shadow-card transition hover:-translate-y-0.5 ${on ? "border-brand-800 bg-brand-800 text-white" : "border-stone-200/70 bg-white hover:border-brand-200"}`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-white/10 text-gold-300" : "bg-brand-50 text-brand-700"}`}><CategoryIcon category={c} /></span>
      <span className={`text-[11px] font-semibold leading-tight ${on ? "text-white" : "text-stone-700"}`}>{categoryLabel[c] ?? c}</span>
      <span className={`text-[10px] ${on ? "text-white/70" : "text-stone-400"}`}>{n || "—"}</span>
    </Link>
  );
}
