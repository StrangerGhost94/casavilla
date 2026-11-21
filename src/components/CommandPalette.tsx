"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, X } from "lucide-react";
import { NavIcon } from "./NavLinks";

type Item = { group: string; label: string; sub?: string; href: string; icon?: string };

/** Things the office does most, one keystroke away. */
const ACTIONS: (Item & { superAdmin?: boolean; words?: string })[] = [
  { group: "Quick actions", label: "Record a cash or bank payment", sub: "Find the tenant, then record it on their page", href: "/manager/tenants", icon: "wallet", words: "cash bank pay rent receipt" },
  { group: "Quick actions", label: "Add a property", href: "/manager/properties/new", icon: "building", words: "new house apartment units" },
  { group: "Quick actions", label: "New listing for sale", href: "/manager/sale/new", icon: "tag", words: "land plot sell" },
  { group: "Quick actions", label: "People awaiting approval", href: "/manager/people?status=pending", icon: "users", words: "approve landlord agent provider" },
  { group: "Quick actions", label: "Approvals (waivers, refunds, reversals)", href: "/manager/approvals", icon: "clipboardCheck", words: "waive refund reverse" },
  { group: "Quick actions", label: "Daily cash close", href: "/manager/cash", icon: "wallet", words: "count cash close day" },
  { group: "Quick actions", label: "Tenants behind on rent", href: "/manager/tenants?show=overdue", icon: "users", words: "overdue arrears late chase" },
  { group: "Quick actions", label: "Viewing requests", href: "/viewings", icon: "viewing", words: "viewing visit" },
  { group: "Quick actions", label: "Maintenance jobs", href: "/manager/jobs", icon: "wrench", words: "repair job provider" },
  { group: "Quick actions", label: "Landlord statements", href: "/manager/statements", icon: "receipt", words: "statement commission" },
  { group: "Quick actions", label: "Activity & audit trail", href: "/manager/activity", icon: "history", words: "audit log history who" },
  { group: "Quick actions", label: "Access review", href: "/manager/access-review", icon: "users", superAdmin: true, words: "staff accounts review" },
];

/** Opens the search from anywhere (the buttons in the header send this event). */
export function openSearch() { window.dispatchEvent(new Event("cv-search")); }

export function SearchButton({ variant }: { variant: "desktop" | "phone" }) {
  return variant === "desktop" ? (
    <button type="button" onClick={openSearch} className="mr-auto flex w-full max-w-md items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-400 shadow-sm transition hover:border-stone-300">
      <Search className="h-4 w-4" /> <span className="flex-1">Search tenants, receipts, properties…</span>
      <kbd className="rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] text-stone-500">Ctrl K</kbd>
    </button>
  ) : (
    <button type="button" onClick={openSearch} aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15">
      <Search className="h-5 w-5" />
    </button>
  );
}

/** Ctrl/⌘ K: find a tenant, person, receipt, property or listing, or jump to a common task. Office accounts only. */
export function CommandPalette({ superAdmin }: { superAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === "Escape") setOpen(false);
    };
    const show = () => setOpen(true);
    window.addEventListener("keydown", key);
    window.addEventListener("cv-search", show);
    return () => { window.removeEventListener("keydown", key); window.removeEventListener("cv-search", show); };
  }, []);
  useEffect(() => { if (open) { setQ(""); setHits([]); setSel(0); setTimeout(() => input.current?.focus(), 10); } }, [open]);

  // Searches as you type, a moment after you stop.
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        setHits(r.ok ? (await r.json()).hits : []);
      } catch { /* typed again, or offline */ }
      setLoading(false);
    }, 180);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  const items = useMemo(() => {
    const words = q.trim().toLowerCase();
    const actions = ACTIONS.filter((a) => (superAdmin || !a.superAdmin) && (!words || `${a.label} ${a.words ?? ""}`.toLowerCase().includes(words)));
    return [...hits, ...(words ? actions.slice(0, 4) : actions)];
  }, [hits, q, superAdmin]);
  useEffect(() => setSel(0), [items.length]);

  const go = useCallback((it?: Item) => { if (!it) return; setOpen(false); router.push(it.href); }, [router]);

  if (!open) return null;
  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-brand-950/40 px-3 pt-[12vh] backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div role="dialog" aria-label="Search" className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-float animate-fade-up">
        <div className="flex items-center gap-2 border-b border-stone-100 px-4">
          <Search className="h-5 w-5 text-stone-400" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, phone, receipt no. or a task…" aria-label="Search"
            className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-stone-400"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              else if (e.key === "Enter") { e.preventDefault(); go(items[sel]); }
            }} />
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-stone-400 hover:text-stone-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-2">
          {items.length === 0 && <div className="px-4 py-6 text-center text-sm text-stone-500">{loading ? "Searching…" : "Nothing found. Try a first name, a phone number or a receipt number."}</div>}
          {items.map((it, i) => {
            const head = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={`${it.href}-${i}`}>
                {head && <div className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">{head}</div>}
                <button type="button" onMouseEnter={() => setSel(i)} onClick={() => go(it)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${i === sel ? "bg-brand-50" : ""}`}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600"><NavIcon name={it.icon ?? iconFor(it.group)} className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-stone-800">{it.label}</span>{it.sub && <span className="block truncate text-xs text-stone-500">{it.sub}</span>}</span>
                  {i === sel && <CornerDownLeft className="h-4 w-4 shrink-0 text-stone-400" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="hidden justify-between border-t border-stone-100 px-4 py-2 text-[11px] text-stone-400 sm:flex"><span>↑ ↓ to move · Enter to open · Esc to close</span><span>Ctrl K to open from anywhere</span></div>
      </div>
    </div>
  );
}

const iconFor = (g: string) => ({ Tenants: "key", People: "users", Receipts: "receipt", Properties: "building", "For sale": "tag" }[g] ?? "search");
