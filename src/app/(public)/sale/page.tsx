import Link from "next/link";
import { AlertButton } from "@/components/AlertButton";
import type { Prisma } from "@prisma/client";
import { ArrowDownUp, Check, FileCheck2, MapPin, MessageCircle, Search, ShieldCheck, X } from "lucide-react";
import { db } from "@/db";
import { DiscoverTabs } from "@/components/DiscoverTabs";
import { SaleCard } from "@/components/SaleCard";
import { LocationPicker } from "@/components/LocationPicker";
import { SearchBand } from "@/components/ListingParts";
import { crumbText, insideFilter, trailFor } from "@/lib/geo";
import { KIND, PRICE_STEPS, SALE_KINDS, shortUgx } from "@/lib/sales";

export const dynamic = "force-dynamic";
export const metadata = { title: "Land & property for sale" };

const sorts = [["", "Newest"], ["low", "Lowest price"], ["high", "Highest price"]] as const;

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
  const [rows, counts] = await Promise.all([
    db.saleListing.findMany({ where, orderBy, take: 60, include: { _count: { select: { photos: true } } } }),
    db.saleListing.groupBy({ by: ["kind"], _count: true, where: { status: { in: ["active", "under_offer"] } } }),
  ]);
  const keep = { kind, q, max: sp.max, in: sp.in, titled: sp.titled, sort: sp.sort };
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/sale${p.size ? `?${p}` : ""}`;
  };
  const total = counts.reduce((s, c) => s + c._count, 0);
  const sortLabel = sorts.find(([k]) => k === (sp.sort ?? ""))?.[1] ?? "Newest";
  const active: [string, string][] = [
    ...(q ? [[`“${q}”`, href({ q: undefined })] as [string, string]] : []),
    ...(area.length > 1 ? [[area[area.length - 1].name, href({ in: undefined })] as [string, string]] : []),
    ...(max ? [[`Up to ${shortUgx(max)}`, href({ max: undefined })] as [string, string]] : []),
    ...(sp.titled ? [["With land title", href({ titled: undefined })] as [string, string]] : []),
  ];
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm looking to buy ${kind ? KIND[kind as keyof typeof KIND].label.toLowerCase() : "land or property"}${q ? ` in ${q}` : ""}${max ? ` up to ${shortUgx(max)}` : ""}.`)}`;

  return (
    <main>
      <SearchBand title="Land & property for sale" text="Plots, farms, homes and buildings, reviewed by CasaVilla before they appear.">
        <form className="flex gap-2 rounded-2xl bg-white p-1.5 shadow-float">
          {Object.entries(keep).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <Search className="ml-2.5 h-5 w-5 shrink-0 self-center text-stone-400" />
          <input name="q" defaultValue={q} className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-base text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder="A place, e.g. Kira, Mukono, Entebbe" enterKeyHint="search" />
          <button className="btn-primary shrink-0 px-4 py-2">Search</button>
        </form>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/80">
          <li className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-gold-300" /> Every listing reviewed</li>
          <li className="flex items-center gap-1.5"><FileCheck2 className="h-3.5 w-3.5 text-gold-300" /> Land titles checked on request</li>
        </ul>
      </SearchBand>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <DiscoverTabs active="sale" />

        {/* What kind */}
        <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Link href={href({ kind: undefined })} className={!kind ? "chip-active" : "chip"}>All <span className="opacity-60">{total}</span></Link>
          {SALE_KINDS.map((k) => {
            const n = counts.find((c) => c.kind === k)?._count ?? 0;
            return <Link key={k} href={href({ kind: kind === k ? undefined : k })} className={kind === k ? "chip-active" : "chip"}>{KIND[k].plural}{n ? <span className="opacity-60">{n}</span> : null}</Link>;
          })}
          <span className="mx-1 h-5 w-px shrink-0 bg-stone-200" />
          <Link href={href({ titled: sp.titled ? undefined : "1" })} className={sp.titled ? "chip-active" : "chip"}>{sp.titled && <Check className="h-3.5 w-3.5" />}With land title</Link>
        </div>
        {/* Budget */}
        <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <span className="shrink-0 text-xs font-semibold text-stone-500">Budget</span>
          {PRICE_STEPS.map((b) => (
            <Link key={b} href={href({ max: sp.max === String(b) ? undefined : String(b) })} className={sp.max === String(b) ? "chip-active" : "chip"}>Up to {shortUgx(b).replace("UGX ", "")}</Link>
          ))}
        </div>
        <details className="mt-3 rounded-2xl border border-stone-200 bg-white p-3" open={area.length > 1}>
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-brand-900"><MapPin className="h-4 w-4" /> Choose an area{area.length > 1 && <span className="font-normal text-stone-500"> · {crumbText(area, true)}</span>}</summary>
          <form className="mt-3">
            {Object.entries(keep).filter(([k, v]) => k !== "in" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <LocationPicker name="in" initial={area} label="" compact />
            <button className="btn-primary btn-sm mt-3 w-full">Show listings in this area</button>
          </form>
        </details>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-brand-950">{kind ? KIND[kind as keyof typeof KIND].plural : "Everything for sale"}{area.length > 1 ? ` in ${area[area.length - 1].name}` : ""}</h2>
            <p className="text-xs text-stone-500">{rows.length} listing{rows.length === 1 ? "" : "s"}</p>
          </div>
          <div className="flex items-center gap-2"><AlertButton kind="sale" params={{ q, in: sp.in, kind, max: sp.max, titled: sp.titled }} next={href({})} /><details className="relative">
            <summary className="chip cursor-pointer list-none"><ArrowDownUp className="h-3.5 w-3.5" /> {sortLabel}</summary>
            <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-float">
              {sorts.map(([k, label]) => (
                <Link key={label} href={href({ sort: k || undefined })} className={`flex items-center justify-between px-3 py-2 text-sm hover:bg-stone-50 ${label === sortLabel ? "font-semibold text-brand-800" : "text-stone-700"}`}>{label}{label === sortLabel && <Check className="h-4 w-4" />}</Link>
              ))}
            </div>
          </details></div>
        </div>
        {active.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {active.map(([label, h]) => <Link key={label} href={h} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 hover:bg-brand-100">{label} <X className="h-3 w-3" /></Link>)}
            <Link href={kind ? `/sale?kind=${kind}` : "/sale"} className="text-xs font-semibold text-stone-500 hover:underline">Clear all</Link>
          </div>
        )}

        {rows.length > 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((l) => <SaleCard key={l.id} l={l} />)}
          </div>
        ) : (
          <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><Search className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">Nothing for sale matches yet</div>
            <p className="mt-1 text-sm text-stone-500">Try another area, a higher budget, or a different kind of property.</p>
            {(active.length > 0 || kind) && <Link href="/sale" className="btn-outline btn-sm mt-4">Clear filters</Link>}
          </div>
        )}

        <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Looking for something specific, or selling?</div>
            <p className="text-sm text-white/70">Tell us what you want to buy, or list your land and property with CasaVilla.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a href={wa} className="btn-gold"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
            <Link href="/list" className="btn border border-white/25 text-white hover:bg-white/10">Sell with us</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
