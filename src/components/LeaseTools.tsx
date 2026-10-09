import { CalendarClock, ReceiptText, ShieldCheck, LogOut } from "lucide-react";
import type { Lease } from "@prisma/client";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { tenantScore, marketRent, type TenantScore } from "@/lib/insights";
import { daysBetween } from "@/lib/billing";
import { CHARGE_KINDS, CHARGE_KIND_LABEL, MAX_ADVANCE_MONTHS } from "@/lib/rules";
import { addLeaseCharge, endLease, markRefundPaid, recordCashPayment, renewLease, saveSpecialTerms } from "@/app/landlord/actions";
import { FileText } from "lucide-react";
import { Field } from "./ui";
import { ConfirmSubmit, Submit } from "./client";

const toneCls: Record<TenantScore["tone"], string> = {
  green: "bg-brand-50 text-brand-800 ring-brand-200",
  gold: "bg-gold-50 text-gold-700 ring-gold-200",
  red: "bg-maroon-50 text-maroon-600 ring-maroon-100",
  gray: "bg-stone-100 text-stone-600 ring-stone-200",
};

/** Compact payment-reliability badge, e.g. on an application. */
export function ScorePill({ s }: { s: TenantScore }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${toneCls[s.tone]}`}>
      <ShieldCheck className="h-3.5 w-3.5" />
      {s.score != null ? `${s.score}/100 · ${s.label}` : s.label}
    </span>
  );
}

export async function TenantScoreCard({ tenantId }: { tenantId: number }) {
  const s = await tenantScore(tenantId);
  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="h2">Payment reliability</div>
        <ScorePill s={s} />
      </div>
      {s.score != null ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-stone-50 p-2"><div className="text-base font-bold text-brand-950">{s.onTimePct}%</div><div className="text-[11px] text-stone-500">on time</div></div>
          <div className="rounded-xl bg-stone-50 p-2"><div className="text-base font-bold text-brand-950">{s.avgLateDays}d</div><div className="text-[11px] text-stone-500">avg. when late</div></div>
          <div className="rounded-xl bg-stone-50 p-2"><div className="text-base font-bold text-brand-950">{s.months}</div><div className="text-[11px] text-stone-500">months billed</div></div>
        </div>
      ) : (
        <p className="muted">No rent history at CasaVilla yet.</p>
      )}
      {s.pastLeases > 0 && <p className="text-xs text-stone-500">{s.pastLeases} previous lease{s.pastLeases > 1 ? "s" : ""} with CasaVilla.</p>}
    </div>
  );
}

/** Lease facts, credit, holdover and move-out settlement. */
export function LeaseFacts({ l, manage = true }: { l: Lease; manage?: boolean }) {
  const today = kampalaToday();
  const left = daysBetween(today, ymd(l.endDate));
  return (
    <div className="card space-y-2 text-sm">
      <Row k="Lease" v={`${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}`} />
      {l.status === "active" && (
        <Row k="Time left" v={left < 0 ? <span className="font-semibold text-maroon-600">Expired {-left} days ago · month-to-month</span> : left <= 60 ? <span className="font-semibold text-gold-700">{left} days</span> : `${left} days`} />
      )}
      <Row k="Rent" v={`${ugx(l.rent)} / month`} />
      {l.nextRent && l.nextRentFrom && <Row k="Agreed change" v={<span className="font-semibold text-gold-700">{ugx(l.nextRent)} from {fmtDate(l.nextRentFrom)}</span>} />}
      <Row k="Due day" v={`${l.dueDay} of each month`} />
      <Row k="Deposit" v={ugx(l.deposit)} />
      <Row k="Late fee" v={l.lateFeePct ? `${l.lateFeePct}% after 7 days` : "Off"} />
      {l.credit > 0 && <Row k="Credit (paid ahead)" v={<span className="font-semibold text-brand-700">{ugx(l.credit)}</span>} />}
      {l.status === "ended" && (
        <>
          <Row k="Moved out" v={l.endedAt ? fmtDate(l.endedAt) : "—"} />
          {l.settlement != null && (
            <Row k="Settlement" v={
              l.settlement > 0 ? <span className="font-semibold text-brand-700">{ugx(l.settlement)} refund due to tenant</span>
                : l.settlement < 0 ? <span className="font-semibold text-maroon-600">Tenant still owes {ugx(-l.settlement)}</span>
                  : "Fully settled"} />
          )}
          {manage && l.settlement != null && l.settlement > 0 && (
            <form action={markRefundPaid} className="flex gap-2 border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={l.id} />
              <select name="method" className="input py-2"><option value="cash">Cash</option><option value="bank">Bank</option><option value="mobile money">Mobile money</option></select>
              <ConfirmSubmit message="Mark the refund as paid to the tenant?" className="btn-primary btn-sm shrink-0">Refund paid</ConfirmSubmit>
            </form>
          )}
        </>
      )}
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex justify-between gap-3"><span className="shrink-0 text-stone-500">{k}</span><span className="text-right">{v}</span></div>
);

/** Record cash / bank money. Works after move-out too, so leftover arrears can still be collected. */
export async function CashForm({ l }: { l: Lease }) {
  const open = await db.charge.findMany({ where: { leaseId: l.id, status: { not: "paid" } }, orderBy: { dueDate: "asc" } });
  const owed = open.reduce((s, c) => s + c.amount - c.paid, 0);
  if (l.status !== "active" && owed <= 0) return null;
  return (
    <form action={recordCashPayment} className="card grid gap-2 sm:grid-cols-5">
      <input type="hidden" name="leaseId" value={l.id} />
      <div className="sm:col-span-5">
        <div className="h2">Record a cash or bank payment</div>
        <p className="mt-0.5 text-xs text-stone-500">
          Money goes to the charge you pick first, then the oldest unpaid ones.{l.status === "active" ? ` Extra (up to ${MAX_ADVANCE_MONTHS} months ahead) is kept as credit.` : " This lease has ended — only the balance can be collected."}
        </p>
      </div>
      {open.length > 0 && (
        <select name="chargeId" className="input sm:col-span-2">{open.map((c) => <option key={c.id} value={c.id}>{c.description} — owes {ugx(c.amount - c.paid)}</option>)}</select>
      )}
      <input name="amount" type="number" min={1} max={l.status === "active" ? undefined : owed} inputMode="numeric" className="input" placeholder="Amount" defaultValue={owed || undefined} required />
      <select name="method" className="input"><option value="cash">Cash</option><option value="bank">Bank</option></select>
      <input name="reference" className="input" placeholder="Ref (optional)" />
      <div className="sm:col-span-5"><Submit className="btn-outline btn-sm">Record & issue receipt</Submit></div>
    </form>
  );
}

export function ChargeForm({ leaseId }: { leaseId: number }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-brand-950"><ReceiptText className="h-4 w-4 text-brand-700" /> Add a bill or charge</summary>
      <form action={addLeaseCharge} className="mt-3 grid gap-2 sm:grid-cols-2">
        <input type="hidden" name="leaseId" value={leaseId} />
        <Field label="Type"><select name="kind" className="input">{CHARGE_KINDS.map((k) => <option key={k} value={k}>{CHARGE_KIND_LABEL[k]}</option>)}</select></Field>
        <Field label="Amount (UGX)"><input name="amount" type="number" min={500} inputMode="numeric" className="input" required /></Field>
        <Field label="Description"><input name="description" className="input" placeholder="e.g. Water bill — September" maxLength={120} /></Field>
        <Field label="Due"><input name="dueDate" type="date" className="input" defaultValue={kampalaToday()} /></Field>
        <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Add charge & tell tenant</Submit></div>
      </form>
    </details>
  );
}

export async function RenewForm({ l, location, bedrooms }: { l: Lease; location: { location: string; locationId: string | null }; bedrooms: number }) {
  const market = await marketRent(location, bedrooms);
  const s = await tenantScore(l.tenantId);
  const end = ymd(l.endDate);
  const nextEnd = `${Number(end.slice(0, 4)) + 1}${end.slice(4)}`;
  // Suggest a renewal rent: move toward the local median, but go gentle on reliable payers (keeping them is worth more).
  let suggested = l.rent;
  let why = "Keep the current rent.";
  if (market && market.median > l.rent * 1.05) {
    const cap = s.score != null && s.score >= 85 ? 1.05 : 1.1;
    suggested = Math.round(Math.min(market.median, l.rent * cap) / 10000) * 10000;
    why = `Similar ${bedrooms}-bed units ${market.scope} rent for about ${ugx(market.median)}.${s.score != null && s.score >= 85 ? " This tenant pays reliably, so the rise is kept small." : ""}`;
  } else if (market && market.median < l.rent * 0.9) {
    why = `This rent is above similar units ${market.scope} (${ugx(market.median)}) — keeping it steady helps avoid a vacancy.`;
  }
  return (
    <details className="card group" open={daysBetween(kampalaToday(), end) <= 60}>
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-brand-950"><CalendarClock className="h-4 w-4 text-brand-700" /> Renew lease</summary>
      <form action={renewLease} className="mt-3 space-y-2">
        <input type="hidden" name="id" value={l.id} />
        <Field label="New end date"><input name="endDate" type="date" className="input" defaultValue={nextEnd} required /></Field>
        <Field label="Rent for the new term (UGX)" hint={why}><input name="rent" type="number" inputMode="numeric" className="input" defaultValue={l.nextRent ?? suggested} /></Field>
        <label className="flex items-start gap-2 text-xs text-stone-600"><input type="checkbox" name="tenantAgreed" className="mt-0.5 accent-brand-700" /> The tenant has agreed in writing to a rise above 10%</label>
        <p className="text-[11px] text-stone-500">Uganda&apos;s Landlord and Tenant Act (s.26): a rise needs 60 days&apos; notice, starts after the current term, at most once a year and up to 10% unless the tenant agrees. CasaVilla works out the earliest legal start date and tells the tenant.</p>
        <Submit className="btn-primary btn-sm w-full">Renew & notify tenant</Submit>
      </form>
    </details>
  );
}

export function MoveOutForm({ l }: { l: Lease }) {
  return (
    <details className="card group">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-maroon-600"><LogOut className="h-4 w-4" /> Move-out & settle</summary>
      <form action={endLease} className="mt-3 space-y-2 text-sm">
        <input type="hidden" name="id" value={l.id} />
        <Field label="Move-out date"><input name="moveOut" type="date" className="input" defaultValue={kampalaToday()} required /></Field>
        <label className="flex items-start gap-2"><input type="checkbox" name="useDeposit" defaultChecked className="mt-0.5 accent-brand-700" /> Use the held deposit against unpaid rent and bills</label>
        <label className="flex items-start gap-2"><input type="checkbox" name="relist" defaultChecked className="mt-0.5 accent-brand-700" /> List the unit again so new tenants can apply</label>
        <p className="text-xs text-stone-500">Unpaid rent for months after the move-out is cancelled. CasaVilla works out the final refund or balance and tells the tenant.</p>
        <ConfirmSubmit message="End this lease and settle the account? The tenant will be notified." className="btn-outline btn-sm w-full text-maroon-600">End lease & settle</ConfirmSubmit>
      </form>
    </details>
  );
}

/** The drafted tenancy agreement: download/preview, and (for the landlord) the special terms printed in it. */
export function AgreementCard({ l, manage = true }: { l: Lease; manage?: boolean }) {
  return (
    <div className="card space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><FileText className="h-5 w-5" /></span>
        <div>
          <div className="font-semibold text-brand-950">Tenancy agreement</div>
          <p className="text-xs text-stone-500">Drafted automatically from this lease under Uganda&apos;s Landlord and Tenant Act, 2022. Print it, sign it with witnesses, then upload the signed copy below.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={`/leases/${l.id}/agreement`} className="btn-primary btn-sm">Download PDF</a>
        <a href={`/leases/${l.id}/agreement?view=1`} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Preview</a>
      </div>
      {manage && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-semibold text-brand-700">Special terms{l.specialTerms ? " (set)" : ""}…</summary>
          <form action={saveSpecialTerms} className="mt-2 space-y-2">
            <input type="hidden" name="id" value={l.id} />
            <textarea name="specialTerms" rows={4} maxLength={3000} defaultValue={l.specialTerms ?? ""} className="input" placeholder="One term per line, e.g. No pets. Tenant maintains the garden." />
            <Submit className="btn-outline btn-sm">Save terms</Submit>
          </form>
        </details>
      )}
    </div>
  );
}
