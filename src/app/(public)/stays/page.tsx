import Link from "next/link";
import { BedDouble, MapPin, Users } from "lucide-react";
import { db } from "@/db";
import { kampalaToday, ugx } from "@/lib/format";
import { crumbText, insideFilter, trailFor } from "@/lib/geo";
import { isFree, nightsBetween, checkStay } from "@/lib/stays";
import { Empty } from "@/components/ui";
import { StayCard } from "@/components/PropertyCard";
import { LocationPicker } from "@/components/LocationPicker";
import { DiscoverTabs } from "@/components/DiscoverTabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short stays" };

export default async function Stays({ searchParams }: { searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; in?: string }> }) {
  const sp = await searchParams;
  const today = kampalaToday();
  const guests = Math.max(1, Number(sp.guests) || 1);
  const dated = !!(sp.checkIn && sp.checkOut);
  const area = await trailFor(sp.in);
  const inside = area.length > 1 ? await insideFilter(sp.in) : null;
  const units = await db.unit.findMany({
    where: { mode: "short", listed: true, nightlyRate: { not: null }, maxGuests: { gte: guests }, property: { archivedAt: null, landlord: { status: "active" }, ...(inside ? { place: inside } : {}) } },
    include: { property: true },
    orderBy: { nightlyRate: "asc" }, take: 100,
  });
  const n = dated ? nightsBetween(sp.checkIn!, sp.checkOut!) : 0;
  const rows = (await Promise.all(units.map(async (u) => {
    if (!dated) return { u, ok: true, note: null as string | null };
    const bad = checkStay(u, sp.checkIn!, sp.checkOut!, guests);
    if (bad) return { u, ok: false, note: bad };
    return { u, ok: await isFree(u.id, sp.checkIn!, sp.checkOut!), note: null };
  }))).filter((r) => r.ok);
  const q = (id: number) => `/stays/${id}?${new URLSearchParams(Object.entries({ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests }).filter(([, v]) => v) as [string, string][])}`;
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">Discover</h1>
      <p className="muted mt-0.5 mb-4">Furnished homes by the night — booked and paid with Mobile Money.</p>
      <DiscoverTabs active="stays" />
      <form className="card mt-4 space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label><span className="label">Check-in</span><input type="date" name="checkIn" min={today} defaultValue={sp.checkIn} className="input" /></label>
          <label><span className="label">Check-out</span><input type="date" name="checkOut" min={today} defaultValue={sp.checkOut} className="input" /></label>
          <label><span className="label">Guests</span><input type="number" name="guests" min={1} max={30} defaultValue={guests} className="input" /></label>
          <div className="flex items-end"><button className="btn-primary w-full">Search</button></div>
        </div>
        <details open={area.length > 1}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-900"><MapPin className="mr-1 inline h-4 w-4" />Area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <div className="mt-2"><LocationPicker name="in" initial={area} label="" compact /></div>
        </details>
      </form>
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="h2">{dated ? `Available ${sp.checkIn} → ${sp.checkOut} (${n} night${n === 1 ? "" : "s"})` : "All short stays"}</h2>
        <span className="text-xs text-stone-500">{rows.length} home{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ u }) => <StayCard key={u.id} u={u} href={q(u.id)} total={dated ? u.nightlyRate! * n + u.cleaningFee : undefined} />)}
      </div>
      {rows.length === 0 && <Empty title={dated ? "Nothing free for those dates" : "No short stays listed yet"}>{dated ? "Try other dates or a wider area." : "Landlords can switch a furnished unit to short stays from its details."}</Empty>}
    </main>
  );
}
