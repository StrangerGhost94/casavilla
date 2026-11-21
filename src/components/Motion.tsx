"use client";
import { useEffect, useState } from "react";

/**
 * Numbers roll into place instead of jumping: each digit slides up its own strip, 100 ms after the one before,
 * with a slight overshoot. Works on any text ("UGX 2,500,000", "38% let"); only the digits move. Screen readers
 * get the plain text, and nothing moves for people who ask for reduced motion.
 */
export function RollingNumber({ text, className = "" }: { text: string; className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  let d = 0;
  return (
    <span className={`inline-flex whitespace-pre tabular-nums ${className}`} aria-label={text} role="text">
      {[...text].map((ch, i) => {
        if (!/\d/.test(ch)) return <span key={i} aria-hidden>{ch}</span>;
        const n = Number(ch), delay = d++ * 100;
        return (
          <span key={i} aria-hidden className="relative inline-block h-[1.15em] overflow-hidden leading-[1.15em]">
            <span className="block transition-transform duration-[800ms] ease-[cubic-bezier(.34,1.3,.64,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${(on ? n : 0) * 10}%)`, transitionDelay: `${delay}ms` }}>
              {"0123456789".split("").map((x) => <span key={x} className="block h-[1.15em]">{x}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** "Draw the win": the circle draws itself, then the tick (about half a second). */
export function SuccessTick({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <svg viewBox="0 0 52 52" className={`success-tick ${className}`} aria-hidden>
      <circle cx="26" cy="26" r="23" pathLength={100} className="success-tick-circle" />
      <path d="M15 27.5l7.5 7.5L37.5 19" pathLength={100} className="success-tick-check" />
    </svg>
  );
}
