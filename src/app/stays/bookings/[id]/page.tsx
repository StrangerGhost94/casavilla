import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { homeFor, requireUser } from "@/lib/auth";
import { fmtDate, kampalaToday, ugx, ymd } from "@/lib/format";
import { bookingData, nightsBetween } from "@/lib/stays";
import { cancelStay } from "@/app/stay-actions";
import { Badge, Photo } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";

export const metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const d = await bookingData(Number((await params).id) || 0, me);
  if (!d || d.b.status === "blocked") notFound();
  const { b } = d;
  const p = b.unit.property;
  const isGuest = me.id === b.guestId;
  const today = kampalaToday();
  const free = nightsBetween(today, ymd(b.checkIn)) >= 2;
  const map = p.lat != null ? `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location + ", Uganda")}`;
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href={homeFor(me.role)} className="btn-ghost mb-3">← Dashboard</Link>
      <div className="card overflow-hidden p-0">
        <Photo id={p.photoId} alt={p.name} className="h-40 w-full" />
        <div className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-2">
            <div><div className="text-lg font-bold text-brand-950">{p.name} · {b.unit.label}</div><div className="text-xs text-stone-500">{p.location}</div></div>
            <Badge>{b.status}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 text-sm">
            <div><div className="text-xs text-stone-500">Check-in</div><div className="font-semibold">{fmtDate(b.checkIn)}</div><div className="text-xs text-stone-500">from {b.unit.checkInFrom}</div></div>
            <div><div className="text-xs text-stone-500">Check-out</div><div className="font-semibold">{fmtDate(b.checkOut)}</div><div className="text-xs text-stone-500">by {b.unit.checkOutBy}</div></div>
          </div>
          <div className="text-sm">{b.nights} night{b.nights > 1 ? "s" : ""} · {b.guests} guest{b.guests > 1 ? "s" : ""} · <b>{ugx(b.total)}</b>{b.receiptNo && <span className="text-stone-500"> · {b.receiptNo}</span>}</div>
          {!isGuest && <div className="text-sm">Guest: <b>{b.guest.name}</b> · <a className="link" href={`tel:${b.guest.phone}`}>{b.guest.phone}</a></div>}
          {p.landmark && <div className="text-xs text-stone-600">Landmark: {p.landmark}</div>}
          {b.note && <div className="rounded-lg bg-gold-50 p-2 text-xs text-gold-800">{b.note}</div>}
          <div className="grid grid-cols-2 gap-2">
            {["confirmed", "completed"].includes(b.status) && <a href={`/stays/bookings/${b.id}/pdf`} className="btn-primary btn-sm"><Download className="h-4 w-4" /> Receipt PDF</a>}
            <a href={map} target="_blank" rel="noreferrer" className="btn-outline btn-sm">Directions</a>
          </div>
          {["pending", "confirmed"].includes(b.status) && ymd(b.checkIn) > today && (
            <form action={cancelStay} className="border-t border-stone-100 pt-3">
              <input type="hidden" name="id" value={b.id} />
              <ConfirmSubmit message={isGuest ? (b.status === "pending" || free ? "Cancel this booking? You'll get a full refund." : "Cancel? It's less than 2 days to check-in, so the first night is kept.") : "Cancel this guest's booking? They'll be refunded in full."} className="btn-ghost btn-sm w-full text-maroon-600">Cancel booking</ConfirmSubmit>
              {isGuest && b.status === "confirmed" && <p className="mt-1 text-center text-[11px] text-stone-500">{free ? "Free cancellation until 2 days before check-in." : "Within 2 days of check-in the first night isn't refunded."}</p>}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
