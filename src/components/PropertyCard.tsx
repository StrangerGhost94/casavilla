import Link from "next/link";
import { BadgeCheck, BedDouble, Building2, MapPin, Users } from "lucide-react";
import { ugx } from "@/lib/format";
import { fmtKm } from "@/lib/geo-core";
import { Photo } from "./ui";

export type Listing = { id: number; label: string; rent: number; bedrooms: number; property: string; type: string; location: string; photoId: number | null; distance?: number; verified?: boolean };

/** Every marketplace card shares one shape: a 4:3 photo, the price first, then what and where. */
export function CardShell({ href, photoId, alt, tag, tagTone = "bg-brand-800/90 text-white", verified, corner, wide = false, className = "", children }: {
  href: string; photoId: number | null; alt: string; tag: string; tagTone?: string; verified?: string | false; corner?: React.ReactNode; wide?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-float ${wide ? "sm:flex" : ""} ${className}`}>
      <div className={`relative aspect-[4/3] overflow-hidden ${wide ? "sm:aspect-auto sm:w-60 sm:shrink-0" : ""}`}>
        <Photo id={photoId} alt={alt} className="absolute inset-0 h-full w-full transition duration-300 group-hover:scale-[1.03]" />
        <span className={`pill absolute left-3 top-3 text-[10px] uppercase tracking-wide ${tagTone}`}>{tag}</span>
        {verified && <span className="pill absolute right-3 top-3 bg-white/95 text-[11px] font-semibold text-brand-800 shadow-sm"><BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> {verified}</span>}
        {corner}
      </div>
      <div className="min-w-0 flex-1 p-4">{children}</div>
    </Link>
  );
}

export function Price({ amount, per, note }: { amount: string; per?: string; note?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="text-xl font-bold tracking-tight text-brand-950">{amount}</span>
      {per && <span className="text-xs text-stone-500">{per}</span>}
      {note}
    </div>
  );
}

export function Where({ text, extra }: { text: string; extra?: React.ReactNode }) {
  return <div className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{text}</span>{extra}</div>;
}

export function Facts({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">{children}</div>;
}

export function PropertyCard({ h, wide = false, className = "" }: { h: Listing; wide?: boolean; className?: string }) {
  return (
    <CardShell href={`/listings/${h.id}`} photoId={h.photoId} alt={h.property} tag="For rent" verified={h.verified && "Verified"} wide={wide} className={className}>
      <Price amount={ugx(h.rent)} per="/ month" />
      <div className="mt-1 truncate text-sm font-semibold text-stone-800">{h.bedrooms ? `${h.bedrooms} bedroom` : "Studio"} · {h.property}</div>
      <Where text={h.location} extra={h.distance != null && <span className="shrink-0 font-semibold text-brand-700">· {fmtKm(h.distance)}</span>} />
      <Facts>
        <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {h.bedrooms} bed</span>
        <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 text-stone-400" /> {h.type}</span>
        <span className="text-stone-400">Unit {h.label}</span>
      </Facts>
    </CardShell>
  );
}

export type Stay = {
  id: number; label: string; nightlyRate: number | null; bedrooms: number; maxGuests: number; minNights?: number;
  property: { name: string; location: string; photoId: number | null; verifiedAt?: Date | null };
};

/** Short-stay card (nightly price). */
export function StayCard({ u, href = `/stays/${u.id}`, total, className = "" }: { u: Stay; href?: string; total?: number; className?: string }) {
  return (
    <CardShell href={href} photoId={u.property.photoId} alt={u.property.name} tag="Short stay" tagTone="bg-white/95 text-brand-900" verified={!!u.property.verifiedAt && "Verified"} className={className}>
      <Price amount={ugx(u.nightlyRate ?? 0)} per="/ night" note={total ? <span className="text-xs font-semibold text-stone-600">· {ugx(total)} total</span> : null} />
      <div className="mt-1 truncate text-sm font-semibold text-stone-800">{u.property.name} · {u.label}</div>
      <Where text={u.property.location} />
      <Facts>
        <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {u.bedrooms} bed</span>
        <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-stone-400" /> up to {u.maxGuests}</span>
        {(u.minNights ?? 1) > 1 && <span>min {u.minNights} nights</span>}
      </Facts>
    </CardShell>
  );
}
