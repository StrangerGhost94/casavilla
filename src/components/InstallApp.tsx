"use client";
import { useEffect, useState } from "react";
import { PlusSquare, Share, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "cv_install_dismissed";
const DISMISS_DAYS = 7;

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}
function recentlyDismissed() {
  try { const t = Number(localStorage.getItem(DISMISS_KEY)); return t > 0 && Date.now() - t < DISMISS_DAYS * 86400000; } catch { return false; }
}

/** Registers the service worker (production only) so the app can be installed and works offline. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => { /* not fatal */ });
  }, []);
  return null;
}

function AppIcon({ className = "h-12 w-12" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/icons/apple-touch-icon.png" alt="" className={`${className} rounded-[22%] shadow-card`} />;
}

/**
 * "Get the CasaVilla app" card for phone browsers. Android/Chrome installs in one tap;
 * iPhone shows the Share → Add to Home Screen steps. Hidden inside the installed app.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "android" | "ios">("none");
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [sheet, setSheet] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (m: "android" | "ios") => { setMode(m); timer = setTimeout(() => setVisible(true), 2500); };
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); show("android"); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (ios) show("ios");
    const onInstalled = () => setVisible(false);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); if (timer) clearTimeout(timer); };
  }, []);

  const dismiss = () => {
    setVisible(false); setSheet(false);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
  };
  const install = async () => {
    if (mode === "ios") { setSheet(true); return; }
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setEvt(null);
  };

  if (mode === "none" || !visible) return null;
  return (
    <>
      <div className="no-print fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-md animate-fade-up lg:hidden">
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-brand-950/95 p-3 pr-2 text-white shadow-float backdrop-blur">
          <AppIcon className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">Get the CasaVilla app</div>
            <div className="truncate text-xs text-white/65">Faster, full-screen, right on your home screen</div>
          </div>
          <button type="button" onClick={install} className="btn-gold btn-sm px-3.5 py-2">Install</button>
          <button type="button" onClick={dismiss} aria-label="Not now" className="rounded-full p-1.5 text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-[60] flex items-end bg-black/40 animate-fade-in" onClick={() => setSheet(false)}>
          <div className="w-full animate-sheet-up rounded-t-[2rem] bg-white px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-stone-200" />
            <div className="flex items-center gap-3">
              <AppIcon className="h-14 w-14" />
              <div>
                <div className="font-semibold text-brand-950">Install CasaVilla</div>
                <div className="text-xs text-stone-500">Add it to your home screen in two taps</div>
              </div>
            </div>
            <ol className="mt-6 space-y-4 text-sm text-stone-700">
              <li className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Share className="h-[18px] w-[18px]" /></span>
                <span>Tap the <b>Share</b> button in Safari&apos;s toolbar</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><PlusSquare className="h-[18px] w-[18px]" /></span>
                <span>Scroll down and choose <b>Add to Home Screen</b></span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-sm font-bold text-gold-700">3</span>
                <span>Tap <b>Add</b> — CasaVilla appears with your other apps</span>
              </li>
            </ol>
            <button type="button" onClick={dismiss} className="btn-primary btn-lg mt-7 w-full rounded-2xl">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
