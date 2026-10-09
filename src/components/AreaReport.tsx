import Link from "next/link";
import { ChevronRight, MapPinOff } from "lucide-react";
import { db } from "@/db";
import { insideFilter, pathIds, trailFor, crumbText } from "@/lib/geo";
import { kampalaToday, ugx } from "@/lib/format";
import { Empty } from "./ui";

export const AREA_LEVELS = [
  { id: "region", label: "Region", depth: 1 },
  { id: "district", label: "District / city", depth: 2 },
  { id: "county", label: "County / municipality", depth: 3 },
  { id: "subcounty", label: "Sub-county / division", depth: 4 },
  { id: "parish", label: "Parish / ward", depth: 5 },
] as const;
export type AreaLevel = (typeof AREA_LEVELS)[number]["id"];

type Row = { id: string | null; name: string; properties: number; units: number; occupied: number; rentRoll: number; arrears: number; openJobs: number; pinned: number };

/**
 * Portfolio figures grouped by an administrative level, all derived from each property's canonical location
 * (never from address text). `inId` narrows to one area and everything inside it.
 */
export async function areaFigures(o: { landlordId?: number; by: AreaLevel; inId?: string | null }) {
  const today = new Date(`${kampalaToday()}T00:00:00Z`);
  const inside = await insideFilter(o.inId);
  const props = await db.property.findMany({
    where: { ...(o.landlordId ? { landlordId: o.landlordId } : {}), ...(inside ? { place: inside } : {}) },
    select: {
      id: true, lat: true, place: { select: { path: true } },
      units: { select: { status: true, leases: { where: { status: "active" }, select: { rent: true, charges: { where: { status: { not: "paid" }, dueDate: { lt: today } }, select: { amount: true, paid: true } } } } } },
      _count: { select: { jobs: { where: { status: { notIn: ["done", "cancelled"] } } } } },
    },
  });
  const depth = AREA_LEVELS.find((l) => l.id === o.by)!.depth;
  const rows = new Map<string, Row>();
  for (const p of props) {
    const ids = p.place ? pathIds(p.place.path) : [];
    const key = ids[depth] ?? (ids.length ? `${ids[ids.length - 1]}*` : "none");
    const r = rows.get(key) ?? { id: key === "none" ? null : key, name: "", properties: 0, units: 0, occupied: 0, rentRoll: 0, arrears: 0, openJobs: 0, pinned: 0 };
    r.properties++; r.openJobs += p._count.jobs; if (p.lat != null) r.pinned++;
    for (const u of p.units) {
      r.units++;
      if (u.status === "occupied") r.occupied++;
      for (const l of u.leases) { r.rentRoll += l.rent; r.arrears += l.charges.reduce((s, c) => s + c.amount - c.paid, 0); }
    }
    rows.set(key, r);
  }
  // Names: "*" marks properties placed only at a broader level than the one being grouped by.
  const ids = [...rows.keys()].filter((k) => k !== "none").map((k) => k.replace("*", ""));
  const names = new Map((await db.location.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((l) => [l.id, l.name]));
  for (const [k, r] of rows) {
    r.name = k === "none" ? "Not yet located" : k.endsWith("*") ? `${names.get(k.slice(0, -1))} (exact ${o.by} not set)` : names.get(k) ?? k;
    if (k.endsWith("*")) r.id = null;
  }
  return [...rows.values()].sort((a, b) => (a.id === null ? 1 : 0) - (b.id === null ? 1 : 0) || b.rentRoll - a.rentRoll || a.name.localeCompare(b.name));
}

export async function AreaReport({ landlordId, by, inId, base, limit }: { landlordId?: number; by: AreaLevel; inId?: string | null; base: string; limit?: number }) {
  const rows = await areaFigures({ landlordId, by, inId });
  const scope = await trailFor(inId);
  if (!rows.length) return <Empty title="No properties here yet" />;
  const shown = limit ? rows.slice(0, limit) : rows;
  const nextLevel = AREA_LEVELS[AREA_LEVELS.findIndex((l) => l.id === by) + 1]?.id;
  return (
    <div className="space-y-2">
      {scope.length > 1 && <div className="text-xs text-stone-500">Inside <b className="text-brand-900">{crumbText(scope, true)}</b></div>}
      <div className="card divide-y divide-stone-100 p-0">
        {shown.map((r) => {
          const occ = r.units ? Math.round((r.occupied / r.units) * 100) : 0;
          const body = (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 truncate text-sm font-semibold text-stone-800">{r.id === null && r.name === "Not yet located" && <MapPinOff className="h-3.5 w-3.5 text-gold-600" />}{r.name}</div>
                <div className="text-xs text-stone-500">{r.properties} propert{r.properties === 1 ? "y" : "ies"} · {r.units} unit{r.units === 1 ? "" : "s"} · {occ}% occupied{r.openJobs ? ` · ${r.openJobs} open repair${r.openJobs > 1 ? "s" : ""}` : ""}</div>
                <div className="mt-1 h-1.5 rounded bg-stone-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${occ}%` }} /></div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-brand-950">{ugx(r.rentRoll)}<span className="text-[10px] font-normal text-stone-400">/mo</span></div>
                <div className={`text-[11px] ${r.arrears ? "font-semibold text-maroon-600" : "text-stone-400"}`}>{r.arrears ? `${ugx(r.arrears)} overdue` : "No arrears"}</div>
              </div>
            </>
          );
          return r.id && nextLevel
            ? <Link key={r.name} href={`${base}?by=${nextLevel}&in=${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">{body}<ChevronRight className="h-4 w-4 shrink-0 text-stone-400" /></Link>
            : r.name === "Not yet located"
              ? <Link key={r.name} href={base.replace("/areas", "/properties")} className="flex items-center gap-3 bg-gold-50/40 px-4 py-3 hover:bg-gold-50">{body}<ChevronRight className="h-4 w-4 shrink-0 text-stone-400" /></Link>
              : <div key={r.name} className="flex items-center gap-3 px-4 py-3">{body}</div>;
        })}
      </div>
    </div>
  );
}
