"use client";
import { useRef, useState } from "react";
import { Check, Loader2, MapPin, Sparkles, X } from "lucide-react";
import { addressLine, type Crumb } from "@/lib/geo-core";
import { LocationPicker } from "./LocationPicker";
import { PinPicker } from "./PinPicker";

type Details = { estate: string; street: string; building: string; plot: string; landmark: string };
type Pin = { lat: number; lng: number; acc: number | null; source: "gps" | "map" } | null;
type Found = { street: string | null; estate: string | null; place: (Crumb & { trail: Crumb[] }) | null; label: string | null };

/**
 * The address form: the official place, the street details, and an optional pin — working together.
 * Dropping a pin (or "I'm at the property") looks the spot up and offers to fill the area, estate and street;
 * a preview shows the address exactly as tenants will see it.
 */
export function PlaceInput({ initial, details: initialDetails, pin, showDetails = true, showPin = true }: {
  initial: Crumb[]; details: Details; pin: Pin; showDetails?: boolean; showPin?: boolean;
}) {
  const [trail, setTrail] = useState<Crumb[]>(initial);
  const [seed, setSeed] = useState<{ key: number; trail: Crumb[] }>({ key: 0, trail: initial });
  const [d, setD] = useState<Details>(initialDetails);
  const [found, setFound] = useState<Found | null>(null);
  const [looking, setLooking] = useState(false);
  const asked = useRef(0);
  const last = trail[trail.length - 1];
  const placeId = last && !["country", "region"].includes(last.level) ? last.id : null;

  const lookUp = async (lat: number, lng: number) => {
    const n = ++asked.current;
    setLooking(true); setFound(null);
    try {
      const r = (await fetch(`/api/locations?near=${lat.toFixed(5)},${lng.toFixed(5)}`).then((x) => (x.ok ? x.json() : null))) as Found | null;
      if (n !== asked.current) return;
      // Only worth offering if it adds something the form doesn't already say.
      const sameArea = r?.place && trail.some((c) => c.id === r.place!.id);
      if (r && (r.place && !sameArea || (r.street && !d.street) || (r.estate && !d.estate))) setFound(r);
    } catch { /* no suggestion; the person types it */ } finally { if (n === asked.current) setLooking(false); }
  };

  const useFound = () => {
    if (!found) return;
    if (found.place) setSeed((s) => ({ key: s.key + 1, trail: found.place!.trail }));
    setD((x) => ({ ...x, street: x.street || found.street || "", estate: x.estate || found.estate || "" }));
    setFound(null);
  };

  const set = (k: keyof Details) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  const preview = addressLine(d, trail);

  return (
    <div className="space-y-4">
      <LocationPicker key={seed.key} initial={seed.trail} onChange={setTrail} label="Where is it?" required
        hint="Type the area (e.g. Ntinda, Kira, Kololo) or pick from the lists. A division or sub-county is fine if you don't know the cell." />

      {showPin && (
        <div className="rounded-2xl border border-stone-200 bg-white p-3">
          <PinPicker initial={pin} locationId={placeId} onPin={lookUp} />
          {looking && <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding the address for this spot…</p>}
          {found && (
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/70 p-3 text-sm">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-brand-950">This spot looks like {found.label ?? found.estate ?? "this area"}</div>
                <div className="text-xs text-stone-600">{[found.street && `Street: ${found.street}`, found.estate && `Estate: ${found.estate}`].filter(Boolean).join(" · ") || "Fill the area from the map?"}</div>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={useFound} className="btn-primary btn-sm"><Check className="h-4 w-4" /> Use this</button>
                  <button type="button" onClick={() => setFound(null)} className="btn-ghost btn-sm"><X className="h-4 w-4" /> No thanks</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {showDetails && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="label">Estate / neighbourhood</span><input name="estate" value={d.estate} onChange={set("estate")} className="input" maxLength={120} placeholder="e.g. Kansanga" /></label>
          <label className="block"><span className="label">Street</span><input name="street" value={d.street} onChange={set("street")} className="input" maxLength={120} placeholder="e.g. Rubaga Road" /></label>
          <label className="block"><span className="label">Building</span><input name="building" value={d.building} onChange={set("building")} className="input" maxLength={120} /></label>
          <label className="block"><span className="label">Plot no.</span><input name="plot" value={d.plot} onChange={set("plot")} className="input" maxLength={40} /></label>
          <label className="col-span-2 block"><span className="label">Landmark / directions</span><input name="landmark" value={d.landmark} onChange={set("landmark")} className="input" maxLength={300} placeholder="e.g. Opposite Rubaga Cathedral gate" /></label>
        </div>
      )}

      {preview && (
        <div className="flex items-start gap-2.5 rounded-xl bg-stone-50 px-3 py-2.5 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
          <div className="min-w-0"><div className="text-[11px] text-stone-500">Tenants will see</div><div className="font-medium text-stone-800">{preview}</div>
            {d.landmark && <div className="text-xs text-stone-500">{d.landmark}</div>}</div>
        </div>
      )}
    </div>
  );
}
