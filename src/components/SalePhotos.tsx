"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { analyse, enhance, resize } from "@/lib/photo-check";
import { deleteSalePhoto, setSaleCover, uploadSalePhoto } from "@/app/sale-actions";

/**
 * Pick several photos at once; each is checked and gently brightened if dark, then uploaded in order.
 * The first becomes the cover; tap the star on another to change it.
 */
export function SalePhotos({ listingId, photos }: { listingId: number; photos: { id: number; fileId: number; isCover: boolean }[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
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
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-brand-950">Photos</div>
          <div className="text-xs text-stone-500">{photos.length ? `${photos.length} of 20 · tap ★ to choose the cover` : "Add at least one — listings with 6+ clear photos get far more enquiries"}</div>
        </div>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} disabled={!!busy || photos.length >= 20} className="btn-primary btn-sm shrink-0">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> {busy.done}/{busy.total}</> : <><ImagePlus className="h-4 w-4" /> Add photos</>}
        </button>
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
    </div>
  );
}
