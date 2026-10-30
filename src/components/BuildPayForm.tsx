"use client";
import { startTransition, useActionState, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { payBuildStage } from "@/app/build-site-actions";
import { networkFor } from "@/lib/format";

const fmt = (n: number) => n.toLocaleString("en-UG");

/** Pay a stage by MTN or Airtel Mobile Money; amounts above the limit go in parts or by bank. */
export function BuildPayForm({ siteId, stages, defaultStageId, phone, max }: {
  siteId: number; stages: { id: number; name: string; balance: number }[]; defaultStageId?: number; phone: string; max: number;
}) {
  const [state, action, pending] = useActionState(payBuildStage, undefined);
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id);
  const stage = stages.find((s) => s.id === stageId);
  const [amount, setAmount] = useState(fmt(Math.min(stage?.balance ?? 0, max)));
  const [network, setNetwork] = useState<"mtn" | "airtel">(networkFor(phone) ?? "mtn");
  if (!stages.length) return null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="space-y-3">
      <input type="hidden" name="siteId" value={siteId} />
      <input type="hidden" name="network" value={network} />
      <label className="block"><span className="label">Stage</span>
        <select name="stageId" value={stageId} className="input" onChange={(e) => { const id = Number(e.target.value); setStageId(id); const s = stages.find((x) => x.id === id); setAmount(fmt(Math.min(s?.balance ?? 0, max))); }}>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name} — {fmt(s.balance)} left</option>)}
        </select></label>
      <label className="block"><span className="label">Amount (UGX)</span>
        <input name="amount" inputMode="numeric" value={amount} className="input" onChange={(e) => { const d = e.target.value.replace(/\D/g, "").slice(0, 13); setAmount(d ? fmt(Number(d)) : ""); }} /></label>
      {stage && stage.balance > max && <p className="text-xs text-stone-500">Mobile Money takes up to UGX {fmt(max)} per payment — pay this stage in parts, or by bank transfer.</p>}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
        {(["mtn", "airtel"] as const).map((n) => (
          <button key={n} type="button" onClick={() => setNetwork(n)} aria-pressed={network === n} className={`rounded-lg py-1.5 ${network === n ? "bg-white text-brand-950 shadow-sm" : "text-stone-500"}`}>{n === "mtn" ? "MTN MoMo" : "Airtel Money"}</button>
        ))}
      </div>
      <label className="block"><span className="label">Mobile Money number</span>
        <input name="phone" inputMode="tel" defaultValue={phone.replace("+256", "0")} className="input" autoComplete="tel" /></label>
      {state?.error && <div role="alert" className="rounded-xl bg-maroon-50 p-2.5 text-sm text-maroon-600">{state.error}</div>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending the prompt…</> : <><Smartphone className="h-4 w-4" /> Pay {amount ? `UGX ${amount}` : ""}</>}</button>
      <p className="text-center text-[11px] text-stone-500">You&apos;ll get a prompt on your phone — enter your PIN to approve.</p>
    </form>
  );
}
