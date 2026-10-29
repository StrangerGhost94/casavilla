import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BadgeCheck, BedDouble, LogIn, LogOut, MapPin, Moon, Users, type LucideIcon } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { kampalaToday, ugx } from "@/lib/format";
import { crumbText, trailFor } from "@/lib/geo";
import { AroundHere } from "@/components/AroundHere";
import { bookedNights } from "@/lib/stays";
import { ListingPhotos } from "@/components/Gallery";
import { VideoTour } from "@/components/VideoTour";
import { ActionBar, Checklist, FactTiles, LocationCard, PhotoButtons, shareLink } from "@/components/ListingParts";
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
  const area = [...trail].reverse().find((c) => ["subcounty", "county", "district"].includes(c.level));
  const share = shareLink(`${p.name} · ${u.label}, ${p.location}: ${ugx(u.nightlyRate)} a night`, `/stays/${u.id}`);
  const facts: [LucideIcon, string, string][] = [
    [Users, String(u.maxGuests), "Guests max"],
    [BedDouble, u.bedrooms ? String(u.bedrooms) : "Studio", u.bedrooms === 1 ? "Bedroom" : u.bedrooms ? "Bedrooms" : "Layout"],
    [Bath, String(u.bathrooms), u.bathrooms === 1 ? "Bathroom" : "Bathrooms"],
    [Moon, String(u.minNights), u.minNights === 1 ? "Night min" : "Nights min"],
    [LogIn, u.checkInFrom, "Check-in from"],
    [LogOut, u.checkOutBy, "Check-out by"],
  ];
  const amenities = [u.selfContained ? "Self-contained" : null, u.furnished ? "Furnished" : null, u.sizeSqm ? `${u.sizeSqm} m²` : null, ...u.amenities].filter(Boolean) as string[];
  const bookHref = user ? "#book" : `/register?role=tenant&next=/stays/${u.id}`;
  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ListingPhotos propertyId={p.id} unitId={u.id} coverId={p.photoId} alt={p.name} overlay={<PhotoButtons back="/stays" backLabel="Back to stays" share={share} video={!!p.videoUrl} save={{ kind: "stay", id: u.id }} />} />
          <div className="relative -mt-6 rounded-t-3xl bg-cream px-4 pt-5 md:mt-0 md:bg-transparent md:px-0">
            <div className="flex flex-wrap gap-1.5">
              <span className="pill bg-gold-400 uppercase tracking-wide text-brand-950">Short stay</span>
              {p.verifiedAt && <span className="pill bg-brand-50 text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
            </div>
            <h1 className="mt-3 text-2xl font-bold text-brand-950 md:text-3xl">{p.name} · {u.label}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" /> {p.location}</div>
            {trail.length > 1 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
            <div className="mt-3 text-2xl font-bold text-brand-900 lg:hidden">{ugx(u.nightlyRate)} <span className="text-sm font-normal text-stone-500">/ night</span>{u.cleaningFee > 0 && <span className="block text-xs font-normal text-stone-500">+ {ugx(u.cleaningFee)} cleaning, once per stay</span>}</div>

            <FactTiles facts={facts} />
            {p.videoUrl && <VideoTour url={p.videoUrl} title={`${p.name} · ${u.label}`} />}
            <Checklist title="What this place offers" items={amenities} />
            {p.description && <section className="mt-6"><h2 className="h2">About this place</h2><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{p.description}</p></section>}
            {u.houseRules && <section className="mt-6"><h2 className="h2">House rules</h2><p className="mt-2 whitespace-pre-line break-words rounded-2xl border border-stone-200/70 bg-white p-4 text-sm text-stone-600">{u.houseRules}</p></section>}
            <section className="mt-6"><h2 className="h2">Availability</h2><p className="text-xs text-stone-500">Crossed-out nights are already booked.</p><div className="mt-2"><StayCalendar booked={booked} today={today} /></div></section>
            <LocationCard address={p.location} landmark={p.landmark} lat={p.lat} lng={p.lng} />
            <AroundHere area={area} skip="stays" />
          </div>
        </div>
        <aside id="book" className="min-w-0 scroll-mt-20 px-4 pb-24 md:px-0 lg:pb-6">
          <div className="card lg:sticky lg:top-24">
            <div className="mb-4">
              <div className="text-2xl font-bold text-brand-950">{ugx(u.nightlyRate)} <span className="text-sm font-normal text-stone-500">/ night</span></div>
              <div className="mt-0.5 text-xs text-stone-500">{u.cleaningFee > 0 ? `+ ${ugx(u.cleaningFee)} cleaning · ` : ""}Paid with MTN or Airtel MoMo</div>
            </div>
            {user ? (
              <StayBooker unitId={u.id} nightly={u.nightlyRate} cleaningFee={u.cleaningFee} minNights={u.minNights} maxGuests={u.maxGuests} booked={[...booked]} today={today} phone={user.phone}
                initial={{ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: Number(sp.guests) || 1 }} />
            ) : (
              <div className="space-y-2">
                <Link href={bookHref} className="btn-primary btn-lg w-full">Sign up to book</Link>
                <p className="text-center text-xs text-stone-500">Free account · takes a minute</p>
              </div>
            )}
            <p className="mt-3 border-t border-stone-100 pt-3 text-[11px] text-stone-500">Hosted by {p.landlord.name} · managed with CasaVilla</p>
          </div>
        </aside>
      </div>
      <ActionBar price={ugx(u.nightlyRate)} per="/ night" sub={`${p.name} · ${u.label}`}>
        <a href={bookHref} className="btn-primary btn-sm">{user ? "Choose dates" : "Book"}</a>
      </ActionBar>
    </main>
  );
}
