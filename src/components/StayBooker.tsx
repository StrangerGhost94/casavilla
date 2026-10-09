"use client";
import { useActionState, useMemo, useState } from "react";
import { bookStay } from "@/app/stay-actions";

const ugx = (n: number) => `UGX ${n.toLocaleString("en-UG")}`;
const nights = (a: string, b: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86400000) : 0);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Dates → live price, availability warning, then Mobile Money. The server re-checks everything. */
export function StayBooker({ unitId, nightly, cleaningFee, minNights, maxGuests, booked, today, phone, initial }: {
  unitId: number; nightly: number; cleaningFee: number; minNights: number; maxGuests: number; booked: string[]; today: string; phone: string;
  initial?: { checkIn?: string; checkOut?: string; guests?: number };
}) {
  const [state, action, pending] = useActionState(bookStay, undefined);
  const [checkIn, setIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setOut] = useState(initial?.checkOut ?? "");
  const [guests, setGuests] = useState(initial?.guests ?? 1);
  const taken = useMemo(() => new Set(booked), [booked]);
  const n = nights(checkIn, checkOut);
  const clash = useMemo(() => { if (n < 1) return null; for (let d = checkIn; d < checkOut; d = addDays(d, 1)) if (taken.has(d)) return d; return null; }, [checkIn, checkOut, n, taken]);
  const problem = !checkIn || !checkOut ? null : n < 1 ? "Check-out must be after check-in" : n < minNights ? `Minimum ${minNights} night${minNights > 1 ? "s" : ""}` : clash ? `${clash} is already booked — pick other dates` : null;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="unitId" value={unitId} />
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Check-in</span><input type="date" name="checkIn" min={today} value={checkIn} onChange={(e) => { setIn(e.target.value); if (checkOut && e.target.value >= checkOut) setOut(addDays(e.target.value, minNights)); }} className="input" required /></label>
        <label><span className="label">Check-out</span><input type="date" name="checkOut" min={checkIn ? addDays(checkIn, 1) : today} value={checkOut} onChange={(e) => setOut(e.target.value)} className="input" required /></label>
      </div>
      <label className="block"><span className="label">Guests</span>
        <select name="guests" value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="input">{Array.from({ length: maxGuests }, (_, i) => <option key={i} value={i + 1}>{i + 1} guest{i ? "s" : ""}</option>)}</select>
      </label>
      {n > 0 && !problem && (
        <div className="space-y-1 rounded-xl bg-stone-50 p-3 text-sm">
          <div className="flex justify-between"><span>{ugx(nightly)} × {n} night{n > 1 ? "s" : ""}</span><span>{ugx(nightly * n)}</span></div>
          {cleaningFee > 0 && <div className="flex justify-between"><span>Cleaning fee</span><span>{ugx(cleaningFee)}</span></div>}
          <div className="flex justify-between border-t border-stone-200 pt-1 font-bold"><span>Total</span><span>{ugx(nightly * n + cleaningFee)}</span></div>
        </div>
      )}
      {problem && <div className="rounded-xl bg-gold-50 p-2.5 text-xs text-gold-800">{problem}</div>}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input name="phone" defaultValue={phone.replace("+256", "0")} inputMode="tel" className="input" placeholder="Mobile Money number" required />
        <select name="network" className="input w-auto"><option value="">Auto</option><option value="mtn">MTN</option><option value="airtel">Airtel</option></select>
      </div>
      <label className="flex items-start gap-2 text-xs text-stone-600"><input type="checkbox" name="agree" required className="mt-0.5 accent-brand-700" /> I agree to the house rules and to pay for the whole stay now. Free cancellation up to 2 days before check-in.</label>
      {state?.error && <div className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary btn-lg w-full" disabled={pending || !!problem || n < 1}>{pending ? "Sending payment request…" : n > 0 && !problem ? `Book & pay ${ugx(nightly * n + cleaningFee)}` : "Choose your dates"}</button>
    </form>
  );
}
