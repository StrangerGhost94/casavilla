"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { CalendarDays, Check, Loader2, Share2 } from "lucide-react";
import { countSaleView, sendSaleEnquiry } from "@/app/sale-actions";

/** Counts a view once per browser session (not on every refresh). */
export function SaleViewCounter({ id }: { id: number }) {
  useEffect(() => {
    try { const k = `sv:${id}`; if (sessionStorage.getItem(k)) return; sessionStorage.setItem(k, "1"); } catch { /* private mode */ }
    countSaleView(id).catch(() => {});
  }, [id]);
  return null;
}

/** Ask a question or request a viewing — works with or without an account. */
export function SaleEnquiryForm({ listingId, me, title }: { listingId: number; me: { name: string; phone: string } | null; title: string }) {
  const [state, action, pending] = useActionState(sendSaleEnquiry, undefined);
  const [viewing, setViewing] = useState(true);
  const today = new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 10);
  if (state?.ok) {
    return (
      <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
        <div className="flex items-center gap-2 font-semibold"><Check className="h-4 w-4" /> Sent — thank you</div>
        <p className="mt-1 text-brand-800">CasaVilla will call you{viewing ? " to arrange the viewing" : ""}. Keep your phone near.</p>
      </div>
    );
  }
  return (
    // Submitted by hand so an error doesn't wipe what the buyer typed.
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-2.5">
      <input type="hidden" name="listingId" value={listingId} />
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        <button type="button" onClick={() => setViewing(true)} className={`rounded-lg py-1.5 ${viewing ? "bg-white text-brand-950 shadow-sm" : "text-stone-500"}`}>Book a viewing</button>
        <button type="button" onClick={() => setViewing(false)} className={`rounded-lg py-1.5 ${!viewing ? "bg-white text-brand-950 shadow-sm" : "text-stone-500"}`}>Ask a question</button>
      </div>
      {viewing && <input type="hidden" name="wantsViewing" value="on" />}
      {!me && (
        <div className="grid grid-cols-2 gap-2">
          <input name="name" required maxLength={80} className="input" placeholder="Your name" autoComplete="name" />
          <input name="phone" required inputMode="tel" className="input" placeholder="Phone" autoComplete="tel" />
        </div>
      )}
      {viewing && (
        <label className="block"><span className="label flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Preferred day (optional)</span>
          <input name="viewingDate" type="date" min={today} className="input" /></label>
      )}
      <textarea name="message" rows={3} maxLength={1500} required={!viewing} className="input"
        placeholder={viewing ? "Anything we should know? (optional)" : "e.g. Is the price negotiable? Is there a title search report?"} />
      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-2.5 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : viewing ? "Request a viewing" : "Send question"}</button>
      {me && <p className="text-center text-[11px] text-stone-500">We&apos;ll call you on {me.phone}.</p>}
      <span className="sr-only">{title}</span>
    </form>
  );
}

export function ShareButton({ title }: { title: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn-outline btn-sm"
      onClick={async () => {
        const url = location.href;
        try { if (navigator.share) { await navigator.share({ title, url }); return; } await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 2000); } catch { /* cancelled */ }
      }}>
      <Share2 className="h-4 w-4" /> {done ? "Link copied" : "Share"}
    </button>
  );
}
