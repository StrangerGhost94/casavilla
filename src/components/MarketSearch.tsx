"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";

type Opt = [string, string];
const ugxK = (n: number) => (n >= 1e9 ? `${n / 1e9}B` : n >= 1e6 ? `${n / 1e6}M` : `${n / 1000}k`);

const MODES = {
  rent: {
    label: "Rent", path: "/listings", hint: "Area, e.g. Ntinda, Kira, Kololo", typeKey: "beds", typeLabel: "Bedrooms",
    types: [["", "Any size"], ["1", "1+ bedroom"], ["2", "2+ bedrooms"], ["3", "3+ bedrooms"], ["4", "4+ bedrooms"]] as Opt[],
    budgets: [300000, 500000, 800000, 1200000, 2000000], per: "/ month",
  },
  stays: {
    label: "Stays", path: "/stays", hint: "Where to? e.g. Entebbe, Kololo", typeKey: "guests", typeLabel: "Guests",
    types: [["", "Any"], ["2", "2+ guests"], ["4", "4+ guests"], ["6", "6+ guests"]] as Opt[],
    budgets: [100000, 150000, 250000, 400000], per: "/ night",
  },
  buy: {
    label: "Buy", path: "/sale", hint: "Area, e.g. Mukono, Wakiso, Gayaza", typeKey: "kind", typeLabel: "Type",
    types: [["", "Land or property"], ["land", "Land & plots"], ["house", "Houses"], ["apartment", "Apartments"], ["commercial", "Commercial"], ["farm", "Farms"]] as Opt[],
    budgets: [50e6, 100e6, 250e6, 500e6, 1e9], per: "",
  },
} as const;
type Mode = keyof typeof MODES;

/**
 * One search for the whole marketplace: rent, stays or buy, then area, type and budget in one bar
 * (type and budget fold behind "Filters" on phones). Opens the matching results page with those filters set.
 */
export function MarketSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("rent");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [max, setMax] = useState("");
  const [more, setMore] = useState(false);
  const m = MODES[mode];

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set(m.typeKey, type);
    if (max) p.set("max", max);
    router.push(`${m.path}${p.size ? `?${p}` : ""}`);
  };
  const pick = (k: Mode) => { setMode(k); setType(""); setMax(""); };
  const select = "w-full min-w-0 appearance-none bg-transparent text-sm font-semibold text-stone-800 focus:outline-none";

  return (
    <form onSubmit={go} className="rounded-2xl bg-white p-1.5 shadow-float">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        {(Object.keys(MODES) as Mode[]).map((k) => (
          <button key={k} type="button" onClick={() => pick(k)} aria-pressed={mode === k}
            className={`rounded-lg py-1.5 transition ${mode === k ? "bg-white text-brand-950 shadow-sm" : "text-stone-500"}`}>{MODES[k].label}</button>
        ))}
      </div>
      <div className="mt-1.5 flex flex-col gap-1.5 md:flex-row md:items-stretch">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-1 md:border-r md:border-stone-100">
          <MapPin className="h-5 w-5 shrink-0 text-stone-400" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400">Where</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} className="w-full min-w-0 bg-transparent py-0.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder={m.hint} enterKeyHint="search" />
          </span>
          <button type="button" onClick={() => setMore((x) => !x)} aria-expanded={more} aria-label="Filters"
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg md:hidden ${more ? "bg-brand-50 text-brand-800" : "text-stone-500"}`}>
            <SlidersHorizontal className="h-4 w-4" />{(type || max) && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold-400" />}
          </button>
        </label>
        <div className={`${more ? "grid" : "hidden"} grid-cols-2 gap-1.5 md:grid md:w-[22rem] md:shrink-0`}>
          <label className="rounded-xl bg-stone-50 px-3 py-1.5 md:bg-transparent">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400">{m.typeLabel}</span>
            <select value={type} onChange={(e) => setType(e.target.value)} className={select}>{m.types.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </label>
          <label className="rounded-xl bg-stone-50 px-3 py-1.5 md:bg-transparent">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-stone-400">Budget{m.per ? ` ${m.per}` : ""}</span>
            <select value={max} onChange={(e) => setMax(e.target.value)} className={select}>
              <option value="">Any price</option>
              {m.budgets.map((b) => <option key={b} value={b}>Up to {ugxK(b)}</option>)}
            </select>
          </label>
        </div>
        <button className="btn-primary shrink-0 px-5 py-2.5"><Search className="h-4 w-4" /> Search</button>
      </div>
    </form>
  );
}
