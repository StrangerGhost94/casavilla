"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, ChevronDown, Loader2, X } from "lucide-react";
import { resize } from "@/lib/photo-check";
import { addInspectionPhoto, removeInspectionPhoto, saveInspectionItem } from "@/app/inspection-actions";
import { PhotoZoom } from "./FileButton";

export type EditorItem = { id: number; area: string; item: string; condition: string; note: string | null; photoIds: number[]; deduction: number };
export type Baseline = Record<string, { condition: string; note: string | null; photoIds: number[] }>;

const CHOICES: { v: string; label: string; on: string }[] = [
  { v: "good", label: "Good", on: "border-brand-700 bg-brand-700 text-white" },
  { v: "fair", label: "Fair", on: "border-gold-500 bg-gold-400 text-brand-950" },
  { v: "poor", label: "Poor", on: "border-amber-600 bg-amber-500 text-white" },
  { v: "damaged", label: "Damaged", on: "border-maroon-600 bg-maroon-500 text-white" },
  { v: "missing", label: "Missing", on: "border-maroon-700 bg-maroon-700 text-white" },
  { v: "na", label: "N/A", on: "border-stone-500 bg-stone-500 text-white" },
];
const label = (v: string) => CHOICES.find((c) => c.v === v)?.label ?? v;
const rank: Record<string, number> = { na: -1, good: 0, fair: 1, poor: 2, damaged: 3, missing: 4 };
const ugx = (n: number) => `UGX ${n.toLocaleString("en-US")}`;

/**
 * Room-by-room checklist. Every tap saves straight away (nothing to lose if the phone locks mid-walk).
 * On a move-out, each line shows how it was at move-in, and anything that got worse is highlighted.
 */
