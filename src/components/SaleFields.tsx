"use client";
import { useEffect, useRef, useState } from "react";
import { Building, Building2, Home, Store, Trees } from "lucide-react";
import { KIND, SALE_FEATURES, SALE_KINDS, SIZE_UNIT, SIZE_UNITS, TENURE, TENURES, TITLE, TITLE_STATUSES, shortUgx, toAcres, type SaleKind } from "@/lib/sales";

type Defaults = {
  kind?: string; title?: string; price?: number; negotiable?: boolean; sizeValue?: number | null; sizeUnit?: string | null; plotDims?: string | null;
  bedrooms?: number | null; bathrooms?: number | null; tenure?: string | null; titleStatus?: string; features?: string[]; description?: string | null;
};
const ICON: Record<SaleKind, typeof Home> = { land: Trees, house: Home, apartment: Building2, commercial: Store, farm: Building };

/** Step 1: what is it and what does it cost. */
export function SaleBasics({ d }: { d: Defaults }) {
  const [kind, setKind] = useState<string>(d.kind ?? "land");
  const [price, setPrice] = useState<string>(d.price ? String(d.price) : "");
  const n = Number(price.replace(/[,\s]/g, ""));
  return (
    <div className="space-y-4">
      <div>
        <div className="label">What are you selling?</div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SALE_KINDS.map((k) => {
            const I = ICON[k];
            return (
              <label key={k} className={`flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-3 text-center text-xs font-semibold transition ${kind === k ? "border-brand-700 bg-brand-50 text-brand-900 ring-4 ring-brand-100" : "border-stone-200 bg-white text-stone-600"}`}>
                <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                <I className="h-5 w-5" /> {KIND[k].label}
              </label>
            );
          })}
        </div>
      </div>
      <label className="block"><span className="label">Headline</span>
        <input name="title" required maxLength={100} defaultValue={d.title} className="input"
          placeholder={kind === "land" ? "e.g. 50 × 100 ft plot with title, Kira – Namugongo" : kind === "farm" ? "e.g. 10 acres of farmland near Mukono" : "e.g. 4-bedroom house with boys' quarters, Muyenga"} />
      </label>
      <label className="block"><span className="label">Asking price (UGX)</span>
        <input name="price" required inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d,]/g, ""))} className="input text-lg font-semibold" placeholder="e.g. 85,000,000" />
        {n >= 100000 && <span className="mt-1 block text-xs text-stone-500">{shortUgx(n)} · UGX {n.toLocaleString("en-US")}</span>}
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" name="negotiable" defaultChecked={d.negotiable ?? true} className="h-4 w-4 accent-brand-700" /> Price is negotiable</label>
    </div>
  );
}

/** Step 2: size, ownership and features — the fields follow the type chosen in step 1. */
export function SaleDetails({ d }: { d: Defaults }) {
  const box = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<string>(d.kind ?? "land");
  const [size, setSize] = useState<string>(d.sizeValue ? String(d.sizeValue) : "");
  const [unit, setUnit] = useState<string>(d.sizeUnit ?? "decimals");
  const [tenure, setTenure] = useState<string>(d.tenure ?? "");
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const sync = () => { const v = (form.querySelector("input[name=kind]:checked") as HTMLInputElement | null)?.value; if (v) setKind(v); };
    sync();
    form.addEventListener("change", sync);
    return () => form.removeEventListener("change", sync);
  }, []);
  const land = kind === "land" || kind === "farm";
  const building = !land;
  const acres = Number(size) > 0 ? toAcres(Number(size), unit) : 0;
  return (
    <div ref={box} className="space-y-4">
      <div>
        <div className="label">{land ? "Land size" : "Plot size (optional)"}</div>
        <div className="grid grid-cols-[1fr_8rem] gap-2">
          <input name="sizeValue" inputMode="decimal" value={size} onChange={(e) => setSize(e.target.value.replace(/[^\d.]/g, ""))} className="input" placeholder={land ? "e.g. 50" : "e.g. 25"} />
          <select name="sizeUnit" value={unit} onChange={(e) => setUnit(e.target.value)} className="input">{SIZE_UNITS.map((u) => <option key={u} value={u}>{SIZE_UNIT[u]}</option>)}</select>
        </div>
        {acres > 0 && unit !== "acres" && <span className="mt-1 block text-xs text-stone-500">= {Number(acres.toFixed(3))} acres (1 acre = 100 decimals)</span>}
        <input name="plotDims" maxLength={40} defaultValue={d.plotDims ?? ""} className="input mt-2" placeholder="Or measurements, e.g. 50 × 100 ft" />
      </div>
      {building && (
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Bedrooms</span><input name="bedrooms" type="number" min={0} max={50} defaultValue={d.bedrooms ?? (kind === "commercial" ? "" : 3)} className="input" /></label>
          <label><span className="label">Bathrooms</span><input name="bathrooms" type="number" min={0} max={50} defaultValue={d.bathrooms ?? (kind === "commercial" ? "" : 2)} className="input" /></label>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label><span className="label">Land tenure</span>
          <select name="tenure" value={tenure} onChange={(e) => setTenure(e.target.value)} className="input">
            <option value="">Not sure / ask</option>
            {TENURES.map((t) => <option key={t} value={t}>{TENURE[t].label}</option>)}
          </select>
          {tenure && <span className="mt-1 block text-[11px] text-stone-500">{TENURE[tenure].hint}</span>}
        </label>
        <label><span className="label">Land title</span>
          <select name="titleStatus" defaultValue={d.titleStatus ?? "titled"} className="input">{TITLE_STATUSES.map((t) => <option key={t} value={t}>{TITLE[t]}</option>)}</select>
          <span className="mt-1 block text-[11px] text-stone-500">CasaVilla can verify the title so buyers see a &quot;Title verified&quot; badge.</span>
        </label>
      </div>
      <div>
        <div className="label">Features</div>
        <div className="flex flex-wrap gap-1.5">
          {SALE_FEATURES.filter((f) => land ? !["Boys' quarters", "Swimming pool", "Furnished", "Parking", "Garden"].includes(f) : true).map((f) => (
            <label key={f} className="chip cursor-pointer has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800">
              <input type="checkbox" name="features" value={f} defaultChecked={d.features?.includes(f)} className="sr-only" />{f}
            </label>
          ))}
        </div>
      </div>
      <label className="block"><span className="label">Description</span>
        <textarea name="description" rows={5} maxLength={5000} defaultValue={d.description ?? ""} className="input"
          placeholder={land ? "Access road, neighbours, what it's good for (residential, farming…), how far from the main road, any developments nearby." : "Rooms, finishes, compound, security, water and power, what's nearby."} />
      </label>
    </div>
  );
}
