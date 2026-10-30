import { BedDouble, Bath, Layers, Ruler } from "lucide-react";
import { PLAN_STYLES, PROJECT_KINDS, buildCost, type PlanStyle, type ProjectKind } from "@/lib/build";
import { shortUgx } from "@/lib/sales";
import { planHref } from "@/lib/seo";
import { fileSrcSet, fileUrl } from "@/lib/file-url";
import { CardShell, Facts, Price } from "./PropertyCard";

export type PlanRow = {
  id: number; title: string; style: string; bedrooms: number | null; bathrooms: number | null; floors: number; areaSqm: number | null;
  price: number; buildFrom: number | null; buildTo: number | null; photoId: number | null; summary: string | null; _count?: { photos: number };
};

/** A ready-made CasaVilla house plan: the drawings' price, then the estimated cost to build it. */
export function PlanCard({ p, className = "" }: { p: PlanRow; className?: string }) {
  const cost = buildCost(p);
  return (
    <CardShell href={planHref(p)} photoId={p.photoId} alt={p.title} tag={`House plan · ${PLAN_STYLES[p.style as PlanStyle]?.label ?? p.style}`}
      tagTone="bg-brand-800/90 text-white" photos={p._count?.photos} className={className}>
      <Price amount={p.price ? shortUgx(p.price) : "Free with a build"} per={p.price ? "plan" : undefined} />
      <div className="mt-1 line-clamp-1 text-sm font-semibold text-stone-800">{p.title}</div>
      {cost && <div className="mt-1 text-xs text-stone-500">Build cost about <b className="text-brand-800">{cost}</b></div>}
      <Facts>
        {p.bedrooms != null && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {p.bedrooms} bed</span>}
        {p.bathrooms != null && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4 text-stone-400" /> {p.bathrooms} bath</span>}
        {p.floors > 1 && <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-stone-400" /> {p.floors} floors</span>}
        {p.areaSqm && <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-stone-400" /> {p.areaSqm} m²</span>}
      </Facts>
    </CardShell>
  );
}

/** A finished CasaVilla project, for the "Our work" gallery. */
export function ProjectCard({ p }: { p: { id: number; title: string; kind: string; location: string; year: number | null; summary: string | null; photoId: number | null } }) {
  return (
    <figure className="overflow-hidden rounded-3xl border border-stone-200/70 bg-white shadow-card">
      <div className="aspect-[4/3] bg-brand-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.photoId && <img src={fileUrl(p.photoId, 640)} srcSet={fileSrcSet(p.photoId, [320, 640, 1024])} sizes="(min-width: 768px) 33vw, 85vw" alt={`${p.title}, ${p.location}`} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <figcaption className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">{PROJECT_KINDS[p.kind as ProjectKind] ?? p.kind}{p.year ? ` · ${p.year}` : ""}</div>
        <div className="mt-0.5 font-semibold text-brand-950">{p.title}</div>
        <div className="text-xs text-stone-500">{p.location}</div>
        {p.summary && <p className="mt-2 line-clamp-3 text-sm text-stone-600">{p.summary}</p>}
      </figcaption>
    </figure>
  );
}
