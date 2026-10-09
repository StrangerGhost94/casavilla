import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardCheck, KeyRound } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, ugx } from "@/lib/format";
import { workableUnit, propertyScope } from "@/lib/access";
import { inspectionFull, moveInBaseline, KIND_LABEL } from "@/lib/inspections";
import { InspectionEditor, type Baseline } from "./InspectionEditor";
import { FileButton } from "./FileButton";
import { Badge, Empty, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import {
  addInspectionItem, answerInspectionAction, reopenInspectionAction, saveInspectionHeader, startInspectionAction, submitInspectionAction,
} from "@/app/inspection-actions";

const STATUS: Record<string, { label: string; color: "gray" | "blue" | "green" | "red" }> = {
  draft: { label: "draft", color: "gray" }, submitted: { label: "waiting for tenant", color: "blue" },
  agreed: { label: "agreed", color: "green" }, disputed: { label: "disputed", color: "red" },
};
const pill = (s: string) => <Badge color={STATUS[s]?.color ?? "gray"}>{STATUS[s]?.label ?? s}</Badge>;

async function baselineFor(leaseId: number | null, kind: string): Promise<Baseline> {
  if (kind !== "move_out") return {};
  return Object.fromEntries(await moveInBaseline(leaseId));
}

/** The report for landlords, managers and caretakers: fill it in, submit it, reopen it, download it. */
export async function InspectionPage({ id, viewer }: { id: number; viewer: User }) {
  const ins = await inspectionFull(id);
  if (!ins || !(await workableUnit(viewer, ins.unitId))) notFound();
  const editable = ins.status === "draft";
  const baseline = await baselineFor(ins.leaseId, ins.kind);
  const back = ins.leaseId && viewer.role !== "caretaker" ? `/${viewer.role}/tenants/${ins.leaseId}` : `/${viewer.role}/inspections`;
  const reading = new Map(ins.readings.map((r) => [r.meterId, r.reading]));
  const missingNotes = ins.items.filter((i) => ["poor", "damaged", "missing"].includes(i.condition) && !i.note).length;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={back} className="link text-sm">← Back</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{KIND_LABEL[ins.kind]} inspection</h1>
          <div className="muted">{ins.unit.property.name} · {ins.unit.label}{ins.lease ? ` · ${ins.lease.tenant.name}` : ""} · {fmtDate(ins.conductedOn)}</div>
        </div>
        {pill(ins.status)}
      </div>

      {ins.status === "disputed" && (
        <div className="card mb-4 border-maroon-100 bg-maroon-50/50 text-sm">
          <div className="font-semibold text-maroon-700">The tenant disagrees</div>
          <p className="mt-1 text-stone-700">“{ins.tenantComment}”</p>
          <p className="mt-2 text-xs text-stone-500">Talk it through; reopen the report to correct it, or waive part of the damage charge from the tenant&apos;s ledger. CasaVilla has been told.</p>
        </div>
      )}
      {ins.status === "agreed" && ins.tenantComment && <div className="card mb-4 text-sm"><b>Tenant&apos;s comment:</b> {ins.tenantComment}</div>}

      <form action={saveInspectionHeader} className="card mb-4 space-y-3">
        <input type="hidden" name="id" value={ins.id} />
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <label className="min-w-0"><span className="label flex items-center gap-1"><KeyRound className="h-3 w-3" /> Keys</span><input name="keys" type="number" min={0} max={99} defaultValue={ins.keys ?? ""} disabled={!editable} className="input" /></label>
          <label className="min-w-0"><span className="label">General notes</span><input name="notes" defaultValue={ins.notes ?? ""} disabled={!editable} maxLength={3000} className="input" placeholder="e.g. Freshly painted, 2 remotes" /></label>
        </div>
        {ins.unit.meters.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ins.unit.meters.map((m) => (
              <label key={m.id} className="min-w-0"><span className="label">{m.kind === "water" ? "Water meter" : "Yaka / electricity"}{m.number ? ` · ${m.number}` : ""}</span>
                <input name={`meter_${m.id}`} inputMode="decimal" defaultValue={reading.get(m.id) ?? ""} disabled={!editable} className="input" placeholder={m.kind === "water" ? "m³" : "units"} /></label>
            ))}
          </div>
        )}
        {editable && <Submit className="btn-outline btn-sm">Save</Submit>}
      </form>

      <InspectionEditor items={ins.items.map((i) => ({ id: i.id, area: i.area, item: i.item, condition: i.condition, note: i.note, photoIds: i.photoIds, deduction: i.deduction }))}
        kind={ins.kind} editable={editable} baseline={baseline} />

      {editable && (
        <details className="card mt-3">
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-700">+ Add something not on the list</summary>
          <form action={addInspectionItem} className="mt-3 grid grid-cols-2 gap-2">
            <input type="hidden" name="inspectionId" value={ins.id} />
            <input name="area" list="ins-areas" className="input" placeholder="Room" defaultValue={ins.items.at(-1)?.area} />
            <datalist id="ins-areas">{[...new Set(ins.items.map((i) => i.area))].map((a) => <option key={a} value={a} />)}</datalist>
            <input name="item" className="input" placeholder="Item, e.g. Fridge" required />
            <div className="col-span-2"><Submit className="btn-outline btn-sm">Add</Submit></div>
          </form>
        </details>
      )}

      <div className="card mt-4 space-y-3">
        {editable ? (
          <>
            {missingNotes > 0 && <p className="text-xs text-gold-700">{missingNotes} item{missingNotes > 1 ? "s are" : " is"} marked poor/damaged without a note — a short note and a photo protect you if there&apos;s a dispute.</p>}
            <form action={submitInspectionAction}>
              <input type="hidden" name="id" value={ins.id} />
              <ConfirmSubmit className="btn-primary w-full" message={ins.lease ? `Send this report to ${ins.lease.tenant.name} to agree?${ins.kind === "move_out" ? " Deductions will be charged to the lease." : ""}` : "Finish this report?"}>
                {ins.lease ? `Finish & send to ${ins.lease.tenant.name.split(" ")[0]}` : "Finish report"}
              </ConfirmSubmit>
            </form>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <FileButton href={`/inspections/${ins.id}/pdf`} name={`inspection-${ins.id}.pdf`}>Download PDF</FileButton>
            {viewer.role !== "caretaker" && (
              <form action={reopenInspectionAction}><input type="hidden" name="id" value={ins.id} /><Submit className="btn-ghost btn-sm">Reopen to correct</Submit></form>
            )}
            {ins.chargeId && <span className="text-xs text-stone-500">Deductions of {ugx(ins.deductions)} were charged to the lease.</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** What the tenant sees: the full report, and Agree / Raise a concern. */
export async function TenantInspectionPage({ id, viewer }: { id: number; viewer: User }) {
  const ins = await inspectionFull(id);
  if (!ins || ins.lease?.tenantId !== viewer.id || ins.status === "draft") notFound();
  const baseline = await baselineFor(ins.leaseId, ins.kind);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/tenant/lease" className="link text-sm">← My lease</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="h1">{KIND_LABEL[ins.kind]} inspection</h1><div className="muted">{ins.unit.property.name} · {ins.unit.label} · {fmtDate(ins.conductedOn)} · by {ins.conductedBy.name}</div></div>
        {pill(ins.status)}
      </div>
      {ins.status === "submitted" && (
        <div className="card mb-4 border-brand-100 bg-brand-50/50 text-sm text-brand-900">
          Please go through the report{ins.kind === "move_out" && ins.deductions ? ` — ${ugx(ins.deductions)} is proposed to be taken from your deposit` : ""}. If something isn&apos;t right, raise it below; it goes to your landlord and CasaVilla.
        </div>
      )}
      {(ins.keys != null || ins.notes || ins.readings.length > 0) && (
        <div className="card mb-4 space-y-1 text-sm text-stone-700">
          {ins.keys != null && <div>Keys handed over: <b>{ins.keys}</b></div>}
          {ins.readings.map((r) => <div key={r.id}>{r.meter.kind === "water" ? "Water meter" : "Electricity meter"}{r.meter.number ? ` ${r.meter.number}` : ""}: <b>{r.reading}</b></div>)}
          {ins.notes && <div>{ins.notes}</div>}
        </div>
      )}
      <InspectionEditor items={ins.items.map((i) => ({ id: i.id, area: i.area, item: i.item, condition: i.condition, note: i.note, photoIds: i.photoIds, deduction: i.deduction }))}
        kind={ins.kind} editable={false} baseline={baseline} />
      <div className="card mt-4 space-y-3">
        <FileButton href={`/inspections/${ins.id}/pdf`} name={`inspection-${ins.id}.pdf`}>Download PDF</FileButton>
        {["submitted", "disputed"].includes(ins.status) && (
          <div className="space-y-2">
            {ins.status === "submitted" && (
              <form action={answerInspectionAction}>
                <input type="hidden" name="id" value={ins.id} /><input type="hidden" name="answer" value="agree" />
                <Submit className="btn-primary w-full">I agree with this report</Submit>
              </form>
            )}
            <details className="rounded-xl border border-stone-200 p-3" open={ins.status === "disputed"}>
              <summary className="cursor-pointer list-none text-sm font-semibold text-maroon-600">{ins.status === "disputed" ? "Your concern" : "Something isn't right? Raise a concern"}</summary>
              <form action={answerInspectionAction} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={ins.id} /><input type="hidden" name="answer" value="dispute" />
                <textarea name="comment" required rows={3} maxLength={1000} className="input" placeholder="e.g. The crack in Bedroom 1 was there when I moved in" defaultValue={ins.tenantComment ?? ""} />
                <Submit className="btn-outline btn-sm border-maroon-200 text-maroon-600">{ins.status === "disputed" ? "Update my concern" : "Send to landlord & CasaVilla"}</Submit>
              </form>
            </details>
            {ins.status === "disputed" && (
              <form action={answerInspectionAction}>
                <input type="hidden" name="id" value={ins.id} /><input type="hidden" name="answer" value="agree" />
                <Submit className="btn-ghost btn-sm">It&apos;s been sorted — I agree now</Submit>
              </form>
            )}
          </div>
        )}
        {ins.status === "agreed" && <p className="text-sm text-brand-700">You agreed with this report{ins.tenantAnsweredAt ? ` on ${fmtDate(ins.tenantAnsweredAt)}` : ""}.</p>}
      </div>
    </div>
  );
}

/** On a tenancy page: the move-in and move-out reports, or buttons to start them. */
export async function InspectionsCard({ leaseId, viewer, manage }: { leaseId: number; viewer: User; manage: boolean }) {
  const l = await db.lease.findUnique({ where: { id: leaseId }, select: { status: true, unitId: true } });
  if (!l) return null;
  const list = await db.inspection.findMany({ where: { leaseId }, orderBy: { createdAt: "asc" } });
  const has = (k: string) => list.find((i) => i.kind === k);
  const href = (id: number) => (manage ? `/${viewer.role}/inspections/${id}` : `/tenant/inspections/${id}`);
  const shown = manage ? list : list.filter((i) => i.status !== "draft");
  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2 font-semibold text-brand-950"><ClipboardCheck className="h-4 w-4 text-brand-700" /> Inspections</div>
      {shown.map((i) => (
        <Link key={i.id} href={href(i.id)} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50">
          <span>{KIND_LABEL[i.kind]} · {fmtDate(i.conductedOn)}{i.deductions ? ` · −${ugx(i.deductions)}` : ""}</span>{pill(i.status)}
        </Link>
      ))}
      {!shown.length && <p className="text-xs text-stone-500">{manage ? "Record the condition room by room, with photos, and the tenant confirms it. It settles deposit questions at move-out." : "No inspection reports yet."}</p>}
      {manage && (
        <div className="flex flex-wrap gap-2">
          {!has("move_in") && (
            <form action={startInspectionAction}><input type="hidden" name="leaseId" value={leaseId} /><input type="hidden" name="kind" value="move_in" /><Submit className="btn-outline btn-sm">Start move-in inspection</Submit></form>
          )}
          {!has("move_out") && (
            <form action={startInspectionAction}><input type="hidden" name="leaseId" value={leaseId} /><input type="hidden" name="kind" value="move_out" /><Submit className={l.status === "active" ? "btn-ghost btn-sm" : "btn-outline btn-sm"}>Start move-out inspection</Submit></form>
          )}
        </div>
      )}
    </div>
  );
}

/** All inspections the person can see, plus starting a routine check on any unit. */
export async function InspectionList({ viewer }: { viewer: User }) {
  const scope = await propertyScope(viewer);
  const [list, units] = await Promise.all([
    db.inspection.findMany({
      where: { unit: { property: scope } }, orderBy: { createdAt: "desc" }, take: 80,
      include: { unit: { select: { label: true, property: { select: { name: true } } } }, lease: { select: { tenant: { select: { name: true } } } } },
    }),
    db.unit.findMany({
      where: { property: { ...scope, archivedAt: null }, mode: "long" }, orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: { id: true, label: true, property: { select: { name: true } }, leases: { where: { status: "active" }, select: { id: true, tenant: { select: { name: true } } } } },
    }),
  ]);
  const waiting = list.filter((i) => i.status === "submitted").length, disputed = list.filter((i) => i.status === "disputed").length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Inspections" subtitle={`Move-in, move-out and routine condition reports${waiting ? ` · ${waiting} waiting for tenants` : ""}${disputed ? ` · ${disputed} disputed` : ""}.`} />
      <form action={startInspectionAction} className="card mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <select name="unitId" className="input" required defaultValue="">
          <option value="" disabled>Choose a unit…</option>
          {units.map((u) => <option key={u.id} value={u.id}>{u.property.name} · {u.label}{u.leases[0] ? ` — ${u.leases[0].tenant.name}` : " — vacant"}</option>)}
        </select>
        <select name="kind" className="input" defaultValue="routine"><option value="routine">Routine check</option></select>
        <Submit className="btn-primary">Start</Submit>
        <p className="text-[11px] text-stone-500 sm:col-span-3">Move-in and move-out reports are started from the tenant&apos;s tenancy page{viewer.role === "caretaker" ? " — ask the landlord, or start one from the unit list below" : ""}.</p>
      </form>
      {viewer.role === "caretaker" && units.some((u) => u.leases[0]) && (
        <div className="card mb-4 space-y-2">
          <div className="text-sm font-semibold text-brand-950">Move-in / move-out for a tenancy</div>
          {units.filter((u) => u.leases[0]).map((u) => (
            <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{u.property.name} · {u.label} — {u.leases[0].tenant.name}</span>
              <span className="flex gap-1.5">
                {(["move_in", "move_out"] as const).map((k) => (
                  <form key={k} action={startInspectionAction}><input type="hidden" name="leaseId" value={u.leases[0].id} /><input type="hidden" name="kind" value={k} /><Submit className="btn-outline btn-sm">{KIND_LABEL[k]}</Submit></form>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
      {list.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {list.map((i) => (
            <Link key={i.id} href={`/${viewer.role}/inspections/${i.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-stone-800">{KIND_LABEL[i.kind]} · {i.unit.property.name} · {i.unit.label}</div>
                <div className="truncate text-xs text-stone-500">{fmtDate(i.conductedOn)}{i.lease ? ` · ${i.lease.tenant.name}` : ""}{i.deductions ? ` · deductions ${ugx(i.deductions)}` : ""}</div>
              </div>
              {pill(i.status)}
            </Link>
          ))}
        </div>
      ) : <Empty title="No inspections yet">Start one above, or from a tenant&apos;s page when they move in.</Empty>}
    </div>
  );
}
