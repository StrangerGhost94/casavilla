import Link from "next/link";
import { BadgeCheck, Check, ChevronRight, Loader2, MapPin, Smartphone, Wrench } from "lucide-react";
import { Reveal } from "./Reveal";

/**
 * "One home, one app": the five things CasaVilla does after the search, each shown as a small preview of the
 * real screen it leads to. One swipeable row on phones, five columns on a computer.
 * Animated in CSS (globals.css, "jny-"): cards rise in on view, then each preview acts out its step.
 */
export function Journey({ signedIn, tenant }: { signedIn: boolean; tenant: boolean }) {
  const mine = (path: string) => (tenant ? path : signedIn ? "/listings" : `/register?role=tenant&next=${encodeURIComponent(path)}`);
  const steps = [
    { n: "01", title: "Find", body: "Homes, stays, land — with the Verified badge.", href: "/listings", preview: <FindPreview /> },
    { n: "02", title: "Move in", body: "Apply, sign and inspect room by room.", href: mine("/tenant"), preview: <MoveInPreview /> },
    { n: "03", title: "Pay", body: "Rent and bills on Mobile Money, receipts kept.", href: mine("/tenant"), preview: <PayPreview /> },
    { n: "04", title: "Fix", body: "Report a repair; a vetted provider comes.", href: "/services", preview: <FixPreview /> },
    { n: "05", title: "Own", body: "List, sell, or let us manage and collect rent.", href: "/list", preview: <OwnPreview /> },
  ];
  return (
    <Reveal className="jny mt-12">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-700">One home, one app</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <h2 className="text-xl font-bold leading-tight text-brand-950 md:text-2xl">Everything after you find it</h2>
        {!signedIn && <Link href="/register" className="hidden shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700 md:flex">Create a free account <ChevronRight className="h-4 w-4" /></Link>}
      </div>
      <ol className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:overflow-visible md:px-0">
        {steps.map((s, i) => (
          <li key={s.n} style={{ "--i": i } as React.CSSProperties} className="jny-card w-[46vw] max-w-[12.5rem] shrink-0 snap-start md:w-auto md:max-w-none">
            <Link href={s.href} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
              <div className="flex h-28 items-center justify-center bg-gradient-to-br from-brand-50 to-cream px-2.5"><div className="jny-loop jny-float flex w-full justify-center">{s.preview}</div></div>
              <div className="flex flex-1 flex-col p-3.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold tabular-nums text-gold-700">{s.n}</span>
                  <span className="font-semibold text-brand-950">{s.title}</span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-stone-500">{s.body}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      {!signedIn && (
        <Link href="/register" className="mt-2 flex items-center justify-center gap-0.5 text-sm font-semibold text-brand-700 md:hidden">Create a free account <ChevronRight className="h-4 w-4" /></Link>
      )}
    </Reveal>
  );
}

/* Small, static previews of each screen — illustrations, not live data. */
const Chip = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`relative w-full max-w-[11rem] overflow-hidden rounded-xl bg-white p-2 text-[10px] leading-snug shadow-card ${className}`}>{children}</div>
);

function FindPreview() {
  return (
    <Chip>
      <div className="flex items-center justify-between">
        <span className="font-bold text-brand-950">UGX 850,000</span>
        <span className="jny-loop jny-badge flex items-center gap-0.5 text-[10px] font-semibold text-brand-700"><BadgeCheck className="h-3 w-3" /> Verified</span>
      </div>
      <div className="mt-0.5 text-stone-500">2 bedroom · per month</div>
      <div className="mt-1.5 flex items-center gap-1 text-stone-400"><MapPin className="h-3 w-3" /> Ntinda, Kampala</div>
      <span aria-hidden className="jny-loop jny-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/80 to-transparent" style={{ transform: "translateX(-120%)" }} />
    </Chip>
  );
}

function MoveInPreview() {
  return (
    <Chip className="space-y-1.5">
      {["Application approved", "Lease signed", "Move-in inspection"].map((t, i) => (
        <div key={t} className="flex items-center gap-1.5">
          <span style={{ "--k": i } as React.CSSProperties} className="jny-loop jny-tick flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-brand-700 bg-brand-700 text-white"><Check className="h-2.5 w-2.5" /></span>
          <span className="text-stone-700">{t}</span>
        </div>
      ))}
    </Chip>
  );
}

function PayPreview() {
  return (
    <Chip>
      <div className="flex items-center gap-1.5 text-stone-500"><Smartphone className="h-3.5 w-3.5 text-gold-600" /> Mobile Money</div>
      <div className="mt-1 text-sm font-bold leading-none text-brand-950">UGX 850,000</div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="relative inline-flex">
          <span className="jny-loop jny-sending absolute inset-0 flex opacity-0 items-center gap-1 whitespace-nowrap text-[10px] text-stone-500"><Loader2 className="h-3 w-3 animate-spin" /> Sending</span>
          <span className="jny-loop jny-paid inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700"><Check className="h-2.5 w-2.5" /> Paid</span>
        </span>
        <span className="text-[10px] text-stone-400">Receipt saved</span>
      </div>
    </Chip>
  );
}

function FixPreview() {
  return (
    <Chip>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold-400 text-brand-950"><Wrench className="h-3.5 w-3.5" /></span>
        <div className="min-w-0">
          <div className="font-semibold text-brand-950">Plumber assigned</div>
          <div className="text-[10px] text-stone-500">Kitchen sink leak</div>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100"><div className="jny-loop jny-bar h-1 w-full rounded-full bg-brand-600" /></div>
      <div className="mt-1 flex justify-between text-[9px] text-stone-400"><span>Reported</span><span>On the way</span><span>Fixed</span></div>
    </Chip>
  );
}

function OwnPreview() {
  const bars = [40, 55, 48, 70, 62, 85];
  return (
    <Chip>
      <div className="text-stone-500">Rent collected</div>
      <div className="mt-0.5 font-bold text-brand-950">This month</div>
      <div className="mt-1.5 flex h-8 items-end gap-1">
        {bars.map((h, i) => <span key={i} className={`jny-loop jny-col flex-1 rounded-sm ${i === bars.length - 1 ? "bg-gold-400" : "bg-brand-200"}`} style={{ height: `${h}%`, "--k": i * 0.25 } as React.CSSProperties} />)}
      </div>
    </Chip>
  );
}
