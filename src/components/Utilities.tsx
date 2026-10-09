import { Droplets, Zap } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { propertyScope } from "@/lib/access";
import { lastMonths, monthName } from "@/lib/statements";
import { BILLING_NAME, KIND_NAME, UNIT_NAME } from "@/lib/utilities";
import { Badge, Empty, Field, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { PhotoZoom } from "./FileButton";
import { addBill, addMeter, addReading, removeReading, retireMeter } from "@/app/utility-actions";

/**
 * Meters per property. Prepaid Yaka/NWSC meters are kept for reference (the tenant can see their meter number);
 * sub-meters bill the tenant from each reading; shared meters split the monthly bill between the units.
 */
export async function UtilitiesPage({ viewer }: { viewer: User }) {
  const scope = await propertyScope(viewer);
  const manage = viewer.role !== "caretaker";
  const props = await db.property.findMany({
    where: { ...scope, archivedAt: null }, orderBy: { name: "asc" },
    select: {
      id: true, name: true,
      units: { where: { mode: "long" }, orderBy: { label: "asc" }, select: { id: true, label: true, status: true } },
      meters: { where: { active: true }, orderBy: [{ unitId: "asc" }, { kind: "asc" }], include: { unit: { select: { label: true } }, readings: { orderBy: [{ readOn: "desc" }, { id: "desc" }], take: 4 }, bills: { orderBy: { period: "desc" }, take: 3 } } },
    },
  });
  const months = lastMonths(3);
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title={manage ? "Utilities & meters" : "Meter readings"} subtitle={manage ? "Yaka and NWSC meters for each unit or building. Sub-meters and shared bills become tenant charges automatically." : "Take a photo of the meter and type the number — the landlord bills the tenant from it."} />
      {!props.length && <Empty title="No properties yet" />}
      {props.map((p) => (
        <section key={p.id} className="space-y-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-stone-500">{p.name}</div>
          {p.meters.map((m) => {
            const last = m.readings[0];
            const Icon = m.kind === "water" ? Droplets : Zap;
            return (
              <div key={m.id} className="card space-y-3">
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${m.kind === "water" ? "bg-sky-50 text-sky-700" : "bg-gold-50 text-gold-700"}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-brand-950">{m.label || KIND_NAME[m.kind]} · {m.unit?.label ?? "Shared"}</div>
                    <div className="text-xs text-stone-500">{m.number ? `No. ${m.number} · ` : ""}{BILLING_NAME[m.billing]}{m.rate ? ` · ${ugx(m.rate)} per ${UNIT_NAME[m.kind].replace(/s$/, "")}` : ""}</div>
                  </div>
                  {last && <div className="text-right"><div className="text-lg font-bold text-brand-950">{last.reading}</div><div className="text-[11px] text-stone-500">{fmtDate(last.readOn)}</div></div>}
                </div>

                <form action={addReading} encType="multipart/form-data" className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_9rem_1fr_auto]">
                  <input type="hidden" name="meterId" value={m.id} />
                  <input name="reading" inputMode="decimal" required className="input" placeholder={`New reading (${UNIT_NAME[m.kind]})`} />
                  <input name="readOn" type="date" defaultValue={kampalaToday()} max={kampalaToday()} className="input" />
                  <input name="photo" type="file" accept="image/*" capture="environment" className="input col-span-2 py-2 text-xs sm:col-span-1" aria-label="Photo of the meter" />
                  <Submit className="btn-primary btn-sm col-span-2 sm:col-span-1">Save</Submit>
                  {last && <label className="col-span-2 flex items-center gap-1.5 text-[11px] text-stone-500 sm:col-span-4"><input type="checkbox" name="replaced" className="accent-brand-700" /> New meter (reading started again from zero)</label>}
                </form>

                {m.readings.length > 0 && (
                  <div className="divide-y divide-stone-100 rounded-xl border border-stone-100 text-sm">
                    {m.readings.map((r, i) => {
                      const prev = m.readings[i + 1];
                      return (
                        <div key={r.id} className="flex items-center gap-2 px-3 py-1.5">
                          <span className="w-24 shrink-0 text-xs text-stone-500">{fmtDate(r.readOn)}</span>
                          <span className="font-medium">{r.reading}</span>
                          {prev && r.reading >= prev.reading && <span className="text-xs text-stone-500">+{Math.round((r.reading - prev.reading) * 100) / 100}</span>}
                          {r.chargeId && <Badge color="blue">billed</Badge>}
                          {r.inspectionId && <span className="text-[11px] text-stone-400">inspection</span>}
                          <span className="ml-auto flex items-center gap-1.5">
                            {r.photoFileId && (
                              <PhotoZoom src={`/api/files/${r.photoFileId}`} alt={`Meter reading ${r.reading}`} className="h-8 w-10 overflow-hidden rounded ring-1 ring-stone-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`/api/files/${r.photoFileId}`} alt="" className="h-full w-full object-cover" />
                              </PhotoZoom>
                            )}
                            {manage && i === 0 && <form action={removeReading}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit message="Delete this reading? Its bill is withdrawn if unpaid." className="text-[11px] text-stone-400 hover:text-maroon-600">Undo</ConfirmSubmit></form>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {m.billing === "shared" && manage && (
                  <form action={addBill} className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-[10rem_1fr_auto]">
                    <input type="hidden" name="meterId" value={m.id} />
                    <select name="period" className="input">{months.map((x) => <option key={x} value={x} disabled={m.bills.some((b) => b.period === x)}>{monthName(x)}</option>)}</select>
                    <input name="amount" type="number" min={500} required inputMode="numeric" className="input" placeholder="Bill amount (UGX)" />
                    <Submit className="btn-outline btn-sm col-span-2 sm:col-span-1">Split between tenants</Submit>
                    {m.bills.length > 0 && <div className="col-span-2 text-[11px] text-stone-500 sm:col-span-3">{m.bills.map((b) => `${monthName(b.period)}: ${ugx(b.amount)} ÷ ${b.splitCount}`).join(" · ")}</div>}
                  </form>
                )}
                {manage && <form action={retireMeter} className="text-right"><input type="hidden" name="meterId" value={m.id} /><ConfirmSubmit message="Stop using this meter? Its readings are kept." className="text-[11px] text-stone-400 hover:text-maroon-600">Remove meter</ConfirmSubmit></form>}
              </div>
            );
          })}
          {!p.meters.length && <p className="text-sm text-stone-500">No meters yet{manage ? " — add one below" : ""}.</p>}
          {manage && (
            <details className="card">
              <summary className="cursor-pointer list-none text-sm font-semibold text-brand-700">+ Add a meter to {p.name}</summary>
              <form action={addMeter} className="mt-3 grid grid-cols-2 gap-2">
                <input type="hidden" name="propertyId" value={p.id} />
                <Field label="Type"><select name="kind" className="input"><option value="electricity">Electricity (Yaka)</option><option value="water">Water (NWSC)</option></select></Field>
                <Field label="Serves"><select name="unitId" className="input"><option value="">Several units (shared)</option>{p.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select></Field>
                <div className="col-span-2">
                  <Field label="Who pays">
                    <select name="billing" className="input">
                      <option value="prepaid">{BILLING_NAME.prepaid}</option><option value="submeter">{BILLING_NAME.submeter}</option><option value="shared">{BILLING_NAME.shared}</option>
                    </select>
                  </Field>
                </div>
                <Field label="Meter number"><input name="number" maxLength={40} className="input" placeholder="e.g. 0412 3456 789" /></Field>
                <Field label="Price per unit (sub-meters)"><input name="rate" type="number" min={1} className="input" placeholder="e.g. 900" /></Field>
                {p.units.length > 1 && (
                  <div className="col-span-2">
                    <div className="label">Shared by (shared meters — none ticked = all let units)</div>
                    <div className="flex flex-wrap gap-1.5">{p.units.map((u) => <label key={u.id} className="chip cursor-pointer has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50"><input type="checkbox" name="shareUnitId" value={u.id} className="sr-only" />{u.label}</label>)}</div>
                  </div>
                )}
                <div className="col-span-2"><Submit className="btn-primary btn-sm">Add meter</Submit></div>
              </form>
            </details>
          )}
        </section>
      ))}
    </div>
  );
}

/** The tenant's meters on their lease page — mainly the Yaka number for buying tokens. */
export async function TenantMeters({ unitId, propertyId }: { unitId: number; propertyId: number }) {
  const meters = await db.meter.findMany({
    where: { active: true, OR: [{ unitId }, { unitId: null, propertyId }] },
    include: { readings: { orderBy: [{ readOn: "desc" }, { id: "desc" }], take: 1 } },
  });
  const mine = meters.filter((m) => m.unitId === unitId || !m.shareUnitIds.length || m.shareUnitIds.includes(unitId));
  if (!mine.length) return null;
  return (
    <div className="card space-y-2 text-sm">
      <div className="font-semibold text-brand-950">Your meters</div>
      {mine.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-2">
          <span>{KIND_NAME[m.kind]}{m.number ? <> · <b className="font-mono">{m.number}</b></> : ""}<span className="block text-xs text-stone-500">{m.billing === "prepaid" ? "You pay the utility directly" : m.billing === "submeter" ? `Billed by your landlord at ${ugx(m.rate ?? 0)} per ${UNIT_NAME[m.kind].replace(/s$/, "")}` : "Shared bill, split between units"}</span></span>
          {m.readings[0] && <span className="text-right text-xs text-stone-500">Last reading<br /><b className="text-stone-800">{m.readings[0].reading}</b></span>}
        </div>
      ))}
    </div>
  );
}
