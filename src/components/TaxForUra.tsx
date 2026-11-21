import { ArrowDownLeft, ChevronDown, Info } from "lucide-react";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { TAX_LABEL, taxPositions, type TaxKind } from "@/lib/tax";
import { recordTaxPayment } from "@/app/tax-actions";
import { Empty, PageHeader } from "./ui";
import { Submit } from "./client";

/** Manager: tax set aside for each landlord, what has been paid to URA, and recording a URA payment. */
export async function TaxForUra() {
  const [positions, history, landlords] = await Promise.all([
    taxPositions(),
    db.taxRemittance.findMany({ orderBy: { paidOn: "desc" }, take: 50, include: { landlord: { select: { name: true } }, recordedBy: { select: { name: true } } } }),
    db.user.findMany({ where: { role: "landlord" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const total = positions.reduce((s, p) => s + p.toPay, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Tax for URA" subtitle="Tax set aside from tenant payments, to pay URA under each landlord's TIN." />
      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-stone-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div className="space-y-1">
          <p><b>How to pay:</b> on URA&apos;s portal, generate a PRN for the landlord&apos;s TIN and tax type, pay it at the bank or by Mobile Money, then record it below.</p>
          <p className="text-xs text-stone-500">VAT is due by the 15th of the next month; rental income tax is paid with each landlord&apos;s return. URA doesn&apos;t accept tax payment-by-payment from apps, so this step stays with you.</p>
        </div>
      </div>
      <div className="card flex items-center justify-between gap-3">
        <span className="text-sm text-stone-600">Set aside, not yet paid to URA</span>
        <span className="text-xl font-bold text-brand-950">{ugx(total)}</span>
      </div>

      <section>
        <h2 className="h2 mb-2">By landlord</h2>
        {!positions.length ? <Empty title="No tax set aside yet">It builds up as tenants pay landlords who are above the rental tax threshold.</Empty> : (
          <div className="card divide-y divide-stone-100 p-0">
            {positions.map((p) => (
              <details key={p.landlordId} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-800">{p.name}</span><span className="block text-xs text-stone-500">{p.tin ? `TIN ${p.tin}` : "No TIN on file — add it under EFRIS receipts"}</span></span>
                  <span className="text-right"><span className="block text-sm font-bold text-brand-950">{ugx(p.toPay)}</span><span className="text-[11px] text-stone-500">to pay</span></span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-3 border-t border-stone-100 bg-stone-50/60 px-4 py-4 text-sm">
                  {p.kinds.map((k) => (
                    <div key={k.kind} className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
                      <b className="text-stone-800 sm:col-span-4">{TAX_LABEL[k.kind as TaxKind]}</b>
                      <span>Worked out <b>{ugx(k.due)}</b></span><span>Held by CasaVilla <b>{ugx(k.inHand)}</b></span><span>Paid to URA <b>{ugx(k.paid)}</b></span><span>To pay <b className="text-brand-800">{ugx(k.toPay)}</b></span>
                      {k.withLandlord > 0 && <span className="col-span-2 text-gold-700 sm:col-span-4">{ugx(k.withLandlord)} is still with the landlord (cash) — it comes off their next payouts.</span>}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="font-semibold text-brand-950">Record a payment to URA</h2>
        <form action={recordTaxPayment} className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="label">Landlord</span>
            <select name="landlordId" required className="input"><option value="">Choose…</option>{landlords.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          </label>
          <label className="block"><span className="label">Tax</span>
            <select name="kind" className="input"><option value="rental">Rental income tax</option><option value="vat">VAT</option></select>
          </label>
          <label className="block"><span className="label">Amount paid (UGX)</span><input name="amount" required inputMode="numeric" className="input" /></label>
          <label className="block"><span className="label">PRN</span><input name="prn" required inputMode="numeric" className="input font-mono" placeholder="URA payment registration number" /></label>
          <label className="block"><span className="label">Paid on</span><input name="paidOn" type="date" required max={kampalaToday()} defaultValue={kampalaToday()} className="input" /></label>
          <label className="block"><span className="label">Note (optional)</span><input name="note" maxLength={200} className="input" placeholder="e.g. VAT for October 2026" /></label>
          <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Save URA payment</Submit></div>
        </form>
      </section>

      <section>
        <h2 className="h2 mb-2">Paid to URA</h2>
        {!history.length ? <Empty title="Nothing recorded yet" /> : (
          <div className="card divide-y divide-stone-100 p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3">
                <ArrowDownLeft className="h-5 w-5 shrink-0 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-800">{h.landlord.name} · {TAX_LABEL[h.kind as TaxKind]}</div>
                  <div className="truncate font-mono text-xs text-stone-500">PRN {h.prn}</div>
                  <div className="text-[11px] text-stone-400">{fmtDate(h.paidOn)}{h.note ? ` · ${h.note}` : ""}{h.recordedBy ? ` · by ${h.recordedBy.name}` : ""}</div>
                </div>
                <span className="text-sm font-semibold text-stone-800">{ugx(h.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
