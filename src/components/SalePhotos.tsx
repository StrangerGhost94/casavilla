"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Camera, Check, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { analyse, enhance, resize } from "@/lib/photo-check";
import { deleteSalePhoto, setSaleCover, uploadSalePhoto } from "@/app/sale-actions";

/**
 * Pick several photos at once; each is checked and gently brightened if dark, then uploaded in order.
 * The first becomes the cover; tap the star on another to change it.
 */
/** Opens the page at the top after saving (the form left the view scrolled down). */
export function ScrollTop() {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return null;
}

export function SalePhotos({ listingId, photos, highlight = false, doneHref, reviewNote = false }: {
  listingId: number; photos: { id: number; fileId: number; isCover: boolean }[]; highlight?: boolean; doneHref?: string; reviewNote?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [err, setErr] = useState("");

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 20 - photos.length);
    setErr(""); setBusy({ done: 0, total: list.length });
    for (let i = 0; i < list.length; i++) {
      try {
        const f = list[i];
        const r = await analyse(f, "exterior");
        const fix = r.checks.some((c) => !c.ok && /dark|Flat/i.test(c.label));
        const blob = fix ? await enhance(f, r) : await resize(f);
        const fd = new FormData();
        fd.set("listingId", String(listingId));
        fd.set("photo", new File([blob], `photo-${i + 1}.jpg`, { type: "image/jpeg" }));
        const res = await uploadSalePhoto(fd);
        if ("error" in res && res.error) { setErr(res.error); break; }
      } catch { setErr("One photo couldn't be read — try another."); }
      setBusy({ done: i + 1, total: list.length });
    }
    setBusy(null);
    router.refresh();
  };

  return (
    <div className={`card space-y-3 ${highlight ? "border-brand-200 ring-4 ring-brand-100" : ""}`}>
      {highlight && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-[10px] text-white">4</span> Last step · add photos
        </div>
      )}
      <div>
        <div className="font-semibold text-brand-950">{photos.length ? `Photos (${photos.length} of 20)` : "Add photos of the property"}</div>
        <div className="text-xs text-stone-500">{photos.length ? "Tap ★ on a photo to make it the cover." : "Listings with 6 or more clear photos get far more enquiries. You can add more later."}</div>
      </div>
      <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy || photos.length >= 20} className="btn-primary">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading {busy.done}/{busy.total}</> : <><ImagePlus className="h-4 w-4" /> Choose photos</>}
        </button>
        <button type="button" onClick={() => camera.current?.click()} disabled={!!busy || photos.length >= 20} className="btn-outline"><Camera className="h-4 w-4" /> Take a photo</button>
      </div>
      {err && <div role="alert" className="rounded-xl bg-maroon-50 p-2.5 text-sm text-maroon-600">{err}</div>}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <div key={p.id} className="relative overflow-hidden rounded-xl ring-1 ring-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${p.fileId}`} alt="" className="h-24 w-full object-cover" />
              {p.isCover && <span className="absolute left-1 top-1 rounded-full bg-gold-400 px-1.5 text-[9px] font-bold text-brand-950">COVER</span>}
              <div className="absolute bottom-1 right-1 flex gap-1">
                {!p.isCover && (
                  <form action={setSaleCover}><input type="hidden" name="id" value={p.id} /><button aria-label="Make cover" className="rounded-full bg-white/90 p-1 text-gold-600 shadow"><Star className="h-3.5 w-3.5" /></button></form>
                )}
                <form action={deleteSalePhoto}><input type="hidden" name="id" value={p.id} /><button aria-label="Delete photo" className="rounded-full bg-white/90 p-1 text-maroon-600 shadow"><Trash2 className="h-3.5 w-3.5" /></button></form>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[11px] text-stone-500">Tips: shoot in daylight; show the access road, the boundaries or beacons, and the view. For houses, the front, sitting room, kitchen and each bedroom.</p>
      {highlight && photos.length > 0 && doneHref && !busy && (
        <Link href={doneHref} className="btn-primary w-full"><Check className="h-4 w-4" /> Done</Link>
      )}
      {highlight && reviewNote && <p className="text-center text-[11px] text-stone-500">CasaVilla reviews your listing and you&apos;ll be notified as soon as it&apos;s live.</p>}
    </div>
  );
}
