import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { Badge, PageHeader } from "@/components/ui";

export const metadata = { title: "Bookings" };

/** Bookings on the agent's short-stay units. Guests deal with CasaVilla, so only their first name is shown. */
export default async function AgentBookings() {
  const u = await requireUser("agent");
  const today = new Date(new Date().toISOString().slice(0, 10));
  const rows = await db.booking.findMany({
    where: { unit: { property: { landlordId: u.id } }, status: { in: ["confirmed", "blocked", "cancelled"] } },
    orderBy: { checkIn: "desc" }, take: 200,
    include: { guest: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } },
  });
  const upcoming = rows.filter((b) => b.checkOut >= today).reverse();
  const past = rows.filter((b) => b.checkOut < today);
  const List = ({ list, empty }: { list: typeof rows; empty: string }) => (
    <div className="card divide-y divide-stone-100 p-0 text-sm">
      {list.length === 0 && <div className="muted p-4">{empty}</div>}
      {list.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="block font-medium text-stone-800">{b.unit.property.name} · {b.unit.label}</span>
            <span className="block text-xs text-stone-500">{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.nights} night{b.nights === 1 ? "" : "s"}{b.status === "blocked" ? " · blocked by you" : ` · ${b.guests} guest${b.guests === 1 ? "" : "s"} · ${b.guest.name.split(" ")[0]}`}</span>
          </span>
          <span className="shrink-0 text-right">{b.status !== "blocked" && <b className="block">{ugx(b.total)}</b>}<Badge color={b.status === "confirmed" ? "green" : "gray"}>{b.status}</Badge></span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Bookings" subtitle="Guests pay CasaVilla when they book. Your share is on your monthly statement." />
      <h2 className="h2">Upcoming</h2>
      <List list={upcoming} empty="No upcoming bookings." />
      <h2 className="h2">Past</h2>
      <List list={past} empty="No past bookings yet." />
    </div>
  );
}
