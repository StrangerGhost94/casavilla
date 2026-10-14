"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./ui";

/**
 * The installed app's launch screen: a short branded splash, then straight into the marketplace.
 * No sign-up wall — people browse first and sign in or join when they want to apply, pay or list.
 */
export function AppIntro({ to = "/" }: { to?: string }) {
  const router = useRouter();
  useEffect(() => {
    router.prefetch(to);
    const t = setTimeout(() => router.replace(to), 1200);
    return () => clearTimeout(t);
  }, [router, to]);
  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-brand-950 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/launch.jpg" alt="" aria-hidden draggable={false} className="absolute inset-0 h-full w-full animate-ken-burns object-cover" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-x-0 top-[calc(11vh+env(safe-area-inset-top))] flex justify-center px-8">
        <Logo tone="light" size="xl" className="animate-fade-up [animation-delay:.1s]" />
      </div>
      <div className="absolute inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex flex-col items-center px-8 text-center">
        <div className="animate-fade-up whitespace-nowrap text-[clamp(1.3rem,6.6vw,1.75rem)] font-semibold leading-tight drop-shadow [animation-delay:.3s]">Connect. Manage. Grow.</div>
        <div className="mt-2 animate-fade-up text-[15px] text-white/85 drop-shadow [animation-delay:.4s]">Rent, stay or buy — all in one place.</div>
      </div>
      <div className="absolute bottom-[calc(2.25rem+env(safe-area-inset-bottom))] left-1/2 h-1 w-28 -translate-x-1/2 overflow-hidden rounded-full bg-white/20">
        <div className="h-full origin-left animate-load-bar rounded-full bg-gold-400 [animation-duration:1.2s]" />
      </div>
    </main>
  );
}
