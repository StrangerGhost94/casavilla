import { db } from "@/db";
import { kampalaToday, ugx } from "@/lib/format";
import { bookedNights } from "@/lib/stays";
import { blockStayDates } from "@/app/stay-actions";
import { PageHeader, SectionTitle, Empty, Stat } from "./ui";
import { BookingList } from "./BookingList";
import { StayCalendar } from "./StayCalendar";
import { Submit } from "./client";

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Host view: earnings, occupancy, each unit's calendar with date blocking, and all bookings. */
export async function HostStays({ landlordId }: { landlordId?: number }) {
  const today = kampalaToday();
  const units = await db.unit.findMany({ where: { mode: "short", ...(landlordId ? { property: { landlordId } } : {}) }, include: { property: { select: { name: true } } }, orderBy: { id: "asc" } });
  const ids = units.map((u) => u.id);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [earned, upcoming] = await Promise.all([
    db.booking.aggregate({ _sum: { total: true }, _count: true, where: { unitId: { in: ids }, status: { in: ["confirmed", "completed"] }, paidAt: { gte: new Date(`${monthStart}T00:00:00+03:00`) } } }),
    db.booking.count({ where: { unitId: { in: ids }, status: "confirmed", checkIn: { gte: new Date(`${today}T00:00:00Z`) } } }),
  ]);
  const cals = await Promise.all(units.map(async (u) => ({ u, booked: await bookedNights(u.id, today, addDays(today, 95)) })));
  const next30 = cals.reduce((s, c) => s + [...c.booked].filter((d) => d < addDays(today, 30)).length, 0);
  const occ = units.length ? Math.round((next30 / (units.length * 30)) * 100) : 0;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Short stays" subtitle="Nightly bookings, paid by Mobile Money. Switch a unit to short stays from its details on the property page." />
      {units.length === 0 ? <Empty title="No short-stay units yet">Open a property, edit a unit&apos;s details and choose “Short stays (Airbnb-style)”.</Empty> : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Earned this month" value={ugx(earned._sum.total ?? 0)} />
            <Stat label="Upcoming stays" value={upcoming} />
            <Stat label="Booked next 30 days" value={`${occ}%`} />
          </div>
          {cals.map(({ u, booked }) => (
            <div key={u.id} className="card mt-4 space-y-3">
              <div className="flex items-center justify-between"><div className="font-semibold text-brand-950">{u.property.name} · {u.label}</div><div className="text-sm text-stone-600">{ugx(u.nightlyRate ?? 0)}/night</div></div>
              <StayCalendar booked={booked} today={today} />
              <form action={blockStayDates} className="flex flex-wrap items-end gap-2 border-t border-stone-100 pt-3">
                <input type="hidden" name="unitId" value={u.id} />
                <label><span className="label">Close from</span><input type="date" name="from" min={today} className="input py-2" required /></label>
                <label><span className="label">to</span><input type="date" name="to" min={today} className="input py-2" required /></label>
                <input name="note" className="input w-40 flex-1 py-2" placeholder="Reason (e.g. repairs)" />
                <Submit className="btn-outline btn-sm">Block dates</Submit>
              </form>
            </div>
          ))}
          <SectionTitle title="Bookings" />
          <BookingList where={{ unitId: { in: ids } }} empty="No bookings yet" showGuest />
        </>
      )}
    </div>
  );
}
