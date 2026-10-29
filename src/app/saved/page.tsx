import Link from "next/link";
import { BellRing, Heart, Search, Trash2 } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { unitsAsListings } from "@/lib/queries";
import { alertHref, savedIds, type AlertKind, type AlertParams } from "@/lib/saved";
import { deleteAlert } from "@/app/saved-actions";
import { PortalShell } from "@/components/PortalShell";
import { PageHeader } from "@/components/ui";
import { PropertyCard, StayCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";
import { ConfirmSubmit } from "@/components/client";
import { pushPublicKey } from "@/lib/push";
import { PushToggle } from "@/components/PushToggle";

export const metadata = { title: "Saved" };

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser();
  const tab = (await searchParams).tab === "alerts" ? "alerts" : "homes";
  const ids = await savedIds(u.id);
  const [homes, stays, sales, alerts] = await Promise.all([
    unitsAsListings([...ids.rent].reverse()),
    ids.stay.length ? db.unit.findMany({ where: { id: { in: ids.stay }, mode: "short" }, include: { property: { include: { _count: { select: { photos: true } } } } } }) : [],
    ids.sale.length ? db.saleListing.findMany({ where: { id: { in: ids.sale } }, include: { _count: { select: { photos: true } } } }) : [],
    db.searchAlert.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const count = homes.length + stays.length + sales.length;
  const gone = (on: boolean) => (on ? null : <span className="pill absolute bottom-3 left-3 z-10 bg-stone-900/80 text-white">No longer available</span>);

  return (
    <PortalShell user={u}>
      <div className="mx-auto max-w-5xl">
        <PageHeader title="Saved" subtitle="Homes you've hearted and searches you're watching." />
        <nav className="mb-5 flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold">
          {([["homes", `Saved homes${count ? ` (${count})` : ""}`, Heart], ["alerts", `Alerts${alerts.length ? ` (${alerts.length})` : ""}`, BellRing]] as const).map(([k, label, I]) => (
            <Link key={k} href={k === "homes" ? "/saved" : "/saved?tab=alerts"} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${tab === k ? "bg-white text-brand-900 shadow-card" : "text-stone-500 hover:text-stone-800"}`}><I className="h-4 w-4" /> {label}</Link>
          ))}
        </nav>

        {tab === "homes" && (count === 0 ? (
          <div className="rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-maroon-50 text-maroon-500"><Heart className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">Nothing saved yet</div>
            <p className="mt-1 text-sm text-stone-500">Tap the heart on any home to keep it here and compare later.</p>
            <Link href="/listings" className="btn-primary btn-sm mt-4"><Search className="h-4 w-4" /> Browse homes</Link>
          </div>
        ) : (
          <div className="space-y-8">
            {homes.length > 0 && <section><h2 className="h2 mb-3">Homes to rent</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{homes.map((h) => <div key={h.id} className="relative">{gone(h.available)}<PropertyCard h={h} /></div>)}</div></section>}
            {stays.length > 0 && <section><h2 className="h2 mb-3">Short stays</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{stays.map((s) => <div key={s.id} className="relative">{gone(s.listed && !s.property.archivedAt)}<StayCard u={s} /></div>)}</div></section>}
            {sales.length > 0 && <section><h2 className="h2 mb-3">For sale</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{sales.map((l) => <div key={l.id} className="relative">{gone(["active", "under_offer"].includes(l.status))}<SaleCard l={l} /></div>)}</div></section>}
          </div>
        ))}

        {tab === "alerts" && (
          <div className="space-y-4">
            <div className="card p-4 empty:hidden"><PushToggle publicKey={pushPublicKey()} text="Turn on phone notifications to hear about new matches the moment they're listed." /></div>
            {alerts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><BellRing className="h-6 w-6" /></div>
                <div className="mt-3 font-semibold text-brand-950">No alerts yet</div>
                <p className="mt-1 text-sm text-stone-500">Search for homes, then tap <b>Alert me</b>. We&apos;ll tell you when something new matches.</p>
                <Link href="/listings" className="btn-primary btn-sm mt-4"><Search className="h-4 w-4" /> Start a search</Link>
              </div>
            ) : (
              <div className="card divide-y divide-stone-100 p-0">
                {alerts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><BellRing className="h-[18px] w-[18px]" /></span>
                    <Link href={alertHref(a.kind as AlertKind, a.params as AlertParams)} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-stone-800">{a.label}</div>
                      <div className="text-xs text-stone-500">Since {fmtDate(a.createdAt)} · tap to see matches</div>
                    </Link>
                    <form action={deleteAlert}><input type="hidden" name="id" value={a.id} /><ConfirmSubmit message="Stop this alert?" className="rounded-full p-2 text-stone-400 hover:bg-stone-100 hover:text-maroon-600"><Trash2 className="h-4 w-4" /></ConfirmSubmit></form>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
