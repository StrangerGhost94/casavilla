import { db } from "@/db";
import { PhotoZoom } from "./FileButton";
import { fileSrcSet, fileUrl } from "@/lib/file-url";
import { Photo } from "./ui";

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
          <PhotoZoom key={p.id} src={fileUrl(p.fileId, 1600)} alt={p.label} className="relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-stone-100 text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(p.fileId, 640)} srcSet={fileSrcSet(p.fileId, [320, 640])} sizes="16rem" alt={p.label} loading="lazy" decoding="async" className="h-44 w-full object-cover" />
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

type MosaicPhoto = { id: number; fileId: number; label: string };

/** Property photos (shared + this unit's), cover first, as a mosaic / swipe strip. */
export async function ListingPhotos({ propertyId, unitId, coverId, alt, overlay }: { propertyId: number; unitId?: number; coverId: number | null; alt: string; overlay?: React.ReactNode }) {
  const photos = await db.propertyPhoto.findMany({
    where: { propertyId, OR: [{ unitId: null }, ...(unitId ? [{ unitId }] : [])] },
    orderBy: [{ isCover: "desc" }, { sort: "asc" }],
    select: { id: true, fileId: true, label: true },
  });
  return <PhotoMosaic photos={photos.length ? photos : coverId ? [{ id: 0, fileId: coverId, label: alt }] : []} alt={alt} overlay={overlay} />;
}

/**
 * A listing's hero: on phones a full-width swipe strip with a photo counter, on wider screens a mosaic
 * (one big photo and up to four small). Every photo opens full screen. No photos: the placeholder.
 */
export function PhotoMosaic({ photos: list, alt, overlay }: { photos: MosaicPhoto[]; alt: string; overlay?: React.ReactNode }) {
  if (!list.length) return <div className="relative"><Photo id={null} alt={alt} className="h-72 w-full md:h-96 md:rounded-3xl" />{overlay}</div>;
  const shown = list.length >= 5 ? 5 : list.length >= 3 ? 3 : 1;
  const img = (p: MosaicPhoto, sizes: string, eager: boolean) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fileUrl(p.fileId, 1024)} srcSet={fileSrcSet(p.fileId, [320, 640, 1024, 1600])} sizes={sizes} alt={p.label} loading={eager ? "eager" : "lazy"} decoding="async" className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" />
  );
  return (
    <div className="relative">
      {/* Phones: swipe */}
      <div className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:hidden">
        {list.map((p, i) => (
          <PhotoZoom key={p.id || i} src={fileUrl(p.fileId, 1600)} alt={p.label} className="relative h-72 w-full shrink-0 snap-center overflow-hidden bg-stone-200">
            {img(p, "100vw", i === 0)}
            {list.length > 1 && <span className="absolute bottom-9 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white">{i + 1} / {list.length}</span>}
          </PhotoZoom>
        ))}
      </div>
      {/* Wider screens: mosaic */}
      <div className={`hidden gap-2 overflow-hidden rounded-3xl md:grid ${shown === 5 ? "h-[26rem] grid-cols-4 grid-rows-2" : shown === 3 ? "h-[24rem] grid-cols-3 grid-rows-2" : "h-96 grid-cols-1"}`}>
        {list.slice(0, shown).map((p, i) => (
          <PhotoZoom key={p.id || i} src={fileUrl(p.fileId, 1600)} alt={p.label} className={`relative overflow-hidden bg-stone-200 ${i === 0 && shown > 1 ? "col-span-2 row-span-2" : ""}`}>
            {img(p, i === 0 ? "(min-width: 1024px) 50vw, 66vw" : "25vw", true)}
            {i === shown - 1 && list.length > shown && <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-semibold text-white">+{list.length - shown} more</span>}
          </PhotoZoom>
        ))}
      </div>
      {overlay}
    </div>
  );
}
