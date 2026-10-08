import Link from "next/link";

export function Logo({ className = "h-10" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="CasaVilla Property Management" className={`${className} w-auto`} />;
}

const tone: Record<string, string> = {
  green: "bg-brand-50 text-brand-700 ring-brand-100",
  red: "bg-maroon-50 text-maroon-600 ring-maroon-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  blue: "bg-sky-50 text-sky-700 ring-sky-100",
  gray: "bg-stone-100 text-stone-600 ring-stone-200",
};
const statusTone: Record<string, keyof typeof tone> = {
  paid: "green", success: "green", active: "green", approved: "green", done: "green", delivered: "green", vacant: "green",
  unpaid: "red", failed: "red", rejected: "red", cancelled: "gray", suspended: "red", urgent: "red", overdue: "red",
  partial: "amber", pending: "amber", open: "amber", placed: "amber",
  assigned: "blue", accepted: "blue", in_progress: "blue", confirmed: "blue", occupied: "blue",
  ended: "gray", withdrawn: "gray", normal: "gray", low: "gray",
};

export function Badge({ children, color }: { children: React.ReactNode; color?: keyof typeof tone }) {
  const key = color ?? statusTone[String(children)] ?? "gray";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ${tone[key]}`}>
      {String(children).replace("_", " ")}
    </span>
  );
}

export function Stat({ label, value, hint, href }: { label: string; value: React.ReactNode; hint?: string; href?: string }) {
  const inner = (
    <div className="card h-full p-4 sm:p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-stone-900 sm:text-2xl">{value}</div>
      {hint && <div className="mt-1 text-xs text-stone-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{inner}</Link> : inner;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <div className="font-semibold text-stone-700">{title}</div>
      {children && <div className="mt-1 text-sm text-stone-500">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="h1">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
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

export function Photo({ id, alt, className = "" }: { id?: number | null; alt: string; className?: string }) {
  if (!id)
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-50 to-maroon-50 text-brand-600 ${className}`}>
        <svg viewBox="0 0 64 64" className="h-10 w-10 opacity-70"><path d="M12 42 L32 14 L52 42" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round"/><rect x="28" y="28" width="8" height="8" fill="currentColor"/></svg>
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/files/${id}`} alt={alt} className={`object-cover ${className}`} />;
}
