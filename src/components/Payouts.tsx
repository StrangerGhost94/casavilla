import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, Banknote, ChevronDown, Info, Landmark, Smartphone } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { chargeLabel } from "@/lib/rules";
import { payoutMode } from "@/lib/payouts";
import { TAX_LABEL, taxPositions, type TaxKind } from "@/lib/tax";
import { markPayoutPaid, recordTaxPayment, retryPayout, savePayoutAccount } from "@/app/payout-actions";
import { Badge, Empty, PageHeader } from "./ui";
import { Submit } from "./client";

export const PAYOUT_STATUS: Record<string, { label: string; color: "green" | "amber" | "red" | "blue" | "gray" }> = {
  queued: { label: "Waiting to send", color: "amber" },
  sending: { label: "Sending", color: "blue" },
  paid: { label: "Paid", color: "green" },
  failed: { label: "Failed — will retry", color: "red" },
  owed: { label: "Cash · deductions owed", color: "amber" },
  settled: { label: "Cash · settled", color: "gray" },
};

const METHOD: Record<string, string> = { mtn: "MTN Mobile Money", airtel: "Airtel Money", bank: "Bank account" };

/** Where the landlord's money goes. */
export async function PayoutAccountForm({ landlordId, manager }: { landlordId: number; manager?: boolean }) {
  const a = await db.payoutAccount.findUnique({ where: { landlordId } });
  return (
    <form action={savePayoutAccount} className="space-y-3 text-sm">
      {manager && <input type="hidden" name="landlordId" value={landlordId} />}
      <fieldset className="grid grid-cols-3 gap-2">
        <legend className="label">Receive money by</legend>
        {(["mtn", "airtel", "bank"] as const).map((m) => (
          <label key={m} className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-stone-200 p-2.5 text-center text-xs font-semibold has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
            <input type="radio" name="method" value={m} defaultChecked={(a?.method ?? "mtn") === m} className="sr-only" />
            {m === "bank" ? <Landmark className="h-5 w-5 text-brand-700" /> : <Smartphone className="h-5 w-5 text-brand-700" />}
            {m === "mtn" ? "MTN MoMo" : m === "airtel" ? "Airtel Money" : "Bank"}
          </label>
        ))}
      </fieldset>
      <label className="block"><span className="label">Name on the account</span><input name="accountName" required maxLength={100} defaultValue={a?.accountName ?? ""} className="input" /></label>
      <label className="block"><span className="label">Mobile Money number (for MTN / Airtel)</span><input name="phone" inputMode="tel" defaultValue={a?.phone ?? ""} className="input" placeholder="e.g. 0772 123456" /></label>
      <details className="rounded-xl border border-stone-200 p-3" open={a?.method === "bank"}>
        <summary className="cursor-pointer list-none text-xs font-semibold text-brand-700">Bank details (for Bank)</summary>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block"><span className="label">Bank</span><input name="bankName" defaultValue={a?.bankName ?? ""} className="input" placeholder="e.g. Stanbic Bank Uganda" /></label>
          <label className="block"><span className="label">Account number</span><input name="accountNumber" inputMode="numeric" defaultValue={a?.accountNumber ?? ""} className="input" /></label>
          <label className="block sm:col-span-2"><span className="label">Bank code (CasaVilla fills this in)</span><input name="bankCode" defaultValue={a?.bankCode ?? ""} className="input" placeholder="Flutterwave bank code" /></label>
        </div>
      </details>
      <Submit className="btn-primary btn-sm">Save payout details</Submit>
    </form>
  );
}

function Breakdown({ p }: { p: { gross: number; commission: number; rentalTax: number; vat: number; recovered: number; amount: number; collectedBy: string } }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-stone-500 sm:grid-cols-4">
      <span>Paid <b className="text-stone-700">{ugx(p.gross)}</b></span>
      <span>Commission <b className="text-stone-700">{ugx(p.commission)}</b></span>
      <span>Tax set aside <b className="text-stone-700">{ugx(p.rentalTax + p.vat)}</b></span>
      {p.collectedBy === "casavilla"
        ? <span>{p.recovered ? <>Cash owed taken <b className="text-stone-700">{ugx(p.recovered)}</b> · </> : null}Sent <b className="text-brand-800">{ugx(p.amount)}</b></span>
        : <span>Owed back <b className="text-gold-700">{ugx(p.commission + p.rentalTax + p.vat - p.recovered)}</b></span>}
    </div>
  );
}

