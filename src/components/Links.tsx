import { Clock, KeyRound, Link2, MessageCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { fmtDate, kampalaToday } from "@/lib/format";
import { tenantScore } from "@/lib/insights";
import { cancelLink, confirmLink, connectLandlord, declineLink } from "@/app/link-actions";
import { Field } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { ScorePill } from "./LeaseTools";

const local = (p: string) => p.replace("+256", "0");

/** Pre-selects the unit that best matches what the tenant wrote, e.g. "Rubaga Court Apt B1". */
function bestUnit(note: string | null, units: { id: number; label: string; property: { name: string } }[]) {
  if (!note) return null;
  const words = note.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 0 && !["the", "apt", "unit", "room", "house", "no"].includes(w));
  let best: number | null = null, top = 0;
  for (const u of units) {
    const hay = `${u.property.name} ${u.label}`.toLowerCase().split(/[^a-z0-9]+/);
    const score = words.reduce((n, w) => n + (hay.includes(w) ? (/\d/.test(w) ? 3 : 1) : 0), 0);
    if (score > top) { top = score; best = u.id; }
  }
  return best;
}

/** Tenant side: "Already renting? Connect to your landlord", or the status of the request they sent. */
export async function ConnectLandlordCard({ tenantId }: { tenantId: number }) {
  const pending = await db.tenantLink.findFirst({ where: { tenantId, status: "pending" }, include: { landlord: { select: { name: true } } } });
  if (pending) {
    return (
      <div className="card mt-4 border-gold-200 bg-gold-50/40">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-100 text-gold-700"><Clock className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-brand-950">Waiting for your landlord</div>
            <p className="mt-0.5 text-sm text-stone-600">
              {pending.landlord
                ? <>We asked {pending.landlord.name.split(" ")[0]} ({local(pending.landlordPhone)}) to confirm your lease{pending.unitNote ? ` for ${pending.unitNote}` : ""}.</>
                : <>Your landlord ({local(pending.landlordPhone)}) isn&apos;t on CasaVilla yet. We&apos;re inviting them — you&apos;ll be connected automatically when they join.</>}
            </p>
            <div className="mt-1 text-[11px] text-stone-400">Sent {fmtDate(pending.createdAt)}</div>
          </div>
        </div>
        <form action={cancelLink} className="mt-3">
          <input type="hidden" name="id" value={pending.id} />
          <ConfirmSubmit message="Cancel this request?" className="btn-ghost btn-sm text-maroon-600">Cancel request</ConfirmSubmit>
        </form>
      </div>
    );
  }
  return (
    <form action={connectLandlord} className="card mt-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Link2 className="h-5 w-5" /></span>
        <div>
          <div className="font-semibold text-brand-950">Already renting? Connect to your landlord</div>
          <p className="mt-0.5 text-sm text-stone-500">Enter their phone number. Once they confirm, you can pay rent and report repairs here.</p>
        </div>
      </div>
      <div className="relative">
        <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
        <input name="landlordPhone" required inputMode="tel" className="input pl-11" placeholder="Landlord's phone, e.g. 0772 123456" />
      </div>
      <input name="unitNote" className="input" maxLength={120} placeholder="Your house / unit (optional)" />
      <Submit className="btn-primary w-full" doneText="Sent">Send request</Submit>
    </form>
  );
}

