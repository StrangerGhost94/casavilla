import Link from "next/link";
import { CalendarCheck, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/ui";
import { ViewingRow, viewingsFor } from "@/components/Viewings";

export const metadata = { title: "Viewings" };

export default async function ViewingsPage() {
  const u = await requireUser();
  const now = new Date(), weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const canHost = ["landlord", "manager"].includes(u.role);
  const [hosting, mine] = await Promise.all([
    canHost ? viewingsFor({ ...(u.role === "manager" ? {} : { hostId: u.id }), at: { gte: weekAgo } }) : [],
    viewingsFor({ requesterId: u.id, at: { gte: weekAgo } }),
  ]);
  const upcoming = (rows: typeof mine) => rows.filter((v) => v.at >= now && ["requested", "proposed", "confirmed"].includes(v.status));
  const past = (rows: typeof mine) => rows.filter((v) => !(v.at >= now && ["requested", "proposed", "confirmed"].includes(v.status)));
  const Section = ({ title, rows, as, empty }: { title: string; rows: typeof mine; as: "host" | "requester"; empty: React.ReactNode }) => (
    <section className="mb-8">
      <h2 className="h2 mb-2">{title}</h2>
      {upcoming(rows).length ? <div className="card divide-y divide-stone-100 p-0">{upcoming(rows).map((v) => <ViewingRow key={v.id} v={v} as={as} />)}</div>
        : <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-500">{empty}</div>}
      {past(rows).length > 0 && (
        <details className="card mt-3 p-0">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-stone-600">Past and closed ({past(rows).length})</summary>
          <div className="divide-y divide-stone-100 border-t border-stone-100">{past(rows).map((v) => <ViewingRow key={v.id} v={v} as={as} />)}</div>
        </details>
      )}
    </section>
  );
  return (
    <PortalShell user={u}>
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Viewings" subtitle="Times booked to see homes. You'll get a reminder the day before and on the day." />
        {canHost && <Section title={u.role === "manager" ? "All viewing requests" : "Requests to view your homes"} rows={hosting} as="host" empty="No viewing requests yet. They appear here when someone books a time on your listing." />}
        <Section title={canHost ? "Homes you're viewing" : "Your viewings"} rows={mine} as="requester"
          empty={<><CalendarCheck className="mx-auto mb-2 h-6 w-6 text-brand-700" />No viewings booked. Open a home and choose a day under <b>Book a viewing</b>.<br /><Link href="/listings" className="btn-primary btn-sm mt-3"><Search className="h-4 w-4" /> Browse homes</Link></>} />
      </div>
    </PortalShell>
  );
}
