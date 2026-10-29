import Link from "next/link";
import { CalendarCheck, CalendarClock, MessageCircle, Phone } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { fmtDateTime, kampalaToday } from "@/lib/format";
import { cancelViewing, confirmViewing, declineViewing, proposeViewing, requestViewing } from "@/app/viewing-actions";
import { Avatar } from "./ui";
import { ConfirmSubmit, Submit } from "./client";

const TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
const OPEN = ["requested", "proposed", "confirmed"];
const STATUS: Record<string, [string, string]> = {
  requested: ["Waiting for the landlord", "bg-gold-50 text-gold-700"], proposed: ["New time suggested", "bg-sky-50 text-sky-700"],
  confirmed: ["Confirmed", "bg-brand-50 text-brand-700"], declined: ["Declined", "bg-maroon-50 text-maroon-600"], cancelled: ["Cancelled", "bg-stone-100 text-stone-500"],
};

function TimeFields({ defaultDate }: { defaultDate?: string }) {
  const today = kampalaToday();
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="block"><span className="label">Day</span><input type="date" name="date" min={today} defaultValue={defaultDate} required className="input" /></label>
      <label className="block"><span className="label">Time</span>
        <select name="time" className="input" defaultValue="10:00" required>{TIMES.map((t) => <option key={t} value={t}>{Number(t.slice(0, 2)) > 12 ? `${Number(t.slice(0, 2)) - 12}:00 pm` : `${Number(t.slice(0, 2))}:00 ${t === "12:00" ? "pm" : "am"}`}</option>)}</select>
      </label>
    </div>
  );
}

