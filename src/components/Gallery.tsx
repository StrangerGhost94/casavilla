import { db } from "@/db";
import { PhotoZoom } from "./FileButton";

/** Swipeable listing photos (cover first): the property's shared photos plus the ones taken for this unit. */
export async function Gallery({ propertyId, unitId }: { propertyId: number; unitId?: number }) {
  const photos = await db.propertyPhoto.findMany({
    where: { propertyId, OR: [{ unitId: null }, ...(unitId ? [{ unitId }] : [])] },
    orderBy: [{ isCover: "desc" }, { sort: "asc" }],
  });
  if (photos.length < 2) return null;
  return (
    <section className="mt-6">
      <h2 className="h2">Photos <span className="text-xs font-normal text-stone-500">({photos.length})</span></h2>
      <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {photos.map((p) => (
          <PhotoZoom key={p.id} src={`/api/files/${p.fileId}`} alt={p.label} className="relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-stone-100 text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/files/${p.fileId}`} alt={p.label} loading="lazy" className="h-44 w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">{p.label}</span>
          </PhotoZoom>
        ))}
      </div>
    </section>
  );
}

export function Features({ u }: { u: { bathrooms: number; selfContained: boolean; furnished: boolean; sizeSqm: number | null; amenities: string[] } }) {
  const items = [`${u.bathrooms} bathroom${u.bathrooms === 1 ? "" : "s"}`, u.selfContained ? "Self-contained" : null, u.furnished ? "Furnished" : "Unfurnished", u.sizeSqm ? `${u.sizeSqm} m²` : null, ...u.amenities].filter(Boolean) as string[];
  return (
    <section className="mt-6">
      <h2 className="h2">Features</h2>
      <div className="mt-2 flex flex-wrap gap-1.5">{items.map((i) => <span key={i} className="pill bg-white text-stone-700 ring-1 ring-stone-200">{i}</span>)}</div>
    </section>
  );
}
