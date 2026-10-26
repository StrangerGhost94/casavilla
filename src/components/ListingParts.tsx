import Link from "next/link";
import { ArrowLeft, Check, Map as MapIcon, MapPin, Navigation, Share2 } from "lucide-react";
import { MiniMap } from "./MiniMap";
import type { LucideIcon } from "lucide-react";

/** Dark band under the header with a title, a line of context and (usually) a search box. */
export function SearchBand({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="bg-brand-950 text-white">
      <div className="mx-auto max-w-6xl px-4 pb-6 pt-4 md:pb-8 md:pt-8">
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="mt-0.5 text-sm text-white/70">{text}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

/** Round back and share buttons laid over a listing's photos. */
export function PhotoButtons({ back, backLabel, share }: { back: string; backLabel: string; share: string }) {
  const btn = "absolute top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-card backdrop-blur";
  return (
    <>
      <Link href={back} aria-label={backLabel} className={`${btn} left-4`}><ArrowLeft className="h-5 w-5" /></Link>
      <a href={share} target="_blank" rel="noreferrer" aria-label="Share on WhatsApp" className={`${btn} right-4`}><Share2 className="h-5 w-5" /></a>
    </>
  );
}

/** WhatsApp "share with a friend" link for a listing. */
export const shareLink = (text: string, path: string) => `https://wa.me/?text=${encodeURIComponent(`${text} ${process.env.APP_URL ?? ""}${path}`)}`;

/** Row of icon tiles: the few facts people compare first. */
export function FactTiles({ facts }: { facts: [LucideIcon, string, string][] }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {facts.map(([Icon, v, l]) => (
        <div key={l} className="flex flex-col items-center gap-1 rounded-2xl border border-stone-200/70 bg-white px-2 py-3 text-center">
          <Icon className="h-5 w-5 text-brand-700" />
          <span className="text-sm font-semibold text-brand-950">{v}</span>
          <span className="text-[10px] text-stone-500">{l}</span>
        </div>
      ))}
    </div>
  );
}

/** Ticked list of what a place offers. */
export function Checklist({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-6">
      <h2 className="h2">{title}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {items.map((a) => <li key={a} className="flex items-center gap-2 text-sm text-stone-700"><Check className="h-4 w-4 shrink-0 text-brand-600" />{a}</li>)}
      </ul>
    </section>
  );
}

/** Phones: the price and the main action, pinned above the tab bar. */
export function ActionBar({ price, per, sub, children }: { price: string; per?: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="action-bar fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-stone-200 bg-white/95 px-4 py-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-brand-950">{price}{per && <span className="text-xs font-normal text-stone-500"> {per}</span>}</div>
          <div className="truncate text-[11px] text-stone-500">{sub}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** "Location" section: map with the pin when the exact spot is known, the address, and directions. */
export function LocationCard({ address, landmark, lat, lng }: { address: string; landmark?: string | null; lat?: number | null; lng?: number | null }) {
  const pinned = lat != null && lng != null;
  const q = pinned ? `${lat},${lng}` : `${address}, Uganda`;
  return (
    <section className="mt-6">
      <h2 className="h2">Location</h2>
      <div className="card mt-2 overflow-hidden p-0">
        {pinned && <MiniMap lat={lat!} lng={lng!} label={address} />}
        <div className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-medium text-stone-800">{address}</div>
            {landmark && <div className="break-words text-xs text-stone-500">{landmark}</div>}
            {!pinned && <div className="text-[11px] text-stone-400">Approximate area. The exact spot is shared when you arrange a viewing.</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-stone-100 text-sm font-semibold">
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 text-brand-700 hover:bg-stone-50"><MapIcon className="h-4 w-4" /> View on map</a>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 border-l border-stone-100 py-2.5 text-brand-700 hover:bg-stone-50"><Navigation className="h-4 w-4" /> Directions</a>
        </div>
      </div>
    </section>
  );
}