/** On a listing: book a viewing, or see the one already booked. */
export async function ViewingBox({ unitId, saleListingId, hostId, next }: { unitId?: number; saleListingId?: number; hostId: number; next: string }) {
  const u = await getUser();
  if (u?.id === hostId) return null;
  const open = u ? await db.viewing.findFirst({ where: { requesterId: u.id, unitId: unitId ?? null, saleListingId: saleListingId ?? null, status: { in: OPEN }, at: { gt: new Date() } } }) : null;
  return (
    <div id="viewing" className="scroll-mt-20 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-950"><CalendarCheck className="h-4 w-4 text-brand-700" /> Book a viewing</div>
      {!u ? (
        <Link href={`/login?next=${encodeURIComponent(`${next}#viewing`)}`} className="btn-outline w-full">Choose a day to view</Link>
      ) : open ? (
        <div className="text-sm">
          <span className={`pill ${STATUS[open.status][1]}`}>{STATUS[open.status][0]}</span>
          <div className="mt-1 font-semibold text-stone-800">{fmtDateTime(open.at)}</div>
          <Link href="/viewings" className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">Manage on Viewings →</Link>
        </div>
      ) : (
        <form action={requestViewing} className="space-y-2">
          {unitId && <input type="hidden" name="unitId" value={unitId} />}
          {saleListingId && <input type="hidden" name="saleListingId" value={saleListingId} />}
          <TimeFields />
          <input name="note" maxLength={500} className="input" placeholder="Anything they should know? (optional)" />
          <Submit className="btn-outline w-full" pendingText="Sending…" doneText="Requested">Request this time</Submit>
          <p className="text-center text-[11px] text-stone-400">The landlord confirms or suggests another time. You&apos;ll get a reminder.</p>
        </form>
      )}
    </div>
  );
}

const include = {
  unit: { select: { id: true, label: true, property: { select: { name: true, location: true } } } },
  saleListing: { select: { id: true, title: true, location: true } },
  requester: { select: { name: true, phone: true } }, host: { select: { name: true, phone: true } },
} satisfies Prisma.ViewingInclude;
type Row = Prisma.ViewingGetPayload<{ include: typeof include }>;

export const viewingsFor = (where: Prisma.ViewingWhereInput) => db.viewing.findMany({ where, include, orderBy: { at: "asc" }, take: 200 });

/** One viewing, with what each side can do next. */
export function ViewingRow({ v, as }: { v: Row; as: "host" | "requester" }) {
  const what = v.unit ? `${v.unit.property.name} · ${v.unit.label}` : v.saleListing?.title ?? "Home";
  const where = v.unit?.property.location ?? v.saleListing?.location ?? "";
  const href = v.unit ? `/listings/${v.unit.id}` : v.saleListing ? `/sale/${v.saleListing.id}` : "#";
  const other = as === "host" ? v.requester : v.host;
  const tel = other.phone.replace(/\D/g, "");
  const live = OPEN.includes(v.status) && v.at > new Date();
  return (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${v.status === "confirmed" ? "bg-brand-700 text-white" : "bg-stone-100 text-stone-700"}`}>
          <span className="text-[10px] font-semibold uppercase leading-none">{v.at.toLocaleDateString("en-GB", { month: "short", timeZone: "Africa/Kampala" })}</span>
          <span className="text-lg font-bold leading-none">{v.at.toLocaleDateString("en-GB", { day: "numeric", timeZone: "Africa/Kampala" })}</span>
        </span>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-sm font-semibold text-stone-900 hover:underline">{what}</Link>
          <div className="truncate text-xs text-stone-500">{fmtDateTime(v.at)}{where ? ` · ${where}` : ""}</div>
          <span className={`pill mt-1 ${STATUS[v.status]?.[1]}`}>{as === "host" && v.status === "requested" ? "Needs your answer" : as === "requester" && v.status === "proposed" ? "New time — accept or cancel" : STATUS[v.status]?.[0]}</span>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <Avatar name={other.name} className="h-8 w-8 text-[10px]" />
        <span className="min-w-0 flex-1 truncate text-stone-700">{as === "host" ? "Requested by" : "Host"}: <b>{other.name}</b></span>
        {v.status === "confirmed" && tel && <>
          <a href={`tel:+${tel}`} aria-label={`Call ${other.name}`} className="btn-outline btn-sm px-2.5"><Phone className="h-4 w-4" /></a>
          <a href={`https://wa.me/${tel}`} aria-label={`WhatsApp ${other.name}`} className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>
        </>}
      </div>
      {v.note && <p className="mt-2 rounded-lg bg-stone-50 p-2 text-xs text-stone-600">“{v.note}”</p>}
      {v.hostNote && <p className="mt-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-800">{v.host.name}: “{v.hostNote}”</p>}
      {live && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {((as === "host" && v.status === "requested") || (as === "requester" && v.status === "proposed")) && (
            <form action={confirmViewing}><input type="hidden" name="id" value={v.id} /><Submit className="btn-primary btn-sm" doneText="Confirmed">{as === "host" ? "Confirm" : "Accept new time"}</Submit></form>
          )}
          {as === "host" && v.status !== "proposed" && (
            <details className="group">
              <summary className="btn-outline btn-sm cursor-pointer list-none"><CalendarClock className="h-4 w-4" /> Suggest another time</summary>
              <form action={proposeViewing} className="mt-2 w-72 max-w-full space-y-2 rounded-xl border border-stone-200 bg-white p-3">
                <input type="hidden" name="id" value={v.id} />
                <TimeFields />
                <input name="hostNote" maxLength={300} className="input" placeholder="Note (optional)" />
                <Submit className="btn-primary btn-sm w-full">Send new time</Submit>
              </form>
            </details>
          )}
          {as === "host" && (
            <form action={declineViewing}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="hostNote" value="The home is no longer available" /><ConfirmSubmit message="Decline this viewing?" className="btn-ghost btn-sm text-maroon-600">Decline</ConfirmSubmit></form>
          )}
          {as === "requester" && (
            <form action={cancelViewing}><input type="hidden" name="id" value={v.id} /><ConfirmSubmit message="Cancel this viewing?" className="btn-ghost btn-sm text-maroon-600">Cancel</ConfirmSubmit></form>
          )}
        </div>
      )}
    </div>
  );
}
