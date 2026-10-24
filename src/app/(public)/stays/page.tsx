import Link from "next/link";
import { ArrowDownUp, CalendarDays, Check, MapPin, MessageCircle, Moon, Search, Users } from "lucide-react";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { crumbText, insideFilter, trailFor } from "@/lib/geo";
import { isFree, nightsBetween, checkStay } from "@/lib/stays";
import { StayCard } from "@/components/PropertyCard";
import { LocationPicker } from "@/components/LocationPicker";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { SearchBand } from "@/components/ListingParts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short stays" };

const nightly = [100000, 150000, 250000, 400000];
const sorts = [["", "Lowest price"], ["high", "Highest price"], ["new", "Newest"]] as const;
const day = (d: string) => fmtDate(new Date(`${d}T12:00:00Z`));

export default async function Stays({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const today = kampalaToday();
  const guests = Math.max(1, Number(sp.guests) || 1);
  const dated = !!(sp.checkIn && sp.checkOut);
  const area = await trailFor(sp.in);
  const inside = area.length > 1 ? await insideFilter(sp.in) : null;
  const max = Number(sp.max) || undefined;
  const units = await db.unit.findMany({
    where: {
      mode: "short", listed: true, nightlyRate: max ? { not: null, lte: max } : { not: null }, maxGuests: { gte: guests },
      property: { archivedAt: null, landlord: { status: "active" }, ...(inside ? { place: inside } : {}) },
    },
    include: { property: { include: { _count: { select: { photos: true } } } } },
    orderBy: sp.sort === "high" ? { nightlyRate: "desc" } : sp.sort === "new" ? { id: "desc" } : { nightlyRate: "asc" }, take: 100,
  });
  const n = dated ? nightsBetween(sp.checkIn!, sp.checkOut!) : 0;
  const rows = (await Promise.all(units.map(async (u) => {
    if (!dated) return { u, ok: true };
    if (checkStay(u, sp.checkIn!, sp.checkOut!, guests)) return { u, ok: false };
    return { u, ok: await isFree(u.id, sp.checkIn!, sp.checkOut!) };
  }))).filter((r) => r.ok);
  const keep = { checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests, in: sp.in, max: sp.max, sort: sp.sort };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/stays${p.size ? `?${p}` : ""}`;
  };
  const q = (id: number) => `/stays/${id}?${new URLSearchParams(Object.entries({ checkIn: sp.checkIn, checkOut: sp.checkOut, guests: sp.guests }).filter(([, v]) => v) as [string, string][])}`;
  const sortLabel = sorts.find(([k]) => k === (sp.sort ?? ""))?.[1] ?? "Lowest price";
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm looking for a short stay${dated ? ` from ${sp.checkIn} to ${sp.checkOut}` : ""} for ${guests} guest${guests === 1 ? "" : "s"}.`)}`;

  return (
    <main>
      <SearchBand title="Short stays" text="Furnished homes by the night, booked and paid with Mobile Money.">
        <form className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 text-stone-800 shadow-float sm:grid-cols-[1fr_1fr_8rem_auto]">
          {sp.in && <input type="hidden" name="in" value={sp.in} />}
          {sp.max && <input type="hidden" name="max" value={sp.max} />}
          <label className="rounded-xl px-3 py-1.5 hover:bg-stone-50"><span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500"><CalendarDays className="h-3.5 w-3.5" /> Check-in</span>
            <input type="date" name="checkIn" min={today} defaultValue={sp.checkIn} className="w-full bg-transparent text-sm font-semibold focus:outline-none" /></label>
          <label className="rounded-xl px-3 py-1.5 hover:bg-stone-50"><span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500"><CalendarDays className="h-3.5 w-3.5" /> Check-out</span>
            <input type="date" name="checkOut" min={today} defaultValue={sp.checkOut} className="w-full bg-transparent text-sm font-semibold focus:outline-none" /></label>
          <label className="rounded-xl px-3 py-1.5 hover:bg-stone-50"><span className="flex items-center gap-1 text-[11px] font-semibold text-stone-500"><Users className="h-3.5 w-3.5" /> Guests</span>
            <input type="number" name="guests" min={1} max={30} defaultValue={guests} className="w-full bg-transparent text-sm font-semibold focus:outline-none" /></label>
          <button className="btn-primary"><Search className="h-4 w-4" /> Search</button>
        </form>
      </SearchBand>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <DiscoverTabs active="stays" />

        <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <span className="shrink-0 text-xs font-semibold text-stone-500">Per night</span>
          {nightly.map((b) => (
            <Link key={b} href={href({ max: sp.max === String(b) ? undefined : String(b) })} className={sp.max === String(b) ? "chip-active" : "chip"}>Under {b / 1000}k</Link>
          ))}
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          {[2, 4, 6].map((g) => (
            <Link key={g} href={href({ guests: guests === g ? undefined : String(g) })} className={guests === g ? "chip-active" : "chip"}><Users className="h-3.5 w-3.5" /> {g}+ guests</Link>
          ))}
        </div>
        <details className="mt-3 rounded-2xl border border-stone-200 bg-white p-3" open={area.length > 1}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Choose an area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <form className="mt-3">
            {Object.entries(keep).filter(([k, v]) => k !== "in" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <LocationPicker name="in" initial={area} label="" compact />
            <button className="btn-primary btn-sm mt-3 w-full">Show stays in this area</button>
          </form>
        </details>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-950">{dated ? `Free ${day(sp.checkIn!)} – ${day(sp.checkOut!)}` : area.length > 1 ? `Stays in ${area[area.length - 1].name}` : "All short stays"}</h2>
            <p className="flex items-center gap-1 text-xs text-stone-500">{rows.length} place{rows.length === 1 ? "" : "s"}{dated && <> · <Moon className="h-3 w-3" /> {n} night{n === 1 ? "" : "s"}, prices include cleaning</>}</p>
          </div>
          <details className="relative">
            <summary className="chip cursor-pointer list-none"><ArrowDownUp className="h-3.5 w-3.5" /> {sortLabel}</summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-float">
              {sorts.map(([k, label]) => (
                <Link key={label} href={href({ sort: k || undefined })} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 ${label === sortLabel ? "font-semibold text-brand-800" : "text-stone-700"}`}>{label}{label === sortLabel && <Check className="h-4 w-4" />}</Link>
              ))}
            </div>
          </details>
        </div>

        {rows.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(({ u }) => <StayCard key={u.id} u={u} href={q(u.id)} total={dated ? u.nightlyRate! * n + u.cleaningFee : undefined} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><CalendarDays className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">{dated ? "Nothing free for those dates" : "No short stays match"}</div>
            <p className="mt-1 text-sm text-stone-500">{dated ? "Try other dates, fewer guests or a wider area." : "Try a higher budget or a wider area."}</p>
            <Link href="/stays" className="btn-outline btn-sm mt-4">Clear search</Link>
          </div>
        )}

        <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Planning a longer visit or a group trip?</div>
            <p className="text-sm text-white/70">Tell us your dates. We&apos;ll find the right place.</p>
          </div>
          <a href={wa} className="btn-gold shrink-0"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
        </div>
      </div>
    </main>
  );
}
