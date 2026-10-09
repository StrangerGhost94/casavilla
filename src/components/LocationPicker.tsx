"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin, Search, X } from "lucide-react";
import { LEVEL_LABEL, type Crumb, type Level } from "@/lib/geo-core";

type Child = Crumb & { children: number };
type Hit = Crumb & { trail: Crumb[] };

const UGANDA: Crumb = { id: "UG", name: "Uganda", kind: "Country", level: "country" };
const NEXT: Record<string, Level> = { country: "region", region: "district", district: "county", county: "subcounty", subcounty: "parish", parish: "village" };

async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/**
 * Searchable, dependent location selector. Picks a canonical place at any level (a district is fine when the
 * village is unknown) and submits its id as `name`. Changing a level clears everything below it, so a
 * parent–child mismatch can't be submitted.
 */
export function LocationPicker({
  name = "locationId", initial = [], label = "Location", hint, required, onChange, compact, stopAt,
}: {
  name?: string; initial?: Crumb[]; label?: string; hint?: string; required?: boolean;
  onChange?: (trail: Crumb[]) => void; compact?: boolean; stopAt?: Level;
}) {
  const [trail, setTrail] = useState<Crumb[]>(initial.length ? initial : [UGANDA]);
  const [kids, setKids] = useState<Child[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const last = trail[trail.length - 1];
  const done = stopAt && last.level === stopAt;
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const guard = useRef<HTMLInputElement>(null);

  const loadKids = useCallback(async (id: string) => {
    setState("loading"); setKids(null);
    try { setKids(await getJSON<Child[]>(`/api/locations?parent=${encodeURIComponent(id)}`)); setState("idle"); }
    catch { setState("error"); }
  }, []);
  useEffect(() => { if (!done) loadKids(last.id); else setKids([]); }, [last.id, done, loadKids]);
  useEffect(() => { onChange?.(trail); }, [trail]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setHits(null); setSearchError(false); return; }
    timer.current = setTimeout(async () => {
      setSearching(true); setSearchError(false);
      try { setHits(await getJSON<Hit[]>(`/api/locations?q=${encodeURIComponent(q.trim())}`)); }
      catch { setSearchError(true); setHits(null); }
      finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const choose = (c: Child) => setTrail((t) => [...t, c]);
  const backTo = (i: number) => setTrail((t) => t.slice(0, Math.max(1, i + 1)));
  const pickHit = (h: Hit) => { setTrail(h.trail.length ? h.trail : [UGANDA, h]); setQ(""); setHits(null); };
  const nextLabel = useMemo(() => {
    if (!kids?.length) return null;
    const kinds = [...new Set(kids.map((k) => k.kind))];
    return kinds.length <= 2 ? kinds.join(" / ") : LEVEL_LABEL[NEXT[last.level]];
  }, [kids, last.level]);
  const value = last.level === "country" ? "" : last.id;
  const specific = last.level === "country" || last.level === "region" ? "" : last.id; // required = at least a district
  useEffect(() => { guard.current?.setCustomValidity(""); }, [specific]);

  return (
    <div className={`relative ${compact ? "space-y-2" : "space-y-2.5"}`}>
      <input type="hidden" name={name} value={value} />
      {/* Lets the browser stop the form before submit (and keep what was typed) when no place is chosen. */}
      {required && (
        <input ref={guard} tabIndex={-1} aria-hidden className="pointer-events-none absolute h-px w-px opacity-0" required value={specific} onChange={() => {}}
          onInvalid={(e) => e.currentTarget.setCustomValidity("Choose at least the district")} />
      )}
      {label && <div className="label">{label}{required && <span className="text-maroon-500"> *</span>}</div>}

      {/* Readable breadcrumb; tap a step to go back up to it. */}
      <nav aria-label="Selected location" className="flex flex-wrap items-center gap-1 rounded-xl bg-brand-50/70 px-3 py-2 text-sm">
        <MapPin className="mr-0.5 h-4 w-4 shrink-0 text-brand-700" />
        {trail.map((c, i) => (
          <span key={c.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-stone-400" />}
            <button type="button" onClick={() => backTo(i)} disabled={i === trail.length - 1}
              className={`rounded px-0.5 text-left ${i === trail.length - 1 ? "font-semibold text-brand-950" : "text-brand-700 underline-offset-2 hover:underline"}`}
              title={c.kind}>{c.name}</button>
          </span>
        ))}
        {trail.length > 1 && (
          <button type="button" onClick={() => backTo(0)} aria-label="Clear location" className="ml-auto rounded-full p-1 text-stone-400 hover:bg-white hover:text-stone-600"><X className="h-3.5 w-3.5" /></button>
        )}
      </nav>
      {trail.length > 1 && <div className="-mt-1 px-1 text-[11px] text-stone-500">{last.kind}{!done && kids && kids.length > 0 ? " — narrow it down below, or leave it here if you're not sure" : ""}</div>}

      {/* Next level down */}
      {!done && state === "loading" && <div className="flex items-center gap-2 px-1 text-xs text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading places…</div>}
      {!done && state === "error" && (
        <div className="flex items-center justify-between rounded-xl bg-maroon-50 px-3 py-2 text-xs text-maroon-700">
          Couldn&apos;t load places — check your connection.
          <button type="button" className="font-semibold underline" onClick={() => loadKids(last.id)}>Retry</button>
        </div>
      )}
      {!done && state === "idle" && kids && kids.length > 0 && (
        <select aria-label={`Choose ${nextLabel}`} className="input" value="" onChange={(e) => { const c = kids.find((k) => k.id === e.target.value); if (c) choose(c); }}>
          <option value="">Choose {nextLabel?.toLowerCase()}… ({kids.length})</option>
          {kids.map((k) => <option key={k.id} value={k.id}>{k.name}{kids.some((o) => o.kind !== k.kind) ? ` (${k.kind})` : ""}</option>)}
        </select>
      )}
      {!done && state === "idle" && kids && kids.length === 0 && trail.length > 1 && (
        <div className="px-1 text-[11px] text-stone-500">This is the most specific level in the official list.</div>
      )}

      {/* Jump straight to a place by name */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input pl-10" placeholder="Or search a place: district, town, parish, village…"
          aria-label="Search for a place" autoComplete="off" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (hits?.[0]) pickHit(hits[0]); } }} />
        {searching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-stone-400" />}
      </div>
      {searchError && <div className="px-1 text-xs text-maroon-600">Search isn&apos;t available right now. Use the list above instead.</div>}
      {hits && (
        <div role="listbox" className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white shadow-card">
          {hits.length === 0 && <div className="p-3 text-sm text-stone-500">No place called “{q}” in the official list. Try another spelling, or choose a bigger area above.</div>}
          {hits.map((h) => (
            <button key={h.id} type="button" role="option" aria-selected={false} onClick={() => pickHit(h)} className="block w-full border-b border-stone-100 px-3 py-2.5 text-left last:border-0 hover:bg-brand-50">
              <div className="text-sm font-semibold text-stone-800">{h.name} <span className="font-normal text-stone-400">· {h.kind}</span></div>
              <div className="truncate text-[11px] text-stone-500">{h.trail.filter((c) => c.level !== "country" && c.id !== h.id).map((c) => c.name).join(" → ")}</div>
            </button>
          ))}
        </div>
      )}
      {hint && <p className="px-1 text-[11px] text-stone-500">{hint}</p>}
    </div>
  );
}
