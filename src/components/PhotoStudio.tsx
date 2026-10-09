"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronDown, ImagePlus, Loader2, RotateCcw, Sparkles, Star, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import { analyse, enhance, resize, shotList, ROOM_TIPS, type PhotoReport, type Shot } from "@/lib/photo-check";
import { deletePhoto, retagPhoto, setCoverPhoto, uploadListingPhoto } from "@/app/photo-actions";

type Photo = { id: number; fileId: number; room: string; label: string; unitId: number | null; isCover: boolean; quality: number | null };
type UnitInfo = { id: number; label: string; bedrooms: number; bathrooms: number };
type Item = {
  key: string; original: Blob; file: Blob; preview: string; report: PhotoReport | null; enhanced: boolean;
  slot: string; replaceId?: number; status: "checking" | "ready" | "uploading" | "done" | "error"; error?: string;
};

const OTHER: Shot = { key: "other", room: "other", label: "Other photo", unitId: null, required: false };
const baseLabel = (l: string) => l.replace(/ · \d+$/, "");

/**
 * One screen for listing photos:
 *  1. Pick several photos at once (or shoot them) — each is checked and, if dark or flat, enhanced automatically.
 *  2. Each photo is pre-tagged with the next room still missing; fix any tag with one tap.
 *  3. Upload all together. Empty slots in the checklist open the camera straight into that room.
 */
