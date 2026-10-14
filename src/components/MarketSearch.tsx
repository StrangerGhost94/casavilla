"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

const MODES = [
  { id: "rent", label: "Rent", path: "/listings", hint: "Area or neighbourhood, e.g. Ntinda, Kira" },
  { id: "stays", label: "Stays", path: "/stays", hint: "Where are you staying? e.g. Entebbe" },
  { id: "buy", label: "Buy", path: "/sale", hint: "Land or property in, e.g. Mukono, Wakiso" },
] as const;

/** One search box for the whole marketplace: rent, short stays or buy. */
export function MarketSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("rent");
  const [q, setQ] = useState("");
  const m = MODES.find((x) => x.id === mode)!;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const t = q.trim(); router.push(m.id === "stays" || !t ? m.path : `${m.path}?q=${encodeURIComponent(t)}`); }}
      className="rounded-2xl bg-white p-1.5 shadow-float">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        {MODES.map((x) => (
          <button key={x.id} type="button" onClick={() => setMode(x.id)} aria-pressed={mode === x.id}
            className={`rounded-lg py-1.5 transition ${mode === x.id ? "bg-white text-brand-950 shadow-sm" : "text-stone-500"}`}>{x.label}</button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Search className="ml-2.5 h-5 w-5 shrink-0 text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder={m.hint} enterKeyHint="search" />
        <button className="btn-primary shrink-0 px-4 py-2">Search</button>
      </div>
    </form>
  );
}
