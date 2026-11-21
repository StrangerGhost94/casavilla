"use client";
import { useActionState, useState } from "react";
import { FullScreenLoader, Spinner } from "@/components/Loaders";
import { Check } from "lucide-react";
import { startPayment } from "@/app/tenant/actions";

function guess(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^256/, "0");
  const p = d.slice(0, 3);
  if (["076", "077", "078"].includes(p)) return "mtn";
  if (["070", "074", "075"].includes(p)) return "airtel";
  return "";
}

const networks = [
  { id: "mtn", label: "MTN MoMo", logo: <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-300 text-xs font-extrabold text-black">MTN</span> },
  { id: "airtel", label: "Airtel Money", logo: <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-[10px] font-extrabold text-white">airtel</span> },
];

/**
 * Pays this charge, and optionally months ahead: anything extra is held and covers the next months' rent
 * automatically. `max` is what the server accepts (everything owed plus the advance limit).
 */
export function PayForm({ chargeId, balance, rent, max, momoMax, phone }: { chargeId: number; balance: number; rent: number; max: number; momoMax: number; phone: string }) {
  const [state, action, pending] = useActionState(startPayment, undefined);
  const [amount, setAmount] = useState(balance > 0 ? balance : rent);
  const ahead = [0, 1, 2, 3].map((n) => ({ n, value: balance + n * rent }))
    // Months ahead are only offered while the total fits in one Mobile Money payment.
    .filter((o) => o.value > 0 && o.value <= max && (o.value <= momoMax || o.value === (balance > 0 ? balance : rent)));
  const [num, setNum] = useState(phone.replace("+256", "0"));
  const [net, setNet] = useState(guess(phone) || "mtn");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="chargeId" value={chargeId} />
      <div>
        <div className="h2 mb-2">Payment method</div>
        <div className="grid grid-cols-2 gap-2.5">
          {networks.map((n) => {
            const on = net === n.id;
            return (
              <label key={n.id} className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border bg-white p-3.5 text-center transition ${on ? "border-brand-700 ring-4 ring-brand-100" : "border-stone-200 hover:border-stone-300"}`}>
                <input type="radio" name="network" value={n.id} checked={on} onChange={() => setNet(n.id)} className="sr-only" />
                {n.logo}
                <span className="text-xs font-semibold text-stone-700">{n.label}</span>
                {on && <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-white"><Check className="h-3 w-3" /></span>}
              </label>
            );
          })}
        </div>
      </div>
      <label className="block"><span className="label">Mobile Money number</span>
        <input name="phone" value={num} onChange={(e) => { setNum(e.target.value); const g = guess(e.target.value); if (g) setNet(g); }} className="input" required inputMode="tel" />
      </label>
      <label className="block"><span className="label">Amount (UGX)</span>
        <input name="amount" type="number" min={500} max={max} value={amount || ""} onChange={(e) => setAmount(Number(e.target.value))} className="input" required inputMode="numeric" />
        <span className="mt-1 block text-xs text-stone-500">You can pay part now, or pay ahead: anything extra covers your next months automatically.</span>
      </label>
      {rent > 0 && ahead.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {ahead.map((o) => (
            <button key={o.n} type="button" onClick={() => setAmount(o.value)} className={amount === o.value ? "chip-active" : "chip"}>
              {o.n === 0 ? "This bill" : `${balance > 0 ? "+" : ""}${o.n} month${o.n > 1 ? "s" : ""}${balance > 0 ? " ahead" : ""}`}
            </button>
          ))}
        </div>
      )}
      {state?.error && <div className="rounded-xl bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <FullScreenLoader show={pending} title="Sending the payment request to your phone…" note="Keep this page open. Your phone will ask for your Mobile Money PIN in a moment." />
      <button className="btn-primary btn-lg w-full" disabled={pending} aria-busy={pending}>{pending ? <Spinner label="Sending request to your phone…" /> : amount > balance && balance > 0 ? "Pay rent and months ahead" : balance > 0 ? "Pay rent" : "Pay rent in advance"}</button>
      <p className="text-center text-xs text-stone-500">You&apos;ll get a prompt on your phone to enter your Mobile Money PIN.</p>
    </form>
  );
}
