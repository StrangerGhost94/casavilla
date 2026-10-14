"use client";
import { useEffect, useRef } from "react";

/**
 * Marks its section `data-in` the first time it scrolls into view (entrance animations start then) and
 * `data-live` while it stays visible, so looping animations pause off-screen and don't waste battery.
 */
export function Reveal({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { el.dataset.in = ""; el.dataset.live = ""; return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.dataset.in = ""; el.dataset.live = ""; }
      else delete el.dataset.live;
    }, { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} className={className}>{children}</section>;
}
