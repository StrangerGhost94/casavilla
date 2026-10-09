import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Users } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { kampalaToday, ugx } from "@/lib/format";
import { crumbText, trailFor } from "@/lib/geo";
import { bookedNights } from "@/lib/stays";
import { Photo } from "@/components/ui";
import { Features, Gallery } from "@/components/Gallery";
import { StayBooker } from "@/components/StayBooker";
import { StayCalendar } from "@/components/StayCalendar";

export const dynamic = "force-dynamic";

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export default async function StayPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string }> }) {
  const u = await db.unit.findUnique({ where: { id: Number((await params).id) || 0 }, include: { property: { include: { landlord: { select: { name: true, status: true } } } } } });
  if (!u || u.mode !== "short" || !u.nightlyRate || u.property.landlord.status !== "active") notFound();
  const sp = await searchParams;
  const user = await getUser();
  const today = kampalaToday();
  const booked = await bookedNights(u.id, today, addDays(today, 370));
  const trail = await trailFor(u.property.locationId);
  const p = u.property;
  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="relative">
            <Photo id={p.photoId} alt={p.name} className="h-72 w-full md:h-96 md:rounded-3xl" />
            <Link href="/stays" aria-label="Back" className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-card"><ArrowLeft className="h-5 w-5" /></Link>
          </div>
          <div className="px-4 pt-5 md:px-0">
            <span className="pill bg-gold-400 text-brand-950">Short stay</span>
            <h1 className="mt-3 text-2xl font-bold text-brand-950">{p.name} · {u.label}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" /> {p.location}</div>
            {trail.length > 1 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
            <div className="mt-3 text-2xl font-bold text-brand-900">{ugx(u.nightlyRate)} <span className="text-sm font-normal text-stone-500">/ night</span></div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-600">
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> Up to {u.maxGuests} guests</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> Check-in from {u.checkInFrom} · out by {u.checkOutBy}</span>
              {u.minNights > 1 && <span>Minimum {u.minNights} nights</span>}
              {u.cleaningFee > 0 && <span>Cleaning fee {ugx(u.cleaningFee)}</span>}
            </div>
            <Gallery propertyId={p.id} unitId={u.id} />
            <Features u={u} />
            {p.description && <section className="mt-6"><h2 className="h2">About</h2><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{p.description}</p></section>}
            {u.houseRules && <section className="mt-6"><h2 className="h2">House rules</h2><p className="mt-2 whitespace-pre-line break-words text-sm text-stone-600">{u.houseRules}</p></section>}
            <section className="mt-6"><h2 className="h2">Availability</h2><div className="mt-2"><StayCalendar booked={booked} today={today} /></div></section>
          </div>
        </div>
        <aside className="min-w-0 px-4 pb-6 md:px-0">
          <div className="card lg:sticky lg:top-24">
            <div className="h2 mb-3">Book your stay</div>
            {user ? (
              <StayBooker unitId={u.id} nightly={u.nightlyRate} cleaningFee={u.cleaningFee} minNights={u.minNights} maxGuests={u.maxGuests} booked={[...booked]} today={today} phone={user.phone}
                initial={{ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: Number(sp.guests) || 1 }} />
            ) : (
              <div className="space-y-2">
                <Link href={`/register?role=tenant&next=/stays/${u.id}`} className="btn-primary btn-lg w-full">Sign up to book</Link>
                <Link href={`/login?next=/stays/${u.id}`} className="btn-outline w-full">I already have an account</Link>
              </div>
            )}
            <p className="mt-3 text-[11px] text-stone-500">Hosted by {p.landlord.name} · managed with CasaVilla</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
