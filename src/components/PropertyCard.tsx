import Link from "next/link";
import { Bath, BadgeCheck, BedDouble, Camera, MapPin, Sofa, Sparkles, Users } from "lucide-react";
import { ugx } from "@/lib/format";
import { fmtKm } from "@/lib/geo-core";
import { Photo } from "./ui";

export type Listing = { id: number; label: string; rent: number; bedrooms: number; property: string; type: string; location: string; photoId: number | null; distance?: number; verified?: boolean;
  bathrooms?: number; furnished?: boolean; selfContained?: boolean; sizeSqm?: number | null; photos?: number; isNew?: boolean };

/** Every marketplace card shares one shape: a 4:3 photo, the price first, then what and where. */
export function CardShell({ href, photoId, alt, tag, tagTone = "bg-brand-800/90 text-white", verified, corner, photos, isNew, wide = false, className = "", children }: {
  href: string; photoId: number | null; alt: string; tag: string; tagTone?: string; verified?: string | false; corner?: React.ReactNode; photos?: number; isNew?: boolean; wide?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-float ${wide ? "sm:flex" : ""} ${className}`}>
      <div className={`relative aspect-[4/3] overflow-hidden ${wide ? "sm:aspect-auto sm:w-60 sm:shrink-0" : ""}`}>
        <Photo id={photoId} alt={alt} className="absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.05]" />
        {/* Soft shade so the labels read on any photo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/30" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className={`pill text-[10px] uppercase tracking-wide shadow-sm ${tagTone}`}>{tag}</span>
          {isNew && <span className="pill bg-gold-400 text-[10px] uppercase tracking-wide text-brand-950 shadow-sm"><Sparkles className="h-3 w-3" /> New</span>}
        </div>
        {verified && <span className="pill absolute right-3 top-3 bg-white/95 text-[11px] font-semibold text-brand-800 shadow-sm"><BadgeCheck className="h-3.5 w-3.5 text-brand-600" /> {verified}</span>}
        {!!photos && photos > 1 && <span className="pill absolute bottom-3 right-3 bg-black/55 text-[11px] text-white backdrop-blur-sm"><Camera className="h-3.5 w-3.5" /> {photos}</span>}
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

/** "2-bedroom apartment", "Studio", "1-bedroom house" — what people search for, in their words. */
export function homeNoun(type: string) {
  const t = type.toLowerCase();
  return t.includes("apartment") ? "apartment" : t.includes("house") ? "house" : t.includes("hostel") ? "hostel room"
    : t.includes("office") ? "office" : t.includes("commercial") || t.includes("shop") ? "shop space" : "home";
}

export function homeTitle(bedrooms: number, type: string) {
  const noun = homeNoun(type);
  if (noun === "office" || noun === "shop space") return noun[0].toUpperCase() + noun.slice(1);
  return bedrooms ? `${bedrooms}-bedroom ${noun}` : `Studio ${noun}`;
}

export function PropertyCard({ h, wide = false, className = "" }: { h: Listing; wide?: boolean; className?: string }) {
  return (
    <CardShell href={`/listings/${h.id}`} photoId={h.photoId} alt={h.property} tag="For rent" verified={h.verified && "Verified"} photos={h.photos} isNew={h.isNew} wide={wide} className={className}>
      <Price amount={ugx(h.rent)} per="/ month" />
      <div className="mt-1 truncate text-sm font-semibold text-stone-800">{homeTitle(h.bedrooms, h.type)}</div>
      <div className="truncate text-xs text-stone-500">{h.property} · Unit {h.label}</div>
      <Where text={h.location} extra={h.distance != null && <span className="shrink-0 font-semibold text-brand-700">· {fmtKm(h.distance)}</span>} />
      <Facts>
        <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {h.bedrooms || "Studio"}{h.bedrooms ? " bed" : ""}</span>
        {h.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-stone-400" /> {h.bathrooms} bath</span>}
        {h.furnished ? <span className="flex items-center gap-1.5"><Sofa className="h-4 w-4 text-stone-400" /> Furnished</span>
          : h.selfContained ? <span className="text-stone-500">Self-contained</span> : null}
      </Facts>
    </CardShell>
  );
}

export type Stay = {
  id: number; label: string; nightlyRate: number | null; bedrooms: number; maxGuests: number; minNights?: number;
  property: { name: string; location: string; photoId: number | null; verifiedAt?: Date | null; _count?: { photos: number } };
};

/** Short-stay card (nightly price). */
export function StayCard({ u, href = `/stays/${u.id}`, total, className = "" }: { u: Stay; href?: string; total?: number; className?: string }) {
  return (
    <CardShell href={href} photoId={u.property.photoId} alt={u.property.name} tag="Short stay" tagTone="bg-white/95 text-brand-900" verified={!!u.property.verifiedAt && "Verified"} photos={u.property._count?.photos} className={className}>
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
