import Link from "next/link";
import { BedDouble, ChevronRight, KeyRound, Trees, Wrench } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { insideFilter } from "@/lib/geo";
import { activeProviders } from "@/lib/queries";

/**
 * Ties a detail page to the rest of CasaVilla: what else is in the same area — homes to rent, short stays,
 * land and property for sale, and service providers who work there. Rows with nothing in them are left out.
 */
export async function AroundHere({ area, skip }: { area?: { id: string; name: string }; skip?: "rent" | "stays" | "sale" }) {
  if (!area) return null;
  const place = await insideFilter(area.id);
  if (!place) return null;
  const live: Prisma.PropertyWhereInput = { archivedAt: null, landlord: { status: "active" }, place };
  const [rent, stays, sale, pros] = await Promise.all([
    db.unit.count({ where: { mode: "long", listed: true, status: "vacant", property: live } }),
    db.unit.count({ where: { mode: "short", listed: true, nightlyRate: { not: null }, property: live } }),
    db.saleListing.count({ where: { status: { in: ["active", "under_offer"] }, place } }),
    activeProviders(undefined, area.id).then((r) => r.length),
  ]);
  const rows = [
    { key: "rent", n: rent, icon: KeyRound, label: "Homes to rent", href: `/listings?in=${area.id}` },
    { key: "stays", n: stays, icon: BedDouble, label: "Short stays", href: `/stays?in=${area.id}` },
    { key: "sale", n: sale, icon: Trees, label: "Land & property for sale", href: `/sale?in=${area.id}` },
    { key: "pros", n: pros, icon: Wrench, label: "Service providers who work here", href: `/services?in=${area.id}` },
  ].filter((r) => r.key !== skip && r.n > 0);
  if (!rows.length) return null;
  return (
    <section className="mt-6">
      <h2 className="h2">Around {area.name}</h2>
      <div className="card mt-2 divide-y divide-stone-100 p-0">
        {rows.map((r) => (
          <Link key={r.key} href={r.href} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><r.icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 text-sm font-medium text-stone-800">{r.label}</span>
            <span className="text-xs font-semibold text-stone-500">{r.n}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** What a tenant gets once they move in — shown on rental listings so the app reads as more than a search. */
export function LivingHere() {
  const items = [
    ["Pay rent on Mobile Money", "MTN or Airtel, with receipts kept in the app"],
    ["Move-in inspection", "Room-by-room report with photos, agreed by both sides"],
    ["Repairs in a tap", "Report it; the landlord sends a vetted provider"],
  ];
  return (
    <section className="mt-6">
      <h2 className="h2">Living here with CasaVilla</h2>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {items.map(([t, b]) => (
          <li key={t} className="rounded-2xl border border-stone-200/70 bg-white p-3">
            <div className="text-sm font-semibold text-brand-950">{t}</div>
            <div className="mt-0.5 text-xs text-stone-500">{b}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
