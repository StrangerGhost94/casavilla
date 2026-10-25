"use client";
import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { removePushSubscription, savePushSubscription, testPush } from "@/app/actions";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
const deviceName = () => (isIos() ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android phone" : "Computer");

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

/**
 * "Turn on phone notifications": asks the phone for permission, subscribes it and saves it to the account.
 * `card` is the prompt shown on dashboards (hidden once on); `row` is the setting in Profile / Notifications.
 */
export function PushToggle({ publicKey, variant = "row", text }: { publicKey: string | null; variant?: "card" | "row"; text?: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("unsupported");
      // iPhones only allow notifications for apps added to the home screen.
      if (isIos() && !standalone()) return setState("ios-install");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  const on = async () => {
    setBusy(true); setNote(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey!) }));
      const r = await savePushSubscription(JSON.parse(JSON.stringify(sub)), deviceName());
      if (!r.ok) throw new Error("save");
      setState("on");
      await testPush();
      setNote("Done. A test notification is on its way.");
    } catch {
      setNote("Couldn't turn them on. Check your connection and try again.");
    } finally { setBusy(false); }
  };

  const off = async () => {
    setBusy(true); setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  };

  if (state === "loading" || state === "unsupported") return null;
  if (variant === "card" && state === "on") return null;

  const hint = state === "ios-install"
    ? "On iPhone: tap Share, then “Add to Home Screen”, open CasaVilla from there, and turn notifications on."
    : state === "denied"
      ? "Notifications are blocked for CasaVilla. Allow them in your phone's settings (Settings → Notifications, or the site settings in your browser), then come back."
      : state === "on" ? "Reminders and updates pop up on this phone, even when the app is closed."
      : text ?? "Get rent reminders a few days before rent is due, and updates on payments and repairs, straight on this phone.";

  const button = state === "off" ? (
    <button type="button" onClick={on} disabled={busy} className="btn-primary btn-sm shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Turn on</button>
  ) : state === "on" ? (
    <button type="button" onClick={off} disabled={busy} className="btn-ghost btn-sm shrink-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Turn off</button>
  ) : null;

  if (variant === "card") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white"><Smartphone className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-brand-950">Phone notifications</div>
          <p className="mt-0.5 text-xs text-stone-600">{hint}</p>
          {note && <p className="mt-1 text-xs font-semibold text-brand-700">{note}</p>}
        </div>
        {button}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${state === "on" ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-700"}`}><BellRing className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-stone-800">Phone notifications <span className={`ml-1 text-xs font-semibold ${state === "on" ? "text-brand-700" : "text-stone-400"}`}>{state === "on" ? "On" : "Off"}</span></div>
        <p className="text-xs text-stone-500">{hint}</p>
        {note && <p className="mt-1 text-xs font-semibold text-brand-700">{note}</p>}
      </div>
      {button}
    </div>
  );
}
