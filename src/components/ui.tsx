import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

/** Gold house mark used in the CasaVilla logo. */
export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" className={className} fill="none" aria-hidden>
      <g stroke="#d2a84a" strokeWidth="3.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M6 27 L32 5 L58 27" />
        <path d="M44 15 V7 H50 V20" />
        <path d="M13 22 V51 H51 V22" />
        <path d="M26 51 V35 H38 V51" />
        <path d="M32 35 V51" strokeWidth="2" />
      </g>
    </svg>
  );
}

/**
 * CasaVilla wordmark. `tone="light"` for dark-green backgrounds, `tone="dark"` for light ones.
 * `stacked` puts the house above the name (splash / login screens).
 */
export function Logo({ tone = "dark", stacked = false, size = "md", className = "" }: { tone?: "light" | "dark"; stacked?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const name = tone === "light" ? "text-white" : "text-brand-900";
  const sub = tone === "light" ? "text-white/80" : "text-brand-700";
  const s = {
    sm: { mark: "h-7 w-8", word: "text-xl", tag: "text-[7px] tracking-[0.22em]" },
    md: { mark: "h-9 w-10", word: "text-2xl", tag: "text-[8px] tracking-[0.24em]" },
    lg: { mark: "h-16 w-[4.5rem]", word: "text-[2.6rem]", tag: "text-[10px] tracking-[0.3em]" },
  }[size];
  return (
    <span className={`inline-flex ${stacked ? "flex-col items-center text-center" : "items-center gap-2"} ${className}`} aria-label="CasaVilla Property Management">
      <LogoMark className={s.mark} />
      <span className={`flex flex-col ${stacked ? "items-center" : ""}`}>
        <span className={`font-serif font-semibold leading-none ${s.word} ${name}`}>CasaVilla</span>
        <span className={`mt-1 font-semibold uppercase leading-none ${s.tag} ${sub}`}>Property Management</span>
      </span>
    </span>
  );
}

const tone: Record<string, string> = {
  green: "bg-brand-50 text-brand-700",
  red: "bg-maroon-50 text-maroon-600",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-sky-50 text-sky-700",
  gold: "bg-gold-50 text-gold-700",
  gray: "bg-stone-100 text-stone-600",
};
const statusTone: Record<string, keyof typeof tone> = {
  paid: "green", success: "green", active: "green", approved: "green", done: "green", delivered: "green", vacant: "green", current: "green",
  unpaid: "red", failed: "red", rejected: "red", cancelled: "gray", suspended: "red", urgent: "red", overdue: "red",
  partial: "amber", pending: "amber", open: "amber", placed: "amber",
  assigned: "blue", accepted: "blue", in_progress: "blue", confirmed: "blue", occupied: "blue",
  ended: "gray", withdrawn: "gray", normal: "gray", low: "gray",
};

export function Badge({ children, color }: { children: React.ReactNode; color?: keyof typeof tone }) {
  const key = color ?? statusTone[String(children)] ?? "gray";
  return <span className={`pill capitalize ${tone[key]}`}>{String(children).replace("_", " ")}</span>;
}

export function Stat({ label, value, hint, href, icon }: { label: string; value: React.ReactNode; hint?: string; href?: string; icon?: React.ReactNode }) {
  const inner = (
    <div className="card h-full p-4">
      {icon && <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</div>}
      <div className="text-lg font-bold leading-tight text-brand-950 sm:text-2xl">{value}</div>
      <div className="mt-1 text-xs font-medium text-stone-500">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-stone-400">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block transition hover:-translate-y-0.5">{inner}</Link> : inner;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center">
      <div className="font-semibold text-brand-950">{title}</div>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="h1 hidden lg:block">{title}</h1>
        {subtitle && <p className="muted mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** "Title ........ View all" row above a list. */
export function SectionTitle({ title, href, cta = "View all" }: { title: string; href?: string; cta?: string }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="h2">{title}</h2>
      {href && <Link href={href} className="text-xs font-semibold text-brand-700 hover:underline">{cta}</Link>}
    </div>
  );
}

/** Tappable list row with icon, used in menus and "Attention required" lists. */
export function ListRow({ href, icon, title, detail, right }: { href: string; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-stone-800">{title}</div>
        {detail && <div className="truncate text-xs text-stone-500">{detail}</div>}
      </div>
      {right}
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
    </Link>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

const avatarTones = ["bg-brand-700 text-white", "bg-gold-400 text-brand-950", "bg-brand-100 text-brand-800", "bg-gold-100 text-gold-700"];
export function Avatar({ name, className = "h-10 w-10 text-sm" }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const t = avatarTones[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % avatarTones.length];
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${t} ${className}`}>{initials || "?"}</span>;
}

export function Photo({ id, alt, className = "" }: { id?: number | null; alt: string; className?: string }) {
  if (!id)
    return (
      <div className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 to-brand-950 ${className}`}>
        <BuildingArt className="absolute inset-x-0 bottom-0 h-3/4 w-full text-white/10" />
        <Home className="relative h-8 w-8 text-gold-300/80" />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/files/${id}`} alt={alt} className={`object-cover ${className}`} />;
}

/** Line-art apartment blocks for hero backgrounds and photo placeholders. */
export function BuildingArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M0 200 V120 H40 V200 M40 200 V90 H110 V200 M110 200 V60 H180 V200 M180 200 V100 H230 V200 M230 200 V40 H310 V200 M310 200 V110 H360 V200 M360 200 V80 H400" />
      {[55, 75, 95].map((x) => [105, 130, 155, 180].map((y) => <rect key={`a${x}${y}`} x={x - 5} y={y} width="10" height="12" />))}
      {[125, 145, 165].map((x) => [75, 100, 125, 150, 175].map((y) => <rect key={`b${x}${y}`} x={x - 5} y={y} width="10" height="12" />))}
      {[245, 270, 295].map((x) => [55, 80, 105, 130, 155, 180].map((y) => <rect key={`c${x}${y}`} x={x - 6} y={y} width="12" height="12" />))}
    </svg>
  );
}

const dot: Record<string, string> = {
  red: "bg-maroon-500 text-white", gold: "bg-gold-400 text-brand-950", green: "bg-brand-700 text-white", blue: "bg-sky-600 text-white", gray: "bg-stone-300 text-stone-700",
};
/** "Attention required" list: coloured count circle, label, chevron. */
export function AttentionList({ rows }: { rows: { href: string; count: number; label: string; tone: keyof typeof dot }[] }) {
  return (
    <div className="card divide-y divide-stone-100 p-0">
      {rows.map((r) => (
        <ListRow key={r.label} href={r.href} title={r.label}
          icon={<span className={`flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold ${r.count ? dot[r.tone] : dot.gray}`}>{r.count}</span>} />
      ))}
    </div>
  );
}

/** Label/value row used in "Income overview" style cards. */
export function KeyRow({ icon, label, value, strong }: { icon?: React.ReactNode; label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 text-sm">
      {icon && <span className="text-stone-400">{icon}</span>}
      <span className="flex-1 text-stone-600">{label}</span>
      <span className={strong ? "font-bold text-brand-950" : "font-semibold text-stone-800"}>{value}</span>
    </div>
  );
}