/** Landlord / manager side: existing tenants asking to be connected, each with a form to set up their lease. */
export async function LinkRequests({ where, manager }: { where: Prisma.TenantLinkWhereInput; manager?: boolean }) {
  const rows = await db.tenantLink.findMany({
    where: { status: "pending", ...where }, orderBy: { createdAt: "asc" },
    include: { tenant: { select: { id: true, name: true, phone: true, email: true } }, landlord: { select: { id: true, name: true } } },
  });
  if (!rows.length) return null;
  const landlordIds = [...new Set(rows.map((r) => r.landlordId).filter((x): x is number => !!x))];
  const units = await db.unit.findMany({
    where: { status: "vacant", mode: "long", property: { landlordId: { in: landlordIds } } },
    orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
    select: { id: true, label: true, rent: true, property: { select: { name: true, landlordId: true } } },
  });
  const today = kampalaToday();
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextYear = `${Number(today.slice(0, 4)) + 1}${today.slice(4, 7)}-01`;
  return (
    <div className="mb-6 space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="h2">Existing tenants asking to connect</h2>
        <span className="pill bg-gold-100 text-gold-700">{rows.length}</span>
      </div>
      {await Promise.all(rows.map(async (r) => {
        const score = await tenantScore(r.tenantId);
        const mine = units.filter((u) => u.property.landlordId === r.landlordId);
        const guess = bestUnit(r.unitNote, mine);
        return (
          <div key={r.id} className="card border-gold-200">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-brand-950">{r.tenant.name}</div>
                <div className="break-words text-sm text-stone-500"><a href={`tel:${r.tenant.phone}`} className="hover:underline">{local(r.tenant.phone)}</a> · {r.tenant.email}</div>
                <p className="mt-1 text-sm text-stone-700">
                  Says they rent from {r.landlord ? (manager ? r.landlord.name : "you") : <b>a landlord not on CasaVilla ({local(r.landlordPhone)})</b>}{r.unitNote && <> — <b>“{r.unitNote}”</b></>}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2"><ScorePill s={score} /><span className="text-[11px] text-stone-400">Asked {fmtDate(r.createdAt)}</span></div>
              </div>
            </div>

            {!r.landlord ? (
              <a className="btn-outline btn-sm mt-3" target="_blank" rel="noreferrer"
                href={`https://wa.me/${r.landlordPhone.replace("+", "")}?text=${encodeURIComponent(`Hello, this is CasaVilla Property Management. Your tenant ${r.tenant.name} uses the CasaVilla app to pay rent and report repairs. Join free at https://casavilla-production.up.railway.app/register?role=landlord using this phone number and you'll be connected automatically.`)}`}>
                <MessageCircle className="h-4 w-4" /> Invite landlord on WhatsApp
              </a>
            ) : mine.length === 0 ? (
              <p className="mt-3 rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Add the tenant&apos;s unit (as vacant) under Properties first, then come back to confirm.</p>
            ) : (
              <form action={confirmLink} className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-100 pt-3 sm:grid-cols-4">
                <input type="hidden" name="id" value={r.id} />
                <div className="col-span-2 sm:col-span-4">
                  <Field label="Which unit do they live in?">
                    <select name="unitId" className="input" required defaultValue={guess ?? undefined}>
                      {mine.map((u) => <option key={u.id} value={u.id}>{u.property.name} · {u.label} — UGX {u.rent.toLocaleString("en-UG")}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="col-span-2 sm:col-span-1"><Field label="Bill rent from"><input type="date" name="startDate" defaultValue={monthStart} className="input" required /></Field></div>
                <div className="col-span-2 sm:col-span-1"><Field label="Lease ends"><input type="date" name="endDate" defaultValue={nextYear} className="input" required /></Field></div>
                <Field label="Rent / month"><input type="number" name="rent" inputMode="numeric" placeholder="Unit rent" className="input" /></Field>
                <Field label="Due day"><input type="number" name="dueDay" min={1} max={28} defaultValue={5} className="input" /></Field>
                <Field label="Deposit you hold"><input type="number" name="depositHeld" min={0} inputMode="numeric" defaultValue={0} className="input" /></Field>
                <Field label="Late fee %"><input type="number" name="lateFeePct" min={0} max={50} defaultValue={0} className="input" /></Field>
                <p className="col-span-2 text-[11px] text-stone-500 sm:col-span-4">Rent is billed from the month you choose; earlier months stay off the app. Old arrears can be added later as a charge on their lease.</p>
                <div className="col-span-2 flex gap-2 sm:col-span-4">
                  <Submit className="btn-primary flex-1">Confirm tenant & create lease</Submit>
                </div>
              </form>
            )}
            {r.landlord && (
              <form action={declineLink} className="mt-2">
                <input type="hidden" name="id" value={r.id} />
                <ConfirmSubmit message="This person doesn't rent from you? Decline their request." className="btn-ghost btn-sm text-maroon-600">Not my tenant</ConfirmSubmit>
              </form>
            )}
          </div>
        );
      }))}
    </div>
  );
}
