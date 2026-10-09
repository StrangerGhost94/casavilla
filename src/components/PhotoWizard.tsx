"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronRight, ImagePlus, Loader2, Sparkles, Star, Trash2, TriangleAlert, Wand2, X } from "lucide-react";
import { analyse, enhance, resize, ROOM_TIPS, shotList, type PhotoReport, type Shot } from "@/lib/photo-check";
import { deletePhoto, setCoverPhoto, uploadListingPhoto } from "@/app/photo-actions";

type Photo = { id: number; fileId: number; room: string; label: string; unitId: number | null; isCover: boolean; quality: number | null };
type UnitInfo = { id: number; label: string; bedrooms: number; bathrooms: number };

/**
 * Guided listing photos: a shot list built from the property's units (one bedroom shot per bedroom, etc.),
 * framing tips per room, on-device checks for light, sharpness and orientation, and one-tap auto-enhance.
 */
export function PhotoWizard({ propertyId, units, photos }: { propertyId: number; units: UnitInfo[]; photos: Photo[] }) {
  const shots = useMemo(() => shotList(units, units.length > 1), [units]);
  const taken = (s: Shot) => photos.find((p) => p.label === s.label && p.unitId === s.unitId);
  const extras = photos.filter((p) => !shots.some((s) => s.label === p.label && s.unitId === p.unitId));
  const required = shots.filter((s) => s.required);
  const done = required.filter(taken).length;
  const pct = required.length ? Math.round((done / required.length) * 100) : 0;
  const [active, setActive] = useState<Shot | null>(null);
  const next = shots.find((s) => !taken(s));

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="h2">Listing photos</div>
          <p className="text-xs text-stone-500">Follow the shot list — homes with a full set of bright photos let faster.</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${pct === 100 ? "text-brand-700" : "text-gold-700"}`}>{pct}%</div>
          <div className="text-[10px] text-stone-500">{done}/{required.length} must-haves</div>
        </div>
      </div>
      <div className="h-2 rounded-full bg-stone-100"><div className="h-2 rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} /></div>
      {next && !active && (
        <button type="button" onClick={() => setActive(next)} className="btn-primary w-full"><Camera className="h-4 w-4" /> Next shot: {next.label}</button>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {shots.map((s) => {
          const p = taken(s);
          return (
            <button key={s.key} type="button" onClick={() => setActive(s)}
              className={`relative overflow-hidden rounded-xl border text-left transition ${active?.key === s.key ? "border-brand-700 ring-2 ring-brand-200" : "border-stone-200"} ${p ? "" : "border-dashed bg-stone-50"}`}>
              {p
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={`/api/files/${p.fileId}`} alt={s.label} className="h-20 w-full object-cover" />
                : <span className="flex h-20 items-center justify-center text-stone-400"><Camera className="h-5 w-5" /></span>}
              <span className="block truncate px-1.5 py-1 text-[10px] font-medium text-stone-700">{s.label}{s.required && !p && <span className="text-maroon-500"> *</span>}</span>
              {p && <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white"><Check className="h-3 w-3" /></span>}
              {p?.isCover && <span className="absolute left-1 top-1 rounded-full bg-gold-400 px-1.5 text-[9px] font-bold text-brand-950">COVER</span>}
              {p?.quality != null && p.quality < 60 && <span className="absolute bottom-6 right-1 rounded bg-gold-100 px-1 text-[9px] font-semibold text-gold-700">retake?</span>}
            </button>
          );
        })}
        <button type="button" onClick={() => setActive({ key: `extra-${Date.now()}`, room: "other", label: `Extra photo ${extras.length + 1}`, unitId: null, required: false })}
          className="flex h-[6.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-stone-300 text-[10px] text-stone-500">
          <ImagePlus className="h-5 w-5" /> Add extra
        </button>
      </div>

      {extras.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {extras.map((p) => <ManageTile key={p.id} p={p} />)}
        </div>
      )}

      {active && <Capture key={active.key} shot={active} propertyId={propertyId} existing={taken(active)} onClose={() => setActive(null)} onNext={() => { const n = shots.find((s) => s.key !== active.key && !taken(s)); setActive(n ?? null); }} />}
    </div>
  );
}

function ManageTile({ p }: { p: Photo }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const fd = () => { const f = new FormData(); f.set("id", String(p.id)); return f; };
  return (
    <div className="relative overflow-hidden rounded-xl border border-stone-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/files/${p.fileId}`} alt={p.label} className="h-20 w-full object-cover" />
      <div className="flex items-center justify-between px-1.5 py-1 text-[10px]">
        <span className="truncate">{p.label}</span>
        <button type="button" disabled={pending} onClick={() => start(async () => { await deletePhoto(fd()); router.refresh(); })} className="text-stone-400 hover:text-maroon-600" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function Capture({ shot, propertyId, existing, onClose, onNext }: { shot: Shot; propertyId: number; existing?: Photo; onClose: () => void; onNext: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [report, setReport] = useState<PhotoReport | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhanced, setEnhanced] = useState(false);
  const [pending, start] = useTransition();

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null); setEnhanced(false); setBusy("Checking your photo…");
    try {
      const r = await analyse(f, shot.room);
      setFile(f); setReport(r); setPreview(URL.createObjectURL(f));
    } catch { setError("That file couldn't be read as a photo. Try another one (JPG or PNG)."); }
    setBusy(null);
  };
  const autoFix = async () => {
    if (!file || !report) return;
    setBusy("Enhancing…");
    const better = await enhance(file, report);
    const r = await analyse(better, shot.room);
    setFile(better); setReport(r); setPreview(URL.createObjectURL(better)); setEnhanced(true); setBusy(null);
  };
  const save = () => start(async () => {
    if (!file || !report) return;
    setBusy("Uploading…");
    try {
      const blob = enhanced ? file : await resize(file);
      const fd = new FormData();
      fd.set("photo", new File([blob], `${shot.label.replace(/\W+/g, "-")}.jpg`, { type: "image/jpeg" }));
      fd.set("propertyId", String(propertyId)); fd.set("room", shot.room); fd.set("label", shot.label);
      if (shot.unitId) fd.set("unitId", String(shot.unitId));
      fd.set("quality", String(report.score)); fd.set("width", String(report.width)); fd.set("height", String(report.height));
      await uploadListingPhoto(fd);
      router.refresh();
      onNext();
    } catch { setError("Upload failed — check your connection and try again."); }
    setBusy(null);
  });
  const fdFor = (k: string, v: string) => { const f = new FormData(); f.set(k, v); return f; };
  const bad = report?.checks.filter((c) => !c.ok) ?? [];

  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{shot.required ? "Must-have shot" : "Recommended shot"}</div>
          <div className="text-base font-bold text-brand-950">{shot.label}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-stone-400 hover:bg-white" aria-label="Close"><X className="h-4 w-4" /></button>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-stone-600">
        {(ROOM_TIPS[shot.room] ?? ROOM_TIPS.other).map((t) => <li key={t} className="flex gap-1.5"><ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-brand-600" />{t}</li>)}
      </ul>

      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {!preview && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { input.current?.setAttribute("capture", "environment"); input.current?.click(); }} className="btn-primary"><Camera className="h-4 w-4" /> Take photo</button>
          <button type="button" onClick={() => { input.current?.removeAttribute("capture"); input.current?.click(); }} className="btn-outline"><ImagePlus className="h-4 w-4" /> From gallery</button>
        </div>
      )}
      {existing && !preview && (
        <div className="mt-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/files/${existing.fileId}`} alt="" className="h-14 w-20 rounded-lg object-cover" />
          <div className="flex-1 text-xs text-stone-500">Current photo{existing.quality != null ? ` · quality ${existing.quality}/100` : ""}. Take a new one to replace it.</div>
          {!existing.isCover && <button type="button" disabled={pending} onClick={() => start(async () => { await setCoverPhoto(fdFor("id", String(existing.id))); router.refresh(); })} className="btn-outline btn-sm"><Star className="h-3.5 w-3.5" /> Cover</button>}
          <button type="button" disabled={pending} onClick={() => start(async () => { await deletePhoto(fdFor("id", String(existing.id))); router.refresh(); onClose(); })} className="btn-ghost btn-sm text-maroon-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {busy && <div className="mt-3 flex items-center gap-2 text-xs text-stone-600"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</div>}
      {error && <div className="mt-3 rounded-lg bg-maroon-50 p-2 text-xs text-maroon-700">{error}</div>}

      {preview && report && (
        <div className="mt-3 space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="max-h-72 w-full rounded-xl object-cover" />
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${report.score >= 75 ? "text-brand-700" : report.score >= 55 ? "text-gold-700" : "text-maroon-600"}`}>
              Photo quality {report.score}/100 {report.score >= 75 ? "· great" : report.score >= 55 ? "· okay" : "· could be better"}
            </span>
            {enhanced && <span className="pill bg-gold-50 text-gold-700"><Sparkles className="h-3 w-3" /> Enhanced</span>}
          </div>
          <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
            {report.checks.map((c) => (
              <li key={c.label} className={`flex items-start gap-1.5 ${c.ok ? "text-brand-800" : "text-gold-800"}`}>
                {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                <span>{c.label}{!c.ok && c.tip && <span className="block text-stone-500">{c.tip}</span>}</span>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => { setPreview(null); setReport(null); setFile(null); }} className="btn-outline btn-sm">Retake</button>
            <button type="button" onClick={autoFix} disabled={!!busy || enhanced || !bad.some((b) => /dark|bright|contrast|hazy|Flat/i.test(b.label))} className="btn-outline btn-sm"><Wand2 className="h-3.5 w-3.5" /> Auto-enhance</button>
            <button type="button" onClick={save} disabled={pending || !!busy} className="btn-primary btn-sm">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