export function PhotoStudio({ propertyId, units, photos }: { propertyId: number; units: UnitInfo[]; photos: Photo[] }) {
  const router = useRouter();
  const shots = useMemo(() => shotList(units, units.length > 1), [units]);
  const slotByKey = useMemo(() => new Map([...shots, OTHER].map((s) => [s.key, s])), [shots]);
  const [queue, setQueue] = useState<Item[]>([]);
  const [uploading, setUploading] = useState(false);
  const [manage, setManage] = useState<Photo | null>(null);
  const multiInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const target = useRef<{ slot: string; replaceId?: number; auto: boolean } | null>(null);

  const filledBy = (s: Shot) => photos.find((p) => baseLabel(p.label) === s.label && p.unitId === s.unitId);
  const required = shots.filter((s) => s.required);
  const doneCount = required.filter((s) => filledBy(s)).length;
  const pct = required.length ? Math.round((doneCount / required.length) * 100) : 0;

  /** Next room still missing (not on the listing yet and not already tagged in the queue). */
  const nextFree = (taken: Set<string>) => shots.find((s) => !filledBy(s) && !taken.has(s.key))?.key ?? "other";

  const process = async (key: string, f: Blob, room: string) => {
    try {
      const r = await analyse(f, room);
      const needsFix = r.checks.some((c) => !c.ok && /dark|bright|contrast|Flat/i.test(c.label));
      const file = needsFix ? await enhance(f, r) : await resize(f);
      const report = needsFix ? await analyse(file, room) : r;
      setQueue((q) => q.map((i) => (i.key === key ? { ...i, file, report, enhanced: needsFix, status: "ready" } : i)));
      return { file, report };
    } catch {
      setQueue((q) => q.map((i) => (i.key === key ? { ...i, status: "error", error: "Not a readable photo" } : i)));
      return null;
    }
  };

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    const t = target.current; target.current = null;
    const taken = new Set(queue.map((i) => i.slot));
    const items: Item[] = [...files].slice(0, 20).map((f, n) => {
      const slot = t?.slot && n === 0 ? t.slot : nextFree(taken);
      if (slot !== "other") taken.add(slot);
      return { key: `${Date.now()}-${n}-${Math.random()}`, original: f, file: f, preview: URL.createObjectURL(f), report: null, enhanced: false, slot, replaceId: n === 0 ? t?.replaceId : undefined, status: "checking" };
    });
    setQueue((q) => [...q, ...items]);
    const results = await Promise.all(items.map((i) => process(i.key, i.original, slotByKey.get(i.slot)!.room)));
    // A photo taken for a specific empty slot goes straight up — nothing more to decide.
    if (t?.auto && results[0]) await uploadOne({ ...items[0], ...results[0], status: "ready" });
  };

  const uploadOne = async (i: Item) => {
    const s = slotByKey.get(i.slot)!;
    setQueue((q) => q.map((x) => (x.key === i.key ? { ...x, status: "uploading" } : x)));
    try {
      const fd = new FormData();
      fd.set("photo", new File([i.file], `${s.label.replace(/\W+/g, "-")}.jpg`, { type: "image/jpeg" }));
      fd.set("propertyId", String(propertyId)); fd.set("room", s.room); fd.set("label", s.label);
      if (s.unitId) fd.set("unitId", String(s.unitId));
      if (i.replaceId) fd.set("replace", "1");
      fd.set("quality", String(i.report?.score ?? 0)); fd.set("width", String(i.report?.width ?? 0)); fd.set("height", String(i.report?.height ?? 0));
      await uploadListingPhoto(fd);
      setQueue((q) => q.filter((x) => x.key !== i.key));
      return true;
    } catch {
      setQueue((q) => q.map((x) => (x.key === i.key ? { ...x, status: "error", error: "Upload failed — tap Upload to retry" } : x)));
      return false;
    }
  };

  const uploadAll = async () => {
    setUploading(true);
    for (const i of queue.filter((x) => x.status === "ready" || x.status === "error")) await uploadOne(i);
    setUploading(false);
    router.refresh();
  };

  const shoot = (slot: string, replaceId?: number) => { target.current = { slot, replaceId, auto: true }; cameraInput.current?.click(); };
  const ready = queue.filter((i) => i.status === "ready" || i.status === "error").length;
  const groups = useMemo(() => {
    const g: { title: string; items: Shot[] }[] = [{ title: "Outside", items: shots.filter((s) => s.unitId === null) }];
    for (const u of units) g.push({ title: units.length > 1 ? u.label : "Inside", items: shots.filter((s) => s.unitId === u.id) });
    return g;
  }, [shots, units]);
  const extras = photos.filter((p) => !shots.some((s) => s.label === p.label && s.unitId === p.unitId));

  return (
    <div className="space-y-4">
      <input ref={multiInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />

      {/* 1. Progress + the two ways to add */}
      <div className="card space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-brand-950">{doneCount === required.length ? "All must-have photos are in" : `${doneCount} of ${required.length} must-have photos`}</div>
            <div className="text-xs text-stone-500">{photos.length} photo{photos.length === 1 ? "" : "s"} on the listing</div>
          </div>
          <div className={`text-2xl font-bold ${pct === 100 ? "text-brand-700" : "text-gold-700"}`}>{pct}%</div>
        </div>
        <div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { target.current = null; multiInput.current?.click(); }} className="btn-primary"><ImagePlus className="h-4 w-4" /> Add photos</button>
          <button type="button" onClick={() => { target.current = { slot: nextFree(new Set(queue.map((i) => i.slot))), auto: false }; cameraInput.current?.click(); }} className="btn-outline"><Camera className="h-4 w-4" /> Take a photo</button>
        </div>
        <details className="text-xs text-stone-600">
          <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-brand-700"><ChevronDown className="h-3.5 w-3.5" /> Tips for photos that let fast</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Hold the phone sideways (landscape) and level.</li>
            <li>Open curtains and switch on lights — shoot in daylight.</li>
            <li>Tidy up: make beds, clear counters, close the toilet seat.</li>
            <li>Shoot from a corner or doorway so the room looks its real size.</li>
          </ul>
        </details>
      </div>

      {/* 2. Review: tag each new photo, then upload all */}
      {queue.length > 0 && (
        <div className="card space-y-3 border-brand-200">
          <div className="flex items-center justify-between">
            <div className="h2">New photos ({queue.length})</div>
            {!uploading && <button type="button" onClick={() => setQueue([])} className="text-xs font-semibold text-stone-500">Clear</button>}
          </div>
          <p className="-mt-2 text-xs text-stone-500">We guessed the room for each — change any that are wrong.</p>
          <div className="space-y-2">
            {queue.map((i) => {
              const bad = i.report?.checks.filter((c) => !c.ok && !/dark|bright|contrast|Flat/i.test(c.label)) ?? [];
              return (
                <div key={i.key} className="flex gap-3 rounded-xl border border-stone-200 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.preview} alt="" className="h-20 w-24 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <select value={i.slot} disabled={i.status === "uploading"} onChange={(e) => setQueue((q) => q.map((x) => (x.key === i.key ? { ...x, slot: e.target.value } : x)))} className="input py-1.5" aria-label="What's in this photo?">
                      {groups.map((g) => (
                        <optgroup key={g.title} label={g.title}>
                          {g.items.map((s) => <option key={s.key} value={s.key}>{s.label.replace(/^.* · /, "")}{filledBy(s) ? " ✓" : s.required ? " *" : ""}</option>)}
                        </optgroup>
                      ))}
                      <option value="other">Other / extra</option>
                    </select>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {i.status === "checking" && <span className="flex items-center gap-1 text-stone-500"><Loader2 className="h-3 w-3 animate-spin" /> Checking…</span>}
                      {i.status === "uploading" && <span className="flex items-center gap-1 text-brand-700"><Loader2 className="h-3 w-3 animate-spin" /> Uploading…</span>}
                      {i.status === "error" && <span className="text-maroon-600">{i.error}</span>}
                      {i.report && i.status !== "checking" && (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${i.report.score >= 70 ? "bg-brand-50 text-brand-700" : i.report.score >= 50 ? "bg-gold-50 text-gold-700" : "bg-maroon-50 text-maroon-600"}`}>{i.report.score >= 70 ? "Good" : i.report.score >= 50 ? "OK" : "Weak"} · {i.report.score}</span>
                      )}
                      {i.enhanced && <button type="button" onClick={async () => { setQueue((q) => q.map((x) => (x.key === i.key ? { ...x, status: "checking" } : x))); const f = await resize(i.original); const r = await analyse(f, slotByKey.get(i.slot)!.room); setQueue((q) => q.map((x) => (x.key === i.key ? { ...x, file: f, report: r, enhanced: false, preview: URL.createObjectURL(f), status: "ready" } : x))); }} className="flex items-center gap-1 rounded-full bg-gold-50 px-2 py-0.5 font-semibold text-gold-700"><Sparkles className="h-3 w-3" /> Brightened · use original</button>}
                      {bad.map((c) => <span key={c.label} className="flex items-center gap-1 text-gold-800" title={c.tip}><TriangleAlert className="h-3 w-3" /> {c.label}</span>)}
                    </div>
                  </div>
                  {i.status !== "uploading" && <button type="button" onClick={() => setQueue((q) => q.filter((x) => x.key !== i.key))} className="self-start rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Remove"><X className="h-4 w-4" /></button>}
                </div>
              );
            })}
          </div>
          <button type="button" onClick={uploadAll} disabled={uploading || ready === 0} className="btn-primary w-full">
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <><Upload className="h-4 w-4" /> Upload {ready} photo{ready === 1 ? "" : "s"}</>}
          </button>
        </div>
      )}

      {/* 3. Checklist by area — empty slots open the camera for that room */}
      {groups.map((g) => (
        <div key={g.title} className="card space-y-2">
          <div className="text-sm font-semibold text-brand-950">{g.title}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((s) => {
              const p = filledBy(s);
              const queued = queue.find((i) => i.slot === s.key);
              return (
                <button key={s.key} type="button" onClick={() => (p ? setManage(p) : queued ? undefined : shoot(s.key))}
                  className={`relative overflow-hidden rounded-xl border text-left ${p ? "border-stone-200" : "border-dashed border-stone-300 bg-stone-50"}`}>
                  {p
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`/api/files/${p.fileId}`} alt={s.label} className="h-20 w-full object-cover" />
                    : queued
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={queued.preview} alt="" className="h-20 w-full object-cover opacity-60" />
                      : <span className="flex h-20 flex-col items-center justify-center gap-1 text-stone-400"><Camera className="h-5 w-5" /><span className="text-[9px]">Tap to shoot</span></span>}
                  <span className="block truncate px-1.5 py-1 text-[10px] font-medium text-stone-700">{s.label.replace(/^.* · /, "")}{s.required && !p && <span className="text-maroon-500"> *</span>}</span>
                  {p && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white"><Check className="h-3 w-3" /></span>}
                  {p?.isCover && <span className="absolute left-1 top-1 rounded-full bg-gold-400 px-1.5 text-[9px] font-bold text-brand-950">COVER</span>}
                  {queued && !p && <span className="absolute inset-x-0 top-7 text-center text-[10px] font-semibold text-brand-900">Ready to upload</span>}
                  {p?.quality != null && p.quality < 50 && <span className="absolute bottom-6 right-1 rounded bg-gold-100 px-1 text-[9px] font-semibold text-gold-700">retake?</span>}
                </button>
              );
            })}
          </div>
          {g.items.some((s) => !filledBy(s)) && <p className="text-[11px] text-stone-500">{ROOM_TIPS[g.items.find((s) => !filledBy(s))!.room]?.[0]}</p>}
        </div>
      ))}

      {extras.length > 0 && (
        <div className="card space-y-2">
          <div className="text-sm font-semibold text-brand-950">More photos</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {extras.map((p) => (
              <button key={p.id} type="button" onClick={() => setManage(p)} className="relative overflow-hidden rounded-xl border border-stone-200 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${p.fileId}`} alt={p.label} className="h-20 w-full object-cover" />
                <span className="block truncate px-1.5 py-1 text-[10px] text-stone-700">{p.label}</span>
                {p.isCover && <span className="absolute left-1 top-1 rounded-full bg-gold-400 px-1.5 text-[9px] font-bold text-brand-950">COVER</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {manage && <ManageSheet p={manage} groups={groups} onClose={() => setManage(null)} onRetake={(slotKey) => { setManage(null); shoot(slotKey, manage.id); }} shotFor={(ph) => shots.find((s) => s.label === baseLabel(ph.label) && s.unitId === ph.unitId)?.key ?? "other"} slotByKey={slotByKey} />}
    </div>
  );
}

/** Bottom sheet for one photo: make cover, change its room, retake, delete. */
function ManageSheet({ p, groups, onClose, onRetake, shotFor, slotByKey }: {
  p: Photo; groups: { title: string; items: Shot[] }[]; onClose: () => void; onRetake: (slotKey: string) => void;
  shotFor: (p: Photo) => string; slotByKey: Map<string, Shot>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slot, setSlot] = useState(shotFor(p));
  const run = (fn: (fd: FormData) => Promise<void>, fill: (fd: FormData) => void) => start(async () => { const fd = new FormData(); fd.set("id", String(p.id)); fill(fd); await fn(fd); router.refresh(); onClose(); });
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/50 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><div className="font-semibold text-brand-950">{p.label}</div><button type="button" onClick={onClose} className="rounded-full p-1.5 text-stone-400 hover:bg-stone-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/files/${p.fileId}`} alt={p.label} className="max-h-64 w-full rounded-xl object-cover" />
        {p.quality != null && <div className="text-xs text-stone-500">Photo quality {p.quality}/100{p.quality < 50 ? " — a retake in better light would help" : ""}</div>}
        <label className="block"><span className="label">What&apos;s in this photo?</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value)} className="input">
            {groups.map((g) => <optgroup key={g.title} label={g.title}>{g.items.map((s) => <option key={s.key} value={s.key}>{s.label.replace(/^.* · /, "")}</option>)}</optgroup>)}
            <option value="other">Other / extra</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {slot !== shotFor(p)
            ? <button type="button" disabled={pending} onClick={() => run(retagPhoto, (fd) => { const s = slotByKey.get(slot)!; fd.set("room", s.room); fd.set("label", s.label); if (s.unitId) fd.set("unitId", String(s.unitId)); })} className="btn-primary col-span-2">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save room"}</button>
            : <>
                {!p.isCover && <button type="button" disabled={pending} onClick={() => run(setCoverPhoto, () => {})} className="btn-outline"><Star className="h-4 w-4" /> Make cover</button>}
                <button type="button" disabled={pending} onClick={() => onRetake(shotFor(p))} className="btn-outline"><RotateCcw className="h-4 w-4" /> Retake</button>
                <button type="button" disabled={pending} onClick={() => run(deletePhoto, () => {})} className={`btn-ghost text-maroon-600 ${p.isCover ? "" : "col-span-2"}`}><Trash2 className="h-4 w-4" /> Delete</button>
              </>}
        </div>
      </div>
    </div>
  );
}
