"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, Map as MapIcon, Trash2 } from "lucide-react";
import { inUganda } from "@/lib/geo-core";

type Pin = { lat: number; lng: number; acc: number | null; source: "gps" | "map" } | null;

/**
 * Optional exact position for a property: from the phone's GPS (with its accuracy) or a tap on the map.
 * Nothing is filled in automatically — a district centre is never stored as the property's position.
 */
export function PinPicker({ initial }: { initial?: Pin }) {
  const [pin, setPin] = useState<Pin>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);

  const gps = () => {
    if (!("geolocation" in navigator)) { setMsg("This device can't share its location."); return; }
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false);
        const { latitude: lat, longitude: lng, accuracy } = p.coords;
        if (!inUganda(lat, lng)) { setMsg("That position is outside Uganda — stand at the property and try again, or use the map."); return; }
        setPin({ lat, lng, acc: Math.round(accuracy), source: "gps" });
        if (accuracy > 100) setMsg(`Rough fix (±${Math.round(accuracy)} m). Move outside or adjust the pin on the map.`);
      },
      (e) => { setBusy(false); setMsg(e.code === 1 ? "Location permission was refused. You can drop a pin on the map instead." : "Couldn't get a GPS fix. Try again outside, or use the map."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2">
      <input type="hidden" name="lat" value={pin ? pin.lat.toFixed(6) : ""} />
      <input type="hidden" name="lng" value={pin ? pin.lng.toFixed(6) : ""} />
      <input type="hidden" name="coordAccuracyM" value={pin?.acc ?? ""} />
      <input type="hidden" name="coordSource" value={pin?.source ?? ""} />
      <div className="label">Exact position (optional)</div>
      {pin ? (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-semibold text-brand-900">{pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}</span>
            <span className="block text-[11px] text-stone-500">{pin.source === "gps" ? `From GPS${pin.acc ? ` · ±${pin.acc} m` : ""}` : "Pinned on the map"}</span>
          </span>
          <button type="button" onClick={() => setPin(null)} className="rounded-full p-1.5 text-stone-400 hover:bg-white hover:text-maroon-600" aria-label="Remove position"><Trash2 className="h-4 w-4" /></button>
        </div>
      ) : <p className="text-[11px] text-stone-500">Add one so tenants and providers can find the property and “near me” search works.</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={gps} disabled={busy} className="btn-outline btn-sm py-2">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />} I&apos;m at the property</button>
        <button type="button" onClick={() => setShowMap((s) => !s)} className="btn-outline btn-sm py-2"><MapIcon className="h-4 w-4" /> {showMap ? "Hide map" : "Pick on map"}</button>
      </div>
      {msg && <p className="text-[11px] text-gold-700">{msg}</p>}
      {showMap && <MapPick pin={pin} onPick={(lat, lng) => { setPin({ lat, lng, acc: null, source: "map" }); setMsg(null); }} />}
    </div>
  );
}

function MapPick({ pin, onPick }: { pin: Pin; onPick: (lat: number, lng: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !el.current) return;
        const start: [number, number] = pin ? [pin.lat, pin.lng] : [0.3136, 32.5811]; // Kampala, only to start the view
        map = L.map(el.current, { zoomControl: true }).setView(start, pin ? 17 : 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
        const icon = L.divIcon({ className: "", html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#124331;border:3px solid #d2a84a;transform:rotate(-45deg)"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
        let marker = pin ? L.marker([pin.lat, pin.lng], { icon }).addTo(map) : null;
        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          if (!inUganda(e.latlng.lat, e.latlng.lng)) return;
          if (marker) marker.setLatLng(e.latlng); else marker = L.marker(e.latlng, { icon }).addTo(map!);
          onPick(e.latlng.lat, e.latlng.lng);
        });
      } catch { setErr(true); }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <p className="rounded-xl bg-maroon-50 p-3 text-xs text-maroon-700">The map couldn&apos;t load (offline?). Use “I&apos;m at the property” instead.</p>;
  return (
    <div>
      <div ref={el} className="h-64 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100" />
      <p className="mt-1 text-[11px] text-stone-500">Tap the exact spot of the building. Zoom in for accuracy.</p>
    </div>
  );
}
