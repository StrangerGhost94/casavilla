import Link from "next/link";
import { CheckCircle2, Circle, MessageCircle, Plus } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { kampalaStart, kampalaToday, ugx } from "@/lib/format";
import { waLink } from "@/lib/social";
import { PageHeader, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { TodoList } from "@/components/Dashboard";
import { uploadAgentDocument } from "@/app/agent-actions";

export const metadata = { title: "Agent dashboard" };

export default async function AgentHome() {
  const u = await requireUser("agent");
  const monthStart = kampalaStart(kampalaToday().slice(0, 7));
  const soon = new Date(Date.now() + 30 * 86400000);
  const [byStatus, expiring, noMandate, props, unverified, bookings] = await Promise.all([
    db.saleListing.groupBy({ by: ["status"], where: { ownerId: u.id }, _count: true }),
    db.saleListing.count({ where: { ownerId: u.id, status: { in: ["active", "under_offer"] }, expiresAt: { lt: soon } } }),
    db.saleListing.count({ where: { ownerId: u.id, status: "pending", mandateFileId: null } }),
    db.property.count({ where: { landlordId: u.id, archivedAt: null } }),
    db.property.count({ where: { landlordId: u.id, archivedAt: null, verifiedAt: null } }),
    db.booking.aggregate({ where: { unit: { property: { landlordId: u.id } }, status: "confirmed", paidAt: { gte: monthStart } }, _count: true, _sum: { total: true } }),
  ]);
  const n = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
  const docs = [
    { kind: "id", title: "Your national ID (or company registration)", done: !!u.idFileId },
    { kind: "agreement", title: "The signed CasaVilla agent agreement (ask the office for it)", done: !!u.agreementFileId },
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* One main action, named by what's waiting: fix what was sent back, then renew, otherwise list something new. */}
      <PageHeader title={`Hello ${u.name.split(" ")[0]}`} subtitle="Your listings for sale and short stays. Buyers and guests deal with the CasaVilla office."
        actions={n("rejected") ? <Link href="/agent/sale" className="btn-primary btn-sm">Fix {n("rejected")} listing{n("rejected") === 1 ? "" : "s"}</Link>
          : expiring + n("expired") ? <Link href="/agent/sale" className="btn-primary btn-sm">Renew {expiring + n("expired")} listing{expiring + n("expired") === 1 ? "" : "s"}</Link>
          : <Link href="/agent/sale/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New listing for sale</Link>} />

      {u.status === "pending" && (
        <div className="card space-y-3">
          <div className="font-semibold text-brand-950">Get approved as a CasaVilla agent</div>
          {docs.map((d) => (
            <form key={d.kind} action={uploadAgentDocument} className="flex flex-wrap items-center gap-2 text-sm">
              {d.done ? <CheckCircle2 className="h-5 w-5 text-brand-700" /> : <Circle className="h-5 w-5 text-stone-300" />}
              <span className="mr-auto min-w-0">{d.title}</span>
              <input type="hidden" name="kind" value={d.kind} />
              <input type="file" name="file" accept="application/pdf,image/*" required className="input max-w-[14rem] py-1.5 text-xs" />
              <Submit className="btn-outline btn-sm">{d.done ? "Replace" : "Upload"}</Submit>
            </form>
          ))}
          <div className="flex items-center gap-2 text-sm text-stone-600"><Circle className="h-5 w-5 text-stone-300" /> CasaVilla calls you, agrees your commission and approves you.</div>
          <a href={waLink(`Hello CasaVilla, I'm ${u.name} and signed up as an agent. Please send me the agent agreement.`)} className="btn-outline btn-sm"><MessageCircle className="h-4 w-4" /> Ask the office for the agreement</a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/agent/sale" className="card"><div className="text-2xl font-bold text-brand-950">{n("active") + n("under_offer")}</div><div className="text-xs text-stone-500">Listings live</div></Link>
        <Link href="/agent/sale" className="card"><div className="text-2xl font-bold text-brand-950">{n("pending")}</div><div className="text-xs text-stone-500">Waiting for review</div></Link>
        <Link href="/agent/properties" className="card"><div className="text-2xl font-bold text-brand-950">{props}</div><div className="text-xs text-stone-500">Short-stay properties</div></Link>
        <Link href="/agent/bookings" className="card"><div className="text-2xl font-bold text-brand-950">{ugx(bookings._sum.total ?? 0)}</div><div className="text-xs text-stone-500">{bookings._count} booking{bookings._count === 1 ? "" : "s"} this month</div></Link>
      </div>

      <TodoList rows={[
        { href: "/agent/sale", count: n("rejected"), label: "Listings CasaVilla sent back for changes", tone: "red" },
        { href: "/agent/sale", count: noMandate, label: "Listings waiting for the owner's authority to sell", tone: "gold" },
        { href: "/agent/sale", count: expiring + n("expired"), label: "Listings expiring or expired — renew them", tone: "gold" },
        { href: "/agent/properties", count: unverified, label: "Properties waiting for CasaVilla to visit & verify", tone: "blue" },
      ]} />

      <SectionTitle title="Add" />
      <div className="flex flex-wrap gap-2">
        <Link href="/agent/sale/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Land or property for sale</Link>
        <Link href="/agent/properties/new" className="btn-outline btn-sm"><Plus className="h-4 w-4" /> Short-stay property</Link>
      </div>
      <p className="text-xs text-stone-500">Agents can&apos;t list monthly rentals; those are managed by the CasaVilla office for landlords.</p>
    </div>
  );
}
