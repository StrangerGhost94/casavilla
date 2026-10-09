import { Sparkles } from "lucide-react";
import { suggestFromText, trailFor, crumbText } from "@/lib/geo";
import { Field } from "./ui";
import { LocationPicker } from "./LocationPicker";
import { PinPicker } from "./PinPicker";

type Place = {
  locationId?: string | null; location?: string | null; estate?: string | null; street?: string | null; building?: string | null;
  plot?: string | null; landmark?: string | null; lat?: number | null; lng?: number | null; coordAccuracyM?: number | null; coordSource?: string | null;
};

/**
 * The one set of location inputs every form uses: canonical place (dependent picker), property-level address
 * details, and an optional exact pin. For an old text-only address, a match is suggested for the user to check.
 */
export async function PlaceFields({ p, pin = true, details = true }: { p?: Place; pin?: boolean; details?: boolean }) {
  let initial = await trailFor(p?.locationId);
  let suggestion: string | null = null;
  if (!p?.locationId && p?.location) {
    const s = await suggestFromText(p.location);
    if (s.best) { initial = s.best.trail.some((c) => c.id === s.best!.id) ? s.best.trail : [...s.best.trail, s.best]; suggestion = crumbText(initial, true); }
  }
  return (
    <div className="space-y-3">
      {p?.location && !p.locationId && (
        <div className="flex gap-2 rounded-xl border border-gold-200 bg-gold-50/60 p-3 text-xs text-stone-700">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
          <span>
            Old address: <b>“{p.location}”</b>.{" "}
            {suggestion ? <>We matched it to <b>{suggestion}</b> — check it, narrow it down if you can, then save.</> : <>Choose its place from the official list below, then save.</>}
          </span>
        </div>
      )}
      <LocationPicker initial={initial} label="Where is it?" required hint="Pick as far down as you know. A district or sub-county is fine if you don't know the village." />
      {details && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Estate / neighbourhood"><input name="estate" defaultValue={p?.estate ?? ""} className="input" maxLength={120} placeholder="e.g. Kansanga" /></Field>
          <Field label="Street"><input name="street" defaultValue={p?.street ?? ""} className="input" maxLength={120} placeholder="e.g. Rubaga Road" /></Field>
          <Field label="Building"><input name="building" defaultValue={p?.building ?? ""} className="input" maxLength={120} /></Field>
          <Field label="Plot no."><input name="plot" defaultValue={p?.plot ?? ""} className="input" maxLength={40} /></Field>
          <div className="col-span-2"><Field label="Landmark / directions"><input name="landmark" defaultValue={p?.landmark ?? ""} className="input" maxLength={300} placeholder="e.g. Opposite Rubaga Cathedral gate" /></Field></div>
        </div>
      )}
      {pin && <PinPicker initial={p?.lat != null && p?.lng != null ? { lat: p.lat, lng: p.lng, acc: p.coordAccuracyM ?? null, source: p.coordSource === "gps" ? "gps" : "map" } : null} />}
    </div>
  );
}
