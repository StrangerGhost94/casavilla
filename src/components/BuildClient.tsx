"use client";
import { startTransition, useActionState, useState } from "react";
import { Building, Check, DraftingCompass, Hammer, Home, Loader2, MessageCircle, Store } from "lucide-react";
import { sendBuildRequest } from "@/app/build-actions";
import { BUILD_KINDS, PLOT, TIMELINE, type BuildKind } from "@/lib/build";

const ICON: Record<BuildKind, typeof Home> = { house: Home, apartments: Building, commercial: Store, renovation: Hammer, plans: DraftingCompass };

/**
 * "Start your project": what to build, where, plot, budget and timing, then a name and phone.
 * Works without an account; CasaVilla calls back. Plan / plot come from the page that opened it.
 */
export function BuildRequestForm({ me, kind: initialKind = "house", planId, saleListingId, where = "", budget: initialBudget, compact = false }: {
  me: { name: string; phone: string; email: string } | null; kind?: BuildKind; planId?: number; saleListingId?: number; where?: string; budget?: number; compact?: boolean;
}) {
  const [state, action, pending] = useActionState(sendBuildRequest, undefined);
  const [kind, setKind] = useState<BuildKind>(initialKind);
  const [budget, setBudget] = useState(initialBudget ? initialBudget.toLocaleString("en-UG") : "");

  if (state?.ok) {
    return (
      <div className="rounded-2xl bg-brand-50 p-5 text-sm text-brand-900">
        <div className="flex items-center gap-2 text-base font-semibold"><Check className="h-5 w-5" /> Thank you — we have your request</div>
        <p className="mt-1.5 text-brand-800">CasaVilla's building team will call you to talk it through and arrange a site visit. Keep your phone near.</p>
        <a href={`https://wa.me/256776593482?text=${encodeURIComponent("Hello CasaVilla, I've just sent a build request on the website.")}`} className="btn-outline btn-sm mt-3"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp now</a>
      </div>
    );
  }

  return (
    // Submitted by hand so an error doesn't wipe what was typed.
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-4">
      {planId && <input type="hidden" name="planId" value={planId} />}
      {saleListingId && <input type="hidden" name="saleListingId" value={saleListingId} />}
      <input type="hidden" name="kind" value={kind} />

      <fieldset>
        <legend className="label">What would you like to do?</legend>
        <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
          {(Object.keys(BUILD_KINDS) as BuildKind[]).map((k) => {
            const I = ICON[k];
            return (
              <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                className={`flex items-start gap-2 rounded-2xl border p-3 text-left transition ${kind === k ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-stone-200 bg-white hover:border-brand-200"}`}>
                <I className={`mt-0.5 h-5 w-5 shrink-0 ${kind === k ? "text-brand-700" : "text-stone-400"}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-brand-950">{BUILD_KINDS[k].label}</span>
                  {!compact && <span className="mt-0.5 hidden text-[11px] leading-snug text-stone-500 sm:block">{BUILD_KINDS[k].hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="block"><span className="label">Where will you build?</span>
        <input name="location" defaultValue={where} maxLength={160} className="input" placeholder="e.g. Kira, Wakiso — or the plot's village / landmark" /></label>

      {!saleListingId && (
        <fieldset>
          <legend className="label">Do you have a plot?</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(PLOT).map(([v, l]) => (
              <label key={v} className="cursor-pointer"><input type="radio" name="plot" value={v} className="peer sr-only" defaultChecked={v === "yes"} />
                <span className="chip peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-900">{l}</span></label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">Budget in UGX (optional)</span>
          <input name="budget" inputMode="numeric" value={budget} className="input" placeholder="e.g. 150,000,000"
            onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 13); setBudget(d ? Number(d).toLocaleString("en-UG") : ""); }} /></label>
        <label className="block"><span className="label">When do you want to start?</span>
          <select name="timeline" className="input" defaultValue="3m">{Object.entries(TIMELINE).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      </div>

      <label className="block"><span className="label">Tell us more (optional)</span>
        <textarea name="message" rows={3} maxLength={2000} className="input" placeholder={kind === "renovation" ? "e.g. Add two bedrooms and a second floor to a 3-bedroom bungalow" : kind === "plans" ? "e.g. 4-bedroom storeyed house on a 50 × 100 plot, with a home office" : "e.g. 3-bedroom bungalow with a boys' quarter; we have the land title"} /></label>

      {!me ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block"><span className="label">Your name</span><input name="name" required maxLength={80} className="input" autoComplete="name" /></label>
          <label className="block"><span className="label">Phone</span><input name="phone" required inputMode="tel" className="input" autoComplete="tel" placeholder="0772 123 456" /></label>
          <label className="block"><span className="label">Email (optional)</span><input name="email" type="email" maxLength={120} className="input" autoComplete="email" /></label>
        </div>
      ) : <p className="text-xs text-stone-500">We&apos;ll call you on <b>{me.phone}</b>.</p>}

      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-2.5 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : "Send — get a free consultation"}</button>
      <p className="text-center text-[11px] text-stone-500">Free and no obligation. CasaVilla's building team calls you back.</p>
    </form>
  );
}
