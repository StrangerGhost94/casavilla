"use client";
import { useActionState, useState } from "react";
import { startPayment } from "@/app/tenant/actions";

function guess(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^256/, "0");
  const p = d.slice(0, 3);
  if (["076", "077", "078"].includes(p)) return "mtn";
  if (["070", "074", "075"].includes(p)) return "airtel";
  return "";
}

export function PayForm({ chargeId, balance, phone }: { chargeId: number; balance: number; phone: string }) {
  const [state, action, pending] = useActionState(startPayment, undefined);
  const [num, setNum] = useState(phone.replace("+256", "0"));
  const [net, setNet] = useState(guess(phone) || "mtn");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="chargeId" value={chargeId} />
      <label className="block"><span className="label">Amount (UGX)</span>
        <input name="amount" type="number" min={500} max={balance} defaultValue={balance} className="input" required />
        <span className="mt-1 block text-xs text-stone-500">You can pay part now and the rest later.</span>
      </label>
      <label className="block"><span className="label">Mobile Money number</span>
        <input name="phone" value={num} onChange={(e) => { setNum(e.target.value); const g = guess(e.target.value); if (g) setNet(g); }} className="input" required />
      </label>
      <div>
        <span className="label">Network</span>
        <div className="grid grid-cols-2 gap-2">
          {[["mtn", "MTN MoMo", "bg-yellow-300 text-black"], ["airtel", "Airtel Money", "bg-red-600 text-white"]].map(([id, label, cls]) => (
            <label key={id} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 ${net === id ? "border-brand-500 ring-2 ring-brand-100" : "border-stone-200"}`}>
              <input type="radio" name="network" value={id} checked={net === id} onChange={() => setNet(id)} className="sr-only" />
              <span className={`rounded px-2 py-0.5 text-xs font-bold ${cls}`}>{id.toUpperCase()}</span>
              <span className="text-sm font-medium">{label}</span>
            </label>
          ))}
        </div>
      </div>
      {state?.error && <div className="rounded-lg bg-maroon-50 p-3 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Sending request to your phone…" : "Pay now"}</button>
      <p className="text-center text-xs text-stone-500">You&apos;ll get a prompt on your phone to enter your Mobile Money PIN.</p>
    </form>
  );
}
