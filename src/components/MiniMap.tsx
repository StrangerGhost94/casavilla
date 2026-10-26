"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

/** A small, still map with the home's pin. Loads only when scrolled near, to keep pages light on mobile data. */
export function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setShow(true); io.disconnect(); } }, { rootMargin: "200px" });
    if (el.current) io.observe(el.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!show) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !el.current) return;
        map = L.map(el.current, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, boxZoom: false, keyboard: false, attributionControl: true }).setView([lat, lng], 16);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        const icon = L.divIcon({ className: "", html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#124331;border:3px solid #d2a84a;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>', iconSize: [26, 26], iconAnchor: [13, 26] });
        L.marker([lat, lng], { icon, title: label }).addTo(map);
      } catch { setErr(true); }
    })();
    return () => { cancelled = true; map?.remove(); };
  }, [show, lat, lng, label]);
  return err ? null : <div ref={el} role="img" aria-label={`Map showing ${label}`} className="h-44 w-full bg-stone-100" />;
}
