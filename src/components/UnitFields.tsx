import type { Unit } from "@prisma/client";
import { AMENITIES } from "@/lib/rules";

/**
 * Unit features and how it's let. Asked step by step: rooms first (they drive the photo shot list),
 * then features, then monthly vs nightly letting with the short-stay settings.
 */
export function UnitFields({ u }: { u?: Partial<Unit> }) {
  return (
    <div className="col-span-full space-y-3 rounded-xl bg-stone-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        <label className="min-w-0"><span className="label">Bathrooms</span><input name="bathrooms" type="number" min={0} max={20} defaultValue={u?.bathrooms ?? 1} className="input py-2" /></label>
        <label className="min-w-0"><span className="label">Size (m², optional)</span><input name="sizeSqm" type="number" min={5} defaultValue={u?.sizeSqm ?? ""} className="input py-2" /></label>
        <div className="flex flex-col justify-end gap-1 pb-1 text-xs text-stone-600">
          <label className="flex items-center gap-1.5"><input type="checkbox" name="selfContained" defaultChecked={u?.selfContained ?? true} className="accent-brand-700" /> Self-contained</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" name="furnished" defaultChecked={u?.furnished ?? false} className="accent-brand-700" /> Furnished</label>
        </div>
      </div>
      <div>
        <div className="label">Features</div>
        <div className="flex flex-wrap gap-1.5">
          {AMENITIES.map((a) => (
            <label key={a} className="chip cursor-pointer has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-800">
              <input type="checkbox" name="amenities" value={a} defaultChecked={u?.amenities?.includes(a)} className="sr-only" />{a}
            </label>
          ))}
        </div>
      </div>
      <details open={u?.mode === "short"} className="rounded-xl border border-stone-200 bg-white p-3">
        <summary className="cursor-pointer list-none text-sm font-semibold text-brand-900">Letting: {u?.mode === "short" ? "short stays (nightly)" : "monthly tenancy"} — change…</summary>
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"><input type="radio" name="mode" value="long" defaultChecked={(u?.mode ?? "long") === "long"} className="accent-brand-700" /> Monthly tenancy</label>
            <label className="flex items-center gap-2 rounded-xl border border-stone-200 p-2.5 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"><input type="radio" name="mode" value="short" defaultChecked={u?.mode === "short"} className="accent-brand-700" /> Short stays (Airbnb-style)</label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label><span className="label">Price / night (UGX)</span><input name="nightlyRate" type="number" min={5000} defaultValue={u?.nightlyRate ?? ""} className="input py-2" placeholder="e.g. 150000" /></label>
            <label><span className="label">Cleaning fee</span><input name="cleaningFee" type="number" min={0} defaultValue={u?.cleaningFee ?? 0} className="input py-2" /></label>
            <label><span className="label">Min. nights</span><input name="minNights" type="number" min={1} max={90} defaultValue={u?.minNights ?? 1} className="input py-2" /></label>
            <label><span className="label">Max. guests</span><input name="maxGuests" type="number" min={1} max={30} defaultValue={u?.maxGuests ?? 2} className="input py-2" /></label>
            <label><span className="label">Check-in from</span><input name="checkInFrom" type="time" defaultValue={u?.checkInFrom ?? "14:00"} className="input py-2" /></label>
            <label><span className="label">Check-out by</span><input name="checkOutBy" type="time" defaultValue={u?.checkOutBy ?? "10:00"} className="input py-2" /></label>
          </div>
          <label className="block"><span className="label">House rules</span><textarea name="houseRules" rows={2} maxLength={2000} defaultValue={u?.houseRules ?? ""} className="input" placeholder="e.g. No parties. No smoking indoors. Quiet after 10pm." /></label>
          <p className="text-[11px] text-stone-500">Short-stay units appear under Short stays with a booking calendar instead of the monthly listings.</p>
        </div>
      </details>
    </div>
  );
}
