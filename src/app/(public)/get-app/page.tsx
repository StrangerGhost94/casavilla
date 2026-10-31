import { BellRing, Receipt, Smartphone, WifiOff, Wrench } from "lucide-react";
import { siGoogleplay } from "simple-icons";
import { PLAY_URL } from "@/lib/android";
import { InfoPage } from "@/components/InfoPage";
import { InstallNow } from "@/components/InstallApp";

export const metadata = {
  title: "Get the CasaVilla App — Rent, Stays & Land in Your Pocket",
  description: "Install the free CasaVilla app: pay rent by Mobile Money, get reminders before rent is due, report repairs, and find homes, short stays and land in Uganda.",
  alternates: { canonical: "/get-app" },
};

const WHY = [
  [Smartphone, "Pay by Mobile Money", "Rent, stays and building stages — approve on your phone."],
  [BellRing, "Reminders on your phone", "A heads-up before rent is due, and news on your applications and repairs."],
  [Receipt, "Every receipt kept", "Download or share a receipt any time."],
  [Wrench, "Repairs from your pocket", "Report a problem with a photo and follow it until it's fixed."],
  [WifiOff, "Light and quick", "Opens full-screen, loads fast and keeps working on a weak connection."],
] as const;

export default function GetApp() {
  return (
    <InfoPage title="Get the CasaVilla app" intro="Free. Small download. Everything CasaVilla, one tap away." crumb="Get the app">
      <section className="rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="CasaVilla app icon" className="h-16 w-16 rounded-[22%] shadow-card" />
          <div><div className="text-lg font-bold text-brand-950">CasaVilla</div><div className="text-sm text-stone-500">Homes, rent & property · Uganda</div></div>
        </div>
        <div className="mt-5 space-y-4">
          {PLAY_URL && (
            <a href={PLAY_URL} className="inline-flex items-center gap-3 rounded-xl bg-black px-4 py-2.5 text-white hover:bg-stone-800">
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden><path d={siGoogleplay.path} /></svg>
              <span className="leading-tight"><span className="block text-[10px] uppercase tracking-wide text-white/70">Get it on</span><span className="block text-base font-semibold">Google Play</span></span>
            </a>
          )}
          <InstallNow />
        </div>
      </section>
      <h2 className="mt-8 text-lg font-bold text-brand-950">Why use the app</h2>
      <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {WHY.map(([I, t, d]) => (
          <li key={t} className="flex gap-3 rounded-2xl border border-stone-200/70 bg-white p-4">
            <I className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <span className="text-sm text-stone-700"><b className="block text-brand-950">{t}</b>{d}</span>
          </li>
        ))}
      </ul>
    </InfoPage>
  );
}
