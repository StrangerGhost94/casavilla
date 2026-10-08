import { WifiOff } from "lucide-react";
import { Logo } from "@/components/ui";

// Shown by the service worker when the phone has no connection.
export const dynamic = "force-static";
export const metadata = { title: "Offline" };

export default function Offline() {
  return (
    <main className="fixed inset-0 flex flex-col items-center overflow-hidden bg-brand-900 px-8 text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/45 to-black/80" />
      <div className="relative mt-[22vh] flex flex-col items-center">
        <Logo tone="light" size="lg" />
        <span className="mt-12 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10"><WifiOff className="h-7 w-7 text-gold-300" /></span>
        <h1 className="mt-5 text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 max-w-xs text-sm text-white/70">Check your data or Wi-Fi connection. CasaVilla will be right here when you&apos;re back online.</p>
        <a href="/app" className="btn-gold mt-7 px-8">Try again</a>
      </div>
    </main>
  );
}