export function InspectionEditor({ items: initial, kind, editable, baseline }: { items: EditorItem[]; kind: string; editable: boolean; baseline: Baseline }) {
  const [items, setItems] = useState(initial);
  const [err, setErr] = useState("");
  const areas = useMemo(() => [...new Set(items.map((i) => i.area))], [items]);
  const set = (id: number, patch: Partial<EditorItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const save = async (id: number, patch: { condition?: string; note?: string; deduction?: number }) => {
    const r = await saveInspectionItem(id, patch);
    setErr("error" in r && r.error ? r.error : "");
  };
  const total = items.reduce((s, i) => s + (i.deduction || 0), 0);

  return (
    <div className="space-y-3">
      {err && <div role="alert" className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{err}</div>}
      {areas.map((a, ai) => {
        const rows = items.filter((i) => i.area === a);
        const issues = rows.filter((i) => rank[i.condition] >= 2).length;
        const worse = rows.filter((i) => baseline[`${i.area}|${i.item}`] && rank[i.condition] > rank[baseline[`${i.area}|${i.item}`].condition]).length;
        return (
          <details key={a} open={ai === 0} className="card group p-0">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-950">{a}</div>
                <div className="text-xs text-stone-500">{rows.length} items{issues ? ` · ${issues} need attention` : " · all fine"}{worse ? ` · ${worse} worse than move-in` : ""}</div>
              </div>
              <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-stone-100 border-t border-stone-100">
              {rows.map((i) => <Row key={i.id} i={i} kind={kind} editable={editable} was={baseline[`${i.area}|${i.item}`]} set={set} save={save} setErr={setErr} />)}
            </div>
          </details>
        );
      })}
      {kind === "move_out" && (
        <div className="card flex items-center justify-between">
          <span className="text-sm text-stone-600">Total deductions from the deposit</span>
          <span className="text-lg font-bold text-brand-950">{ugx(total)}</span>
        </div>
      )}
    </div>
  );
}

function Row({ i, kind, editable, was, set, save, setErr }: {
  i: EditorItem; kind: string; editable: boolean; was?: Baseline[string];
  set: (id: number, p: Partial<EditorItem>) => void; save: (id: number, p: { condition?: string; note?: string; deduction?: number }) => Promise<void>; setErr: (s: string) => void;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const worse = was && rank[i.condition] > rank[was.condition];
  const needsNote = rank[i.condition] >= 2 && !i.note;

  const upload = (f: File | undefined) => {
    if (!f) return;
    start(async () => {
      const fd = new FormData();
      fd.set("itemId", String(i.id));
      fd.set("photo", new File([await resize(f)], "inspection.jpg", { type: "image/jpeg" }));
      const r = await addInspectionPhoto(fd);
      if ("fileId" in r && r.fileId) set(i.id, { photoIds: [...i.photoIds, r.fileId] }); else setErr(("error" in r && r.error) || "Upload failed");
    });
  };

  return (
    <div className={`space-y-2 px-4 py-3 ${worse ? "bg-maroon-50/40" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-medium text-stone-800">{i.item}</div>
        {was && <div className={`shrink-0 text-[11px] ${worse ? "font-semibold text-maroon-600" : "text-stone-500"}`}>At move-in: {label(was.condition)}</div>}
      </div>
      {was?.note && <div className="text-[11px] text-stone-500">Move-in note: {was.note}</div>}
      {was && was.photoIds.length > 0 && (
        <div className="flex gap-1.5">
          {was.photoIds.map((p) => (
            <PhotoZoom key={p} src={`/api/files/${p}`} alt={`${i.item} at move-in`} className="h-10 w-12 shrink-0 overflow-hidden rounded-md opacity-80 ring-1 ring-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${p}`} alt="" className="h-full w-full object-cover" />
            </PhotoZoom>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {CHOICES.map((c) => (
          <button key={c.v} type="button" disabled={!editable} onClick={() => { set(i.id, { condition: c.v }); save(i.id, { condition: c.v }); }}
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition disabled:cursor-default ${i.condition === c.v ? c.on : "border-stone-200 bg-white text-stone-600"} ${!editable && i.condition !== c.v ? "hidden" : ""}`}>
            {c.label}
          </button>
        ))}
      </div>
      {editable ? (
        <input defaultValue={i.note ?? ""} maxLength={500} placeholder={needsNote ? "What's wrong? (helps if there's a dispute)" : "Note (optional)"}
          onBlur={(e) => { if (e.target.value !== (i.note ?? "")) { set(i.id, { note: e.target.value }); save(i.id, { note: e.target.value }); } }}
          className={`input py-2 text-sm ${needsNote ? "border-gold-300" : ""}`} />
      ) : i.note && <div className="text-sm text-stone-700">{i.note}</div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {i.photoIds.map((p) => (
          <span key={p} className="relative">
            <PhotoZoom src={`/api/files/${p}`} alt={i.item} className="block h-14 w-16 overflow-hidden rounded-lg ring-1 ring-stone-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/files/${p}`} alt="" className="h-full w-full object-cover" />
            </PhotoZoom>
            {editable && (
              <button type="button" aria-label="Remove photo" onClick={() => start(async () => { const r = await removeInspectionPhoto(i.id, p); if ("ok" in r) set(i.id, { photoIds: i.photoIds.filter((x) => x !== p) }); })}
                className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-stone-500 shadow ring-1 ring-stone-200"><X className="h-3 w-3" /></button>
            )}
          </span>
        ))}
        {editable && (
          <>
            <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            <button type="button" onClick={() => cam.current?.click()} disabled={busy || i.photoIds.length >= 6}
              className="flex h-14 w-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-stone-300 bg-stone-50 text-stone-500">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              <span className="text-[9px]">Photo</span>
            </button>
          </>
        )}
        {kind === "move_out" && (editable ? (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-stone-500">
            Deduct
            <input type="number" min={0} step={1000} inputMode="numeric" defaultValue={i.deduction || ""} placeholder="0"
              onBlur={(e) => { const d = Number(e.target.value) || 0; if (d !== i.deduction) { set(i.id, { deduction: d }); save(i.id, { deduction: d }); } }}
              className="input w-28 py-1.5 text-right text-sm" />
          </label>
        ) : i.deduction > 0 && <span className="ml-auto text-sm font-semibold text-maroon-600">− {ugx(i.deduction)}</span>)}
      </div>
    </div>
  );
}
