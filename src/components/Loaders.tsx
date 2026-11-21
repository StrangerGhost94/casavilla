"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Smartphone } from "lucide-react";

/** The one spinner: something is happening and it will be quick. */
export function Spinner({ className = "h-4 w-4", label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <span aria-hidden className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:[animation-duration:1.6s] ${className}`} />
      {label && <span>{label}</span>}
    </span>
  );
}

/** Pulsing rings: waiting on someone else (approve on your phone), not on us. */
export function PulseWait({ icon: Icon = Smartphone }: { icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <span aria-hidden className="relative mx-auto flex h-16 w-16 items-center justify-center">
      <span className="absolute inset-0 animate-ping rounded-full bg-brand-200/70 motion-reduce:animate-none" />
      <span className="absolute inset-2 animate-pulse rounded-full bg-brand-100 motion-reduce:animate-none" />
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-white"><Icon className="h-5 w-5" /></span>
    </span>
  );
}

/**
 * Covers the screen while a slow step can't be interrupted (sending a Mobile Money request, clearing data).
 * Only for those: everyday saves use the button loader.
 */
export function FullScreenLoader({ show, title, note }: { show: boolean; title: string; note?: string }) {
  if (!show) return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-busy="true" aria-label={title}
      className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-cream/90 px-8 text-center backdrop-blur-sm">
      <Spinner className="h-10 w-10 border-[3px] text-brand-700" />
      <div className="mt-4 text-lg font-semibold text-brand-950">{title}</div>
      {note && <div className="mt-1 max-w-xs text-sm text-stone-600">{note}</div>}
    </div>
  );
}

/**
 * Pull down at the top of the page to refresh. Only in the installed app: browsers already have their own,
 * and an installed app on Android or iPhone doesn't.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, start] = useTransition();
  const startY = useRef<number | null>(null);
  const pulled = useRef(0);
  const TRIGGER = 70;

  useEffect(() => {
    if (!window.matchMedia("(display-mode: standalone)").matches && !(navigator as { standalone?: boolean }).standalone) return;
    const down = (e: TouchEvent) => { startY.current = window.scrollY <= 0 && !document.querySelector("[role=dialog],[role=alertdialog]") ? e.touches[0].clientY : null; };
    const move = (e: TouchEvent) => {
      if (startY.current == null) return;
      const d = e.touches[0].clientY - startY.current;
      pulled.current = d > 0 ? Math.min(110, d * 0.5) : 0;
      setPull(pulled.current);
    };
    const up = () => {
      if (startY.current == null) return;
      startY.current = null;
      if (pulled.current >= TRIGGER) start(() => router.refresh());
      pulled.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", down, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", up);
    return () => { window.removeEventListener("touchstart", down); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", up); };
  }, [router]);

  const shown = refreshing ? TRIGGER : pull;
  if (!shown) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center" style={{ transform: `translateY(calc(env(safe-area-inset-top) + ${shown - 30}px))` }}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-700 shadow-float">
        {refreshing ? <Spinner className="h-5 w-5" label="" /> : <ArrowDown className="h-5 w-5 transition" style={{ transform: `rotate(${pull >= TRIGGER ? 180 : 0}deg)` }} />}
      </span>
      {refreshing && <span className="sr-only">Refreshing</span>}
    </div>
  );
}

/**
 * Infinite scroll: shows the first page from the server, then asks for the next one as the last card comes
 * into view, with skeleton cards in the gap. A "Show more" button stays as a fallback (and for screen readers).
 */
export function InfiniteList({ first, firstDone, loadMore, skeleton, className, endText = "That's everything." }: {
  first: React.ReactNode; firstDone: boolean; loadMore: (page: number) => Promise<{ items: React.ReactNode; done: boolean }>;
  skeleton: React.ReactNode; className: string; endText?: string;
}) {
  const [pages, setPages] = useState<React.ReactNode[]>([]);
  const [done, setDone] = useState(firstDone);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const next = useCallback(async () => {
    if (loading || done) return;
    setLoading(true); setFailed(false);
    try {
      const r = await loadMore(pages.length + 1);
      setPages((p) => [...p, r.items]);
      setDone(r.done);
    } catch { setFailed(true); }
    setLoading(false);
  }, [loading, done, loadMore, pages.length]);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || failed) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) next(); }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [next, done, failed]);
  return (
    <>
      <div className={className}>
        {first}
        {pages}
        {loading && skeleton}
      </div>
      <div ref={sentinel} className="flex justify-center py-6 text-sm text-stone-500">
        {failed ? <button type="button" onClick={next} className="btn-outline btn-sm">Couldn&apos;t load more — try again</button>
          : done ? <span>{endText}</span>
          : loading ? <Spinner label="Loading more…" />
          : <button type="button" onClick={next} className="btn-ghost btn-sm">Show more</button>}
      </div>
    </>
  );
}
