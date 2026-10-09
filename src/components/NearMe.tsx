"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Crosshair, Loader2 } from "lucide-react";

/** "Homes near me": uses the phone's GPS once and searches by real distance. */
export function NearMe() {
  const router = useRouter();
  const sp = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const go = () => {
    if (!("geolocation" in navigator)) { setMsg("Location isn't available on this device."); return; }
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const q = new URLSearchParams(sp.toString());
        q.set("lat", p.coords.latitude.toFixed(5)); q.set("lng", p.coords.longitude.toFixed(5)); q.set("km", q.get("km") || "5"); q.delete("in");
        router.push(`/listings?${q}`);
      },
      (e) => { setBusy(false); setMsg(e.code === 1 ? "Allow location access to search near you." : "Couldn't find your position — try again."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  };
  return (
    <div>
      <button type="button" onClick={go} disabled={busy} className="chip">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />} Near me</button>
      {msg && <p className="mt-1 text-[11px] text-maroon-600">{msg}</p>}
    </div>
  );
}