async function payoutRows(landlordId?: number, status?: string) {
  return db.payout.findMany({
    where: { ...(landlordId ? { landlordId } : {}), ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" }, take: 100,
    include: { landlord: { select: { name: true } }, payment: { select: { method: true, paidAt: true, receiptNo: true, tenant: { select: { name: true } }, charge: { select: { kind: true, period: true } } } } },
  });
}

function ModeBanner() {
  const mode = payoutMode();
  if (mode === "live") return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold-200 bg-gold-50/70 p-4 text-sm text-stone-700">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
      <div>
        {mode === "sandbox"
          ? <><b>Test mode:</b> payouts are simulated — no money is sent.</>
          : <><b>Automatic payouts are off.</b> Each payment is split and queued here, but no money is sent yet.</>}
        <span className="mt-1 block text-xs text-stone-500">To send real money, set <code>PAYOUT_MODE=live</code> in Railway once Flutterwave transfers (payouts) are enabled on CasaVilla&apos;s account and it holds enough balance. Only payouts from the last 48 hours go automatically; older ones wait here for “Send now” or “Paid outside the app”, so nothing you already paid by hand is sent twice.</span>
      </div>
    </div>
  );
}

/** Landlord: where money goes, and each payment's split and payout. */
export async function LandlordPayouts({ viewer }: { viewer: User }) {
  const [rows, account, tax] = await Promise.all([payoutRows(viewer.id), db.payoutAccount.findUnique({ where: { landlordId: viewer.id } }), taxPositions(viewer.id)]);
  const month = kampalaToday().slice(0, 7);
  const thisMonth = rows.filter((r) => r.createdAt.toISOString().slice(0, 7) === month);
  const sum = (k: "gross" | "commission" | "amount") => thisMonth.reduce((s, r) => s + r[k], 0);
  const taxMonth = thisMonth.reduce((s, r) => s + r.rentalTax + r.vat, 0);
  const waiting = rows.filter((r) => ["queued", "failed", "sending"].includes(r.status)).reduce((s, r) => s + r.amount, 0);
  const owed = rows.filter((r) => r.status === "owed").reduce((s, r) => s + r.commission + r.rentalTax + r.vat - r.recovered, 0);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Payouts" subtitle="Each tenant payment is split automatically: CasaVilla's commission, tax set aside for URA, and your share — sent to you." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Tenants paid this month", ugx(sum("gross"))], ["Commission", ugx(sum("commission"))], ["Tax set aside", ugx(taxMonth)], ["Sent to you", ugx(sum("amount"))]].map(([l, v]) => (
          <div key={l} className="card p-3.5"><div className="text-[11px] text-stone-500">{l}</div><div className="mt-0.5 text-base font-bold text-brand-950">{v}</div></div>
        ))}
      </div>
      {(waiting > 0 || owed > 0) && (
        <p className="text-sm text-stone-600">{waiting > 0 && <>{ugx(waiting)} {payoutMode() === "off" ? "is waiting to be paid to you by CasaVilla" : "is on its way to you"}. </>}{owed > 0 && <>{ugx(owed)} of commission and tax on cash you collected will come off your next payouts.</>}</p>
      )}

      <details className="card group" open={!account}>
        <summary className="flex cursor-pointer list-none items-center gap-3">
          <Banknote className="h-5 w-5 text-brand-700" />
          <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">Where your money goes</span><span className="block text-xs text-stone-500">{account ? `${METHOD[account.method]} · ${account.method === "bank" ? `${account.bankName} ••${account.accountNumber?.slice(-4)}` : account.phone} · ${account.accountName}` : "Not set — add it to receive payouts"}</span></span>
          <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
        </summary>
        <div className="mt-4 border-t border-stone-100 pt-4"><PayoutAccountForm landlordId={viewer.id} /></div>
      </details>

      {tax.length > 0 && (
        <section className="card">
          <div className="font-semibold text-brand-950">Tax for URA</div>
          <p className="mt-0.5 text-xs text-stone-500">Set aside from your rent and paid to URA under your TIN by CasaVilla.</p>
          <div className="mt-3 divide-y divide-stone-100 text-sm">
            {tax[0].kinds.map((k) => (
              <div key={k.kind} className="flex items-center justify-between gap-3 py-2">
                <span>{TAX_LABEL[k.kind as TaxKind]}</span>
                <span className="text-right text-xs text-stone-500">Set aside <b className="text-stone-800">{ugx(k.inHand)}</b> · paid to URA <b className="text-brand-800">{ugx(k.paid)}</b></span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="h2 mb-2">Payments and payouts</h2>
        {!rows.length ? <Empty title="No payouts yet">They appear here as tenants pay.</Empty> : (
          <div className="card divide-y divide-stone-100 p-0">
            {rows.map((r) => (
              <div key={r.id} className="space-y-1.5 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-stone-800">{r.payment.tenant.name} · {chargeLabel(r.payment.charge.kind, r.payment.charge.period)}</div>
                    <div className="text-xs text-stone-500">{fmtDate(r.payment.paidAt)} · {r.collectedBy === "casavilla" ? "paid to CasaVilla" : "cash you collected"}{r.destination ? ` · to ${r.destination}` : ""}</div>
                  </div>
                  <Badge color={PAYOUT_STATUS[r.status]?.color}>{PAYOUT_STATUS[r.status]?.label ?? r.status}</Badge>
                </div>
                <Breakdown p={r} />
                {r.error && r.status !== "paid" && <div className="text-[11px] text-gold-700">{r.error}</div>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Manager: every landlord's payouts, with retry and "paid outside the app". */
export async function ManagerPayouts({ status }: { status?: string }) {
  const [rows, counts, noAccount] = await Promise.all([
    payoutRows(undefined, status),
    db.payout.groupBy({ by: ["status"], _count: true, _sum: { amount: true } }),
    db.user.findMany({ where: { role: "landlord", payoutAccount: null, payouts: { some: { status: { in: ["queued", "failed"] } } } }, select: { id: true, name: true } }),
  ]);
  const c = new Map(counts.map((x) => [x.status, x]));
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Payouts" subtitle="Landlords' shares of tenant payments, after commission and tax set aside." />
      <ModeBanner />
      <div className="flex flex-wrap gap-2">
        <Link href="/manager/payouts" className={!status ? "chip-active" : "chip"}>All</Link>
        {Object.entries(PAYOUT_STATUS).map(([k, v]) => (
          <Link key={k} href={`/manager/payouts?status=${k}`} className={status === k ? "chip-active" : "chip"}>{v.label} ({c.get(k)?._count ?? 0})</Link>
        ))}
      </div>
      {noAccount.length > 0 && (
        <div className="card text-sm">
          <div className="font-semibold text-brand-950">Waiting for payout details</div>
          <p className="text-xs text-stone-500">These landlords have money waiting but no Mobile Money number or bank yet.</p>
          <div className="mt-2 divide-y divide-stone-100">
            {noAccount.map((l) => (
              <details key={l.id} className="py-2">
                <summary className="cursor-pointer list-none text-sm font-medium text-stone-800">{l.name} <span className="text-xs text-brand-700">· add details</span></summary>
                <div className="mt-3"><PayoutAccountForm landlordId={l.id} manager /></div>
              </details>
            ))}
          </div>
        </div>
      )}
      {!rows.length ? <Empty title="No payouts here" /> : (
        <div className="card divide-y divide-stone-100 p-0">
          {rows.map((r) => (
            <div key={r.id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-stone-800">{r.landlord.name} ← {r.payment.tenant.name}</div>
                  <div className="text-xs text-stone-500">{chargeLabel(r.payment.charge.kind, r.payment.charge.period)} · {fmtDate(r.payment.paidAt)} · {r.payment.receiptNo}{r.destination ? ` · to ${r.destination}` : ""}</div>
                </div>
                <Badge color={PAYOUT_STATUS[r.status]?.color}>{PAYOUT_STATUS[r.status]?.label ?? r.status}</Badge>
              </div>
              <Breakdown p={r} />
              {r.error && r.status !== "paid" && <div className="text-[11px] text-gold-700">{r.error}</div>}
              {["queued", "failed"].includes(r.status) && r.amount > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <form action={retryPayout}><input type="hidden" name="payoutId" value={r.id} /><Submit className="btn-outline btn-sm">Send now</Submit></form>
                  <details>
                    <summary className="cursor-pointer list-none text-xs font-semibold text-brand-700">Paid outside the app…</summary>
                    <form action={markPayoutPaid} className="mt-2 flex gap-2">
                      <input type="hidden" name="payoutId" value={r.id} />
                      <input name="ref" required maxLength={80} className="input py-1.5 text-xs" placeholder="Transfer reference" />
                      <Submit className="btn-primary btn-sm">Mark paid</Submit>
                    </form>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
