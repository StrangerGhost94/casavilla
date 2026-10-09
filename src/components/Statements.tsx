import Link from "next/link";
import { Check, Paperclip, Trash2, X } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/rules";
import { KIND_NAMES, lastMonths, monthName, statement } from "@/lib/statements";
import { FileButton } from "./FileButton";
import { Empty, Field, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { addExpense, decideExpense, deleteExpense, setCommission } from "@/app/expense-actions";

/**
 * Monthly statement for one landlord: money in (by what it paid for and by property), money out (expenses and
 * commission), the net, arrears and occupancy, and a URA rental-tax estimate. Expenses are added on the same page.
 */
export async function StatementPage({ viewer, landlordId, month, propertyId, base, landlords }: {
  viewer: User; landlordId: number; month: string; propertyId?: number; base: string; landlords?: { id: number; name: string }[];
}) {
  const s = await statement(landlordId, month, propertyId);
  const pending = await db.expense.findMany({ where: { landlordId, status: "pending" }, orderBy: { createdAt: "asc" }, include: { createdBy: { select: { name: true } }, property: { select: { name: true } } } });
  const q = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const v = { landlord: landlords ? landlordId : undefined, month, property: propertyId, ...o };
    for (const [k, x] of Object.entries(v)) if (x !== undefined && x !== "") p.set(k, String(x));
    return `${base}?${p}`;
  };
  const pdf = `/statements/pdf?landlord=${landlordId}&month=${month}${propertyId ? `&property=${propertyId}` : ""}`;
  const incomeRows = Object.entries(s.byKind).filter(([k, v]) => k !== "deposit" && v > 0);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Statements & expenses" subtitle={`${s.landlord.businessName || s.landlord.name} · what came in, what went out, and what's left.`} />

      <form className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" action={base}>
        {landlords && (
          <select name="landlord" defaultValue={landlordId} className="input col-span-2">
            {landlords.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        <select name="month" defaultValue={month} className="input">{lastMonths(24).map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select>
        <select name="property" defaultValue={propertyId ?? ""} className="input">
          <option value="">All properties</option>
          {(await db.property.findMany({ where: { landlordId }, orderBy: { name: "asc" }, select: { id: true, name: true } })).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <button className="btn-outline col-span-2 sm:col-span-1">Show</button>
      </form>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Received" value={ugx(s.income)} />
        <Kpi label="Expenses + fees" value={ugx(s.spent + s.commission)} />
        <Kpi label="Net to landlord" value={ugx(s.net)} strong />
        <Kpi label="Arrears at month end" value={ugx(s.arrears)} hint={`${s.occupied}/${s.units} units let`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-2 font-semibold text-brand-950">Money in · {monthName(month)}</div>
          {incomeRows.length ? incomeRows.map(([k, v]) => <Line key={k} k={KIND_NAMES[k] ?? k} v={ugx(v)} />) : <p className="text-sm text-stone-500">Nothing received this month.</p>}
          {s.deposits > 0 && <Line k="Deposits received (held for tenants, not income)" v={ugx(s.deposits)} muted />}
          {s.properties.length > 1 && s.byProperty.size > 0 && (
            <div className="mt-3 border-t border-stone-100 pt-2">
              <div className="label">By property</div>
              {s.properties.filter((p) => s.byProperty.get(p.id)).map((p) => <Line key={p.id} k={p.name} v={ugx(s.byProperty.get(p.id)!)} muted />)}
            </div>
          )}
        </div>
        <div className="card">
          <div className="mb-2 font-semibold text-brand-950">Money out</div>
          {Object.entries(s.byCategory).map(([k, v]) => <Line key={k} k={k} v={ugx(v)} />)}
          {s.commission > 0 && <Line k={`CasaVilla management fee (${s.commissionPct}% of rent collected)`} v={ugx(s.commission)} />}
          {!s.spent && !s.commission && <p className="text-sm text-stone-500">No expenses recorded this month.</p>}
          <div className="mt-2 border-t border-stone-100 pt-2"><Line k="Net" v={ugx(s.net)} bold /></div>
        </div>
      </div>

      <div className="card mt-4 text-sm">
        <div className="font-semibold text-brand-950">Rental income tax estimate (URA) · tax year {s.tax.year}</div>
        <p className="mt-1 text-stone-600">Gross rent received so far: <b>{ugx(s.tax.grossRent)}</b>. For individuals, tax is {Math.round(s.tax.rate * 100)}% of gross rent above {ugx(s.tax.threshold)} a year, with no expenses deducted — about <b>{ugx(s.tax.estimate)}</b> so far.</p>
        <p className="mt-1 text-[11px] text-stone-500">An estimate only. Companies are taxed on net profit at a different rate. Confirm with URA or your accountant before filing.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <FileButton href={pdf} name={`statement-${month}.pdf`}>Download statement PDF</FileButton>
        {landlords && (
          <form action={setCommission} className="flex items-center gap-2">
            <input type="hidden" name="landlordId" value={landlordId} />
            <input name="pct" type="number" min={0} max={50} step={0.5} defaultValue={s.commissionPct} className="input w-24 py-2" aria-label="Commission %" />
            <Submit className="btn-outline btn-sm">Set commission %</Submit>
          </form>
        )}
      </div>

      {pending.length > 0 && viewer.role !== "caretaker" && (
        <div className="card mt-6 border-gold-200 bg-gold-50/40">
          <div className="mb-2 font-semibold text-brand-950">Waiting for your approval</div>
          {pending.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-gold-100 py-2 text-sm first:border-0">
              <div className="min-w-0">
                <div className="font-medium">{e.description} · {ugx(e.amount)}</div>
                <div className="text-xs text-stone-500">{e.category} · {e.property?.name ?? "—"} · {fmtDate(e.spentOn)} · by {e.createdBy.name}{e.receiptFileId ? " · " : ""}{e.receiptFileId && <FileButton href={`/api/files/${e.receiptFileId}`} name="receipt" className="link text-xs">receipt</FileButton>}</div>
              </div>
              <div className="flex gap-1.5">
                <form action={decideExpense}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="approve" /><Submit className="btn-primary btn-sm"><Check className="h-3.5 w-3.5" /> Approve</Submit></form>
                <form action={decideExpense}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="decision" value="reject" /><Submit className="btn-ghost btn-sm"><X className="h-3.5 w-3.5" /> Reject</Submit></form>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="card p-0">
          <div className="px-4 pb-2 pt-4 font-semibold text-brand-950">Expenses · {monthName(month)}</div>
          {s.expenses.length ? (
            <div className="divide-y divide-stone-100 border-t border-stone-100">
              {s.expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-stone-800">{e.description}</div>
                    <div className="truncate text-xs text-stone-500">{e.category} · {e.property?.name ?? "General"}{e.unit ? ` · ${e.unit.label}` : ""} · {fmtDate(e.spentOn)}{e.jobId ? " · from a repair job" : ""}</div>
                  </div>
                  {e.receiptFileId && <FileButton href={`/api/files/${e.receiptFileId}`} name="receipt" className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"><Paperclip className="h-4 w-4" /></FileButton>}
                  <span className="font-semibold">{ugx(e.amount)}</span>
                  {!e.jobId && (
                    <form action={deleteExpense}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit message="Delete this expense?" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100"><Trash2 className="h-4 w-4" /></ConfirmSubmit></form>
                  )}
                </div>
              ))}
            </div>
          ) : <div className="px-4 pb-4"><Empty title="No expenses this month">Repairs done through CasaVilla are added automatically.</Empty></div>}
        </div>
        <ExpenseForm landlordId={landlordId} />
      </div>
      <p className="mt-4 text-center text-xs text-stone-400"><Link href={q({ month: lastMonths(2)[1] })} className="hover:underline">Last month</Link></p>
    </div>
  );
}

export async function ExpenseForm({ landlordId, propertyIds }: { landlordId?: number; propertyIds?: number[] }) {
  const props = await db.property.findMany({ where: propertyIds ? { id: { in: propertyIds } } : { landlordId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <form action={addExpense} className="card space-y-2.5 self-start">
      <div className="font-semibold text-brand-950">Add an expense</div>
      <Field label="Property">
        <select name="propertyId" className="input" required={!!propertyIds}>
          {!propertyIds && <option value="">General (not one property)</option>}
          {props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="Category"><select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
      <Field label="What for"><input name="description" required maxLength={160} className="input" placeholder="e.g. Askari for October" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount (UGX)"><input name="amount" type="number" min={100} required inputMode="numeric" className="input" /></Field>
        <Field label="Date"><input name="spentOn" type="date" defaultValue={kampalaToday()} max={kampalaToday()} className="input" /></Field>
      </div>
      <Field label="Receipt (optional)"><input name="receipt" type="file" accept="image/*,application/pdf" className="input py-2 text-sm" /></Field>
      {propertyIds && <p className="text-[11px] text-stone-500">The landlord approves it before it goes on their statement.</p>}
      <Submit className="btn-primary btn-sm">Add expense</Submit>
    </form>
  );
}

function Kpi({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return (
    <div className={`card p-4 ${strong ? "border-brand-200 bg-brand-50/60" : ""}`}>
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${strong ? "text-brand-900" : "text-brand-950"}`}>{value}</div>
      {hint && <div className="text-[11px] text-stone-500">{hint}</div>}
    </div>
  );
}
function Line({ k, v, bold, muted }: { k: string; v: string; bold?: boolean; muted?: boolean }) {
  return <div className={`flex justify-between gap-3 py-1 text-sm ${muted ? "text-stone-500" : "text-stone-700"} ${bold ? "font-bold text-brand-950" : ""}`}><span className="min-w-0">{k}</span><span className="shrink-0">{v}</span></div>;
}

