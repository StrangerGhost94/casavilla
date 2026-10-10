import Link from "next/link";
import { BadgeCheck, BedDouble, MapPin, Ruler } from "lucide-react";
import { KIND, perAcre, shortUgx, sizeText, type SaleKind } from "@/lib/sales";
import { Photo } from "./ui";

export type SaleRow = {
  id: number; kind: string; title: string; price: number; negotiable: boolean; location: string; photoId: number | null; status: string;
  sizeValue: number | null; sizeUnit: string | null; plotDims: string | null; bedrooms: number | null; titleStatus: string; titleVerified: boolean;
};

export function SaleCard({ l, href = `/sale/${l.id}` }: { l: SaleRow; href?: string }) {
  const size = sizeText(l);
  const pa = l.kind === "land" || l.kind === "farm" ? perAcre(l) : null;
  return (
    <Link href={href} className="group block overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
      <div className="relative">
        <Photo id={l.photoId} alt={l.title} className="h-48 w-full" />
        <span className="pill absolute left-3 top-3 bg-gold-400 uppercase tracking-wide text-brand-950">For sale</span>
        {l.status === "under_offer" && <span className="pill absolute right-3 top-3 bg-white/95 text-brand-900">Under offer</span>}
      </div>
      <div className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">{KIND[l.kind as SaleKind]?.label ?? l.kind}</div>
        <div className="mt-0.5 line-clamp-2 font-semibold text-brand-950">{l.title}</div>
        <div className="mt-1 flex items-center gap-1 text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{l.location}</span></div>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
          <span className="text-lg font-bold text-brand-900">{shortUgx(l.price)}</span>
          {l.negotiable && <span className="text-[11px] text-stone-500">negotiable</span>}
          {pa && <span className="text-[11px] text-stone-500">· {shortUgx(pa)} per acre</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stone-100 pt-3 text-xs text-stone-600">
          {size && <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-stone-400" /> {size}</span>}
          {l.bedrooms != null && l.bedrooms > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {l.bedrooms} bed</span>}
          {l.titleVerified
            ? <span className="flex items-center gap-1 font-semibold text-brand-700"><BadgeCheck className="h-4 w-4" /> Title verified</span>
            : l.titleStatus === "titled" ? <span className="text-stone-500">Land title</span> : null}
        </div>
      </div>
    </Link>
  );
}
