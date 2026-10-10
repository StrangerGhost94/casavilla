import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MapPin, Search, SlidersHorizontal } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { SaleCard } from "@/components/SaleCard";
import { LocationPicker } from "@/components/LocationPicker";
import { crumbText, insideFilter, trailFor } from "@/lib/geo";
import { KIND, PRICE_STEPS, SALE_KINDS, shortUgx } from "@/lib/sales";

export const dynamic = "force-dynamic";
export const metadata = { title: "Land & property for sale" };

export default async function ForSale({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const kind = (SALE_KINDS as readonly string[]).includes(sp.kind ?? "") ? sp.kind : undefined;
  const area = await trailFor(sp.in);
  const inside = area.length > 1 ? await insideFilter(sp.in) : null;
  const max = Number(sp.max) || undefined;
  const q = sp.q?.trim();
  const where: Prisma.SaleListingWhereInput = {
    status: { in: ["active", "under_offer"] },
    ...(kind ? { kind } : {}),
    ...(max ? { price: { lte: max } } : {}),
    ...(sp.titled ? { titleStatus: "titled" } : {}),
    ...(inside ? { place: inside } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { location: { contains: q, mode: "insensitive" } }, { estate: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const orderBy: Prisma.SaleListingOrderByWithRelationInput[] =
    sp.sort === "low" ? [{ price: "asc" }] : sp.sort === "high" ? [{ price: "desc" }] : [{ status: "asc" }, { publishedAt: "desc" }];
  const rows = await db.saleListing.findMany({ where, orderBy, take: 60 });
  const counts = await db.saleListing.groupBy({ by: ["kind"], _count: true, where: { status: { in: ["active", "under_offer"] } } });
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ kind, q, max: sp.max, in: sp.in, titled: sp.titled, sort: sp.sort, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/sale${p.size ? `?${p}` : ""}`;
  };
  const total = counts.reduce((s, c) => s + c._count, 0);
  const me = await getUser();
  const listHref = me && (me.role === "landlord" || me.role === "manager") ? `/${me.role}/sale/new` : "/register?role=landlord&next=/landlord/sale/new";
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">Discover</h1>
      <p className="muted mb-4 mt-0.5">Land, homes and buildings for sale — reviewed by CasaVilla before they appear.</p>
      <DiscoverTabs active="sale" />

      <form className="mt-4 space-y-3">
        {kind && <input type="hidden" name="kind" value={kind} />}
        {sp.titled && <input type="hidden" name="titled" value="1" />}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
          <input name="q" defaultValue={q} className="input pl-11 pr-24" placeholder="Search a place, e.g. Kira, Mukono, Entebbe" />
          <button className="btn-primary btn-sm absolute right-1.5 top-1/2 -translate-y-1/2 py-2">Search</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-stone-400" />
          <select name="max" defaultValue={sp.max ?? ""} className="input w-auto py-2">
            <option value="">Any price</option>
            {PRICE_STEPS.map((b) => <option key={b} value={b}>Up to {shortUgx(b)}</option>)}
          </select>
          <select name="sort" defaultValue={sp.sort ?? ""} className="input w-auto py-2">
            <option value="">Newest</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option>
          </select>
          <button className="chip">Apply</button>
        </div>
        <details className="rounded-2xl border border-stone-200 bg-white p-3" open={area.length > 1}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Filter by area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <div className="mt-3"><LocationPicker name="in" initial={area} label="" compact /></div>
          <button className="btn-primary btn-sm mt-3 w-full">Show listings in this area</button>
        </details>
      </form>

      <div className="-mx-4 mt-3 flex items-start gap-2 overflow-x-auto px-4 pb-1">
        <Link href={href({ kind: undefined })} className={!kind ? "chip-active" : "chip"}>All ({total})</Link>
        {SALE_KINDS.map((k) => {
          const n = counts.find((c) => c.kind === k)?._count ?? 0;
          return <Link key={k} href={href({ kind: k })} className={kind === k ? "chip-active" : "chip"}>{KIND[k].plural}{n ? ` (${n})` : ""}</Link>;
        })}
        <Link href={href({ titled: sp.titled ? undefined : "1" })} className={sp.titled ? "chip-active" : "chip"}>With land title</Link>
      </div>

      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="h2">{kind ? KIND[kind as keyof typeof KIND].plural : "Everything for sale"}{area.length > 1 ? ` in ${area[area.length - 1].name}` : q ? ` · “${q}”` : ""}</h2>
        <span className="text-xs text-stone-500">{rows.length} listing{rows.length === 1 ? "" : "s"}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {rows.map((l) => <SaleCard key={l.id} l={l} />)}
      </div>
      {!rows.length && <Empty title="Nothing for sale matches yet">Try another area or a higher budget.</Empty>}

      <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 bg-brand-950 text-white">
        <div>
          <div className="font-semibold">Selling land or a property?</div>
          <div className="text-sm text-white/70">List it with CasaVilla — we review every listing and can verify the title for buyers.</div>
        </div>
        <Link href={listHref} className="btn-gold">List a property</Link>
      </div>
    </main>
  );
}
