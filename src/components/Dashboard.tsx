import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { ugx } from "@/lib/format";
import { AttentionList, SectionTitle } from "./ui";

type Tone = "red" | "gold" | "blue" | "green";

/** Date line, page title and the two or three things people reach for most. */
export function DashHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Kampala" });
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-stone-400">{today}</div>
        <h1 className="h1 mt-0.5">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

/** The big green "collected this month" card with progress towards what's due. */
export function CollectedCard({ href, collected, due, left }: { href: string; collected: number; due: number; left: number }) {
  const pct = due ? Math.min(100, Math.round((collected / due) * 100)) : 0;
  return (
    <Link href={href} className="col-span-2 overflow-hidden rounded-2xl bg-brand-900 p-5 text-white shadow-card transition hover:bg-brand-950">
      <div className="flex items-center justify-between text-xs text-white/70"><span>Collected this month</span>{due > 0 && <span className="font-semibold text-gold-300">{pct}%</span>}</div>
      <div className="mt-1 text-2xl font-bold sm:text-3xl">{ugx(collected)}</div>
      <div className="mt-4 h-2 rounded-full bg-white/15"><div className="h-2 rounded-full bg-gold-400" style={{ width: `${pct}%` }} /></div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-white/70"><span>of {ugx(due)} due</span><span>{ugx(Math.max(0, left))} still to come</span></div>
    </Link>
  );
}

/** Small tappable figure card. Long money values shrink rather than wrap. */
export function MiniStat({ href, icon, tone = "green", value, label, hint }: { href: string; icon: React.ReactNode; tone?: "green" | "red" | "gold"; value: React.ReactNode; label: React.ReactNode; hint?: React.ReactNode }) {
  const t = { green: "bg-brand-50 text-brand-700", red: "bg-maroon-50 text-maroon-600", gold: "bg-gold-50 text-gold-700" }[tone];
  return (
    <Link href={href} className="card min-w-0 p-4 transition hover:-translate-y-0.5">
      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${t}`}>{icon}</div>
      <div className="mt-3 truncate text-base font-bold leading-tight text-brand-950 sm:text-xl">{value}</div>
      <div className="mt-1 text-xs font-medium text-stone-500">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-stone-400">{hint}</div>}
    </Link>
  );
}

/** "To do" list showing only rows with something waiting, or an all-clear card. */
export function TodoList({ rows }: { rows: { href: string; count: number; label: string; tone: Tone }[] }) {
  const todo = rows.filter((r) => r.count > 0);
  return (
    <div>
      <SectionTitle title={todo.length ? `To do · ${todo.length}` : "To do"} />
      {todo.length ? <AttentionList rows={todo} /> : (
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700"><CheckCircle2 className="h-5 w-5" /></span>
          <div><div className="text-sm font-semibold text-brand-950">All caught up</div><div className="text-xs text-stone-500">Nothing is waiting on you right now.</div></div>
        </div>
      )}
    </div>
  );
}
