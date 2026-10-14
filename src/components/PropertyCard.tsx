import Link from "next/link";
import { BedDouble, Building2, MapPin } from "lucide-react";
import { ugx } from "@/lib/format";
import { fmtKm } from "@/lib/geo-core";
import { Photo } from "./ui";

export type Listing = { id: number; label: string; rent: number; bedrooms: number; property: string; type: string; location: string; photoId: number | null; distance?: number };

export function PropertyCard({ h, wide = false, className = "" }: { h: Listing; wide?: boolean; className?: string }) {
  return (
    <Link href={`/listings/${h.id}`} className={`group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-float ${wide ? "sm:flex" : ""} ${className}`}>
      <div className={`relative ${wide ? "sm:w-56 sm:shrink-0" : ""}`}>
        <Photo id={h.photoId} alt={h.property} className={`w-full ${wide ? "h-44 sm:h-full" : "h-44"}`} />
        <span className="pill absolute left-3 top-3 bg-brand-800/90 uppercase tracking-wide text-white">For rent</span>
      </div>
      <div className="p-4">
        <div className="font-semibold text-brand-950">{h.bedrooms} Bedroom · {h.property}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{h.location}</span>{h.distance != null && <span className="shrink-0 font-semibold text-brand-700">· {fmtKm(h.distance)}</span>}</div>
        <div className="mt-2.5 text-base font-bold text-brand-900">{ugx(h.rent)} <span className="text-xs font-normal text-stone-500">/ month</span></div>
        <div className="mt-3 flex flex-wrap gap-4 border-t border-stone-100 pt-3 text-xs text-stone-600">
          <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {h.bedrooms}</span>
          <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-stone-400" /> {h.type}</span>
          <span className="text-stone-400">Unit {h.label}</span>
        </div>
      </div>
    </Link>
  );
}

export type Stay = { id: number; label: string; nightlyRate: number | null; bedrooms: number; maxGuests: number; property: { name: string; location: string; photoId: number | null } };

/** Short-stay card (nightly price). */
export function StayCard({ u, className = "" }: { u: Stay; className?: string }) {
  return (
    <Link href={`/stays/${u.id}`} className={`group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 ${className}`}>
      <div className="relative"><Photo id={u.property.photoId} alt={u.property.name} className="h-44 w-full" /><span className="pill absolute left-3 top-3 bg-white/95 uppercase tracking-wide text-brand-900">Short stay</span></div>
      <div className="p-4">
        <div className="truncate font-semibold text-brand-950">{u.property.name} · {u.label}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{u.property.location}</span></div>
        <div className="mt-2.5 text-base font-bold text-brand-900">{ugx(u.nightlyRate ?? 0)} <span className="text-xs font-normal text-stone-500">/ night</span></div>
        <div className="mt-2 text-xs text-stone-600">{u.bedrooms} bed · up to {u.maxGuests} guest{u.maxGuests === 1 ? "" : "s"}</div>
      </div>
    </Link>
  );
}
