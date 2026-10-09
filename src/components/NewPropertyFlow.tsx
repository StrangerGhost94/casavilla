"use client";
import { Children, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";

/**
 * Splits one form into short steps. Every step stays in the page (so the form submits everything at once);
 * only the current one is shown, and Next checks that step's required fields before moving on.
 */
export function Steps({ titles, submitLabel, children }: { titles: string[]; submitLabel: string; children: React.ReactNode }) {
  const [step, setStep] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const parts = Children.toArray(children);
  const last = step === parts.length - 1;

  const valid = () => {
    const sec = box.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const fields = Array.from(sec?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea") ?? []);
    const bad = fields.find((f) => !f.checkValidity());
    if (bad) { bad.reportValidity(); return false; }
    return true;
  };
  const go = (n: number) => { setStep(n); box.current?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  return (
    <div ref={box} className="scroll-mt-20 space-y-4"
      onKeyDown={(e) => {
        // Enter in a text field moves to the next step instead of submitting half a form.
        if (e.key === "Enter" && !last && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); if (valid()) go(step + 1); }
      }}>
      <ol className="flex items-center gap-2">
        {titles.map((t, i) => (
          <li key={t} className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" disabled={i > step} onClick={() => go(i)}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? "bg-brand-700 text-white" : i === step ? "bg-brand-950 text-white" : "bg-stone-200 text-stone-500"}`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </button>
            <span className={`truncate text-xs font-semibold ${i === step ? "text-brand-950" : "text-stone-500"}`}>{t}</span>
            {i < titles.length - 1 && <span className="h-px flex-1 bg-stone-200" />}
          </li>
        ))}
      </ol>
      {parts.map((c, i) => <div key={i} data-step={i} className={i === step ? "card space-y-4" : "hidden"}>{c}</div>)}
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? <button type="button" onClick={() => go(step - 1)} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back</button> : <span />}
        {last ? <FinishButton label={submitLabel} />
          : <button type="button" onClick={() => valid() && go(step + 1)} className="btn-primary">Next <ArrowRight className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}

function FinishButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="btn-primary">{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <>{label} <Check className="h-4 w-4" /></>}</button>;
}

type Group = { key: number; label: string; count: number; beds: number; baths: number; rent: string };

/** Sensible first guess per property type; the landlord just edits it. */
const DEFAULTS: Record<string, Omit<Group, "key" | "rent">> = {
  "Apartments": { label: "Apt", count: 4, beds: 2, baths: 1 },
  "Standalone house": { label: "Main house", count: 1, beds: 3, baths: 2 },
  "Rentals (row houses)": { label: "Room", count: 4, beds: 1, baths: 1 },
  "Commercial / shops": { label: "Shop", count: 4, beds: 0, baths: 0 },
  "Hostel": { label: "Room", count: 10, beds: 1, baths: 1 },
  "Office": { label: "Office", count: 2, beds: 0, baths: 1 },
};
const names = (g: Group) => (g.count > 1 ? `${g.label} 1 … ${g.label} ${g.count}` : g.label);

/**
 * Units as groups of identical ones: "4 × Apt, 2 bed, 850,000". A building with two kinds of unit just adds a
 * second group. Features, photos and short-stay pricing come later, per unit.
 */
export function UnitGroups() {
  const box = useRef<HTMLDivElement>(null);
  const seq = useRef(1);
  const [touched, setTouched] = useState(false);
  const [groups, setGroups] = useState<Group[]>([{ key: 0, ...DEFAULTS["Apartments"], rent: "" }]);

  // Follow the property type chosen in step 1 until the landlord edits a group themselves.
  useEffect(() => {
    const sel = box.current?.closest("form")?.querySelector<HTMLSelectElement>("select[name=type]");
    if (!sel) return;
    const apply = () => { if (!touched) setGroups((g) => [{ ...g[0], ...(DEFAULTS[sel.value] ?? DEFAULTS["Apartments"]) }]); };
    apply();
    sel.addEventListener("change", apply);
    return () => sel.removeEventListener("change", apply);
  }, [touched]);

  const set = (key: number, patch: Partial<Group>) => { setTouched(true); setGroups((g) => g.map((x) => (x.key === key ? { ...x, ...patch } : x))); };
  const total = groups.reduce((s, g) => s + (g.count || 0), 0);
  const dupes = new Set(groups.map((g) => g.label.trim().toLowerCase())).size !== groups.length;

  return (
    <div ref={box} className="space-y-3">
      {groups.map((g, i) => (
        <div key={g.key} className="rounded-xl border border-stone-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{groups.length > 1 ? `Unit type ${i + 1}` : "Units"}</span>
            {groups.length > 1 && <button type="button" onClick={() => { setTouched(true); setGroups((x) => x.filter((y) => y.key !== g.key)); }} className="rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Remove this unit type"><Trash2 className="h-4 w-4" /></button>}
          </div>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <label className="min-w-0"><span className="label">Name</span><input name="g_label" value={g.label} onChange={(e) => set(g.key, { label: e.target.value })} required maxLength={34} className="input" placeholder="e.g. Apt, Room, Shop" /></label>
            <label className="min-w-0"><span className="label">How many</span><input name="g_count" type="number" min={1} max={50} value={g.count || ""} onChange={(e) => set(g.key, { count: Number(e.target.value) })} required className="input" /></label>
          </div>
          <div className="mt-2 grid grid-cols-[4.5rem_4.5rem_1fr] gap-2">
            <label className="min-w-0"><span className="label">Beds</span><input name="g_beds" type="number" min={0} max={20} value={g.beds} onChange={(e) => set(g.key, { beds: Number(e.target.value) })} className="input" /></label>
            <label className="min-w-0"><span className="label">Baths</span><input name="g_baths" type="number" min={0} max={20} value={g.baths} onChange={(e) => set(g.key, { baths: Number(e.target.value) })} className="input" /></label>
            <label className="min-w-0"><span className="label">Rent / month (UGX)</span><input name="g_rent" type="number" min={1000} inputMode="numeric" value={g.rent} onChange={(e) => set(g.key, { rent: e.target.value })} required className="input" placeholder="e.g. 800000" /></label>
          </div>
          {g.label.trim() && g.count > 0 && <p className="mt-2 text-[11px] text-stone-500">Creates {g.count === 1 ? "" : `${g.count} units: `}<b>{names(g)}</b>{g.beds === 0 ? "" : ` · ${g.beds} bed`}</p>}
        </div>
      ))}
      {dupes && <p className="text-xs font-semibold text-maroon-600">Give each unit type a different name.</p>}
      <button type="button" onClick={() => { setTouched(true); setGroups((g) => [...g, { key: seq.current++, label: "", count: 1, beds: g[0]?.beds ?? 1, baths: 1, rent: "" }]); }} className="btn-outline btn-sm w-full">
        <Plus className="h-4 w-4" /> Another kind of unit
      </button>
      <label className="flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" name="listed" defaultChecked className="h-4 w-4 accent-brand-700" /> List vacant units publicly</label>
      <p className="text-[11px] text-stone-500">{total} unit{total === 1 ? "" : "s"} in total. Features, short-stay pricing and photos come next — you can change any unit later.</p>
      {dupes && <input required value="" onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden onInvalid={(e) => e.currentTarget.setCustomValidity("Give each unit type a different name")} />}
    </div>
  );
}
