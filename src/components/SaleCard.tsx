import { BedDouble, Ruler } from "lucide-react";
import { KIND, perAcre, shortUgx, sizeText, type SaleKind } from "@/lib/sales";
import { CardShell, Facts, Price, Where } from "./PropertyCard";

export type SaleRow = {
  id: number; kind: string; title: string; price: number; negotiable: boolean; location: string; photoId: number | null; status: string;
  sizeValue: number | null; sizeUnit: string | null; plotDims: string | null; bedrooms: number | null; titleStatus: string; titleVerified: boolean;
};

export function SaleCard({ l, href = `/sale/${l.id}`, className = "" }: { l: SaleRow; href?: string; className?: string }) {
  const size = sizeText(l);
  const pa = l.kind === "land" || l.kind === "farm" ? perAcre(l) : null;
  return (
    <CardShell href={href} photoId={l.photoId} alt={l.title} tag={`For sale · ${KIND[l.kind as SaleKind]?.label ?? l.kind}`} tagTone="bg-gold-400 text-brand-950"
      verified={l.titleVerified && "Title verified"}
      corner={l.status === "under_offer" && <span className="pill absolute bottom-3 left-3 bg-brand-950/85 text-white">Under offer</span>}
      className={className}>
      <Price amount={shortUgx(l.price)} note={<>
        {l.negotiable && <span className="text-[11px] text-stone-500">negotiable</span>}
        {pa && <span className="text-[11px] text-stone-500">· {shortUgx(pa).replace("UGX ", "")}/acre</span>}
      </>} />
      <div className="mt-1 line-clamp-1 text-sm font-semibold text-stone-800">{l.title}</div>
      <Where text={l.location} />
      <Facts>
        {size && <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-stone-400" /> {size}</span>}
        {l.bedrooms != null && l.bedrooms > 0 && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-stone-400" /> {l.bedrooms} bed</span>}
        {!l.titleVerified && l.titleStatus === "titled" && <span className="text-stone-500">Has land title</span>}
      </Facts>
    </CardShell>
  );
}
