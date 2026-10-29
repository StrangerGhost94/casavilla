"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./ui";

/**
 * The installed app's launch screen: a short branded splash (a little house draws itself and lights up), then straight into the marketplace.
 * No sign-up wall — people browse first and sign in or join when they want to apply, pay or list.
 */
export function AppIntro({ to = "/" }: { to?: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(to);
    const t = setTimeout(() => router.replace(to), 2100);
    return () => clearTimeout(t);
  }, [router, to]);
  return (
    <main className="launch-screen fixed inset-0 select-none overflow-hidden bg-brand-950 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/launch.jpg" alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full animate-ken-burns object-cover" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-x-0 top-[calc(11vh+env(safe-area-inset-top))] flex justify-center px-8">
        <Logo tone="light" size="xl" className="animate-fade-up [animation-delay:.1s]" />
      </div>
      <div role="status" aria-label="Loading" className="absolute inset-x-0 top-[54%] -mt-16 flex animate-fade-up justify-center [animation-delay:.3s]">
        <span className="absolute top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,0,0,.5),transparent)]" aria-hidden />
        <svg viewBox="0 0 72 60" className="home-draw relative" aria-hidden>
          <path className="ln" pathLength={1} d="M5 31 L36 7 L67 31" stroke="#d2a84a" strokeWidth={3.5} />
          <path className="ln" pathLength={1} d="M52 19 V10 H59 V24" stroke="#d2a84a" strokeWidth={3} />
          <path className="ln b" pathLength={1} d="M14 27 V55 H58 V27" stroke="#f6f4ee" strokeWidth={2.5} />
          <path className="ln c" pathLength={1} d="M31 55 V41 H41 V55" stroke="#f6f4ee" strokeWidth={2.5} />
          <rect className="win" x={19} y={34} width={7} height={7} rx={1} />
          <rect className="win b" x={46} y={34} width={7} height={7} rx={1} />
        </svg>
      </div>
      <div className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col items-center px-8 text-center">
        <div className="animate-fade-up whitespace-nowrap text-[clamp(1.3rem,6.6vw,1.75rem)] font-semibold leading-tight drop-shadow [animation-delay:.3s]">Connect. Manage. Grow.</div>
        <div className="mt-2 animate-fade-up text-[15px] text-white/85 drop-shadow [animation-delay:.4s]">Rent, stay or buy — all in one place.</div>
      </div>
    </main>
  );
}
