import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { DraftingCompass, X } from "lucide-react";
import { db } from "@/db";
import { PLAN_STYLES, PLAN_STYLE_KEYS, type PlanStyle } from "@/lib/build";
import { shortUgx } from "@/lib/sales";
import { SearchBand } from "@/components/ListingParts";
import { PlanCard } from "@/components/BuildCards";

export const dynamic = "force-dynamic";

type SP = { style?: string; beds?: string; max?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = !!(sp.style || sp.beds || sp.max);
  return {
    title: "House Plans in Uganda — Bungalows, Storeyed Houses & Apartments",
    description: "Ready-made house plans from CasaVilla with an estimated cost to build in Uganda: bungalows, storeyed houses, apartment blocks and commercial buildings. Buy the drawings or have CasaVilla build it.",
    alternates: { canonical: "/build/plans" },
    // One indexed page; filtered views point to it.
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

const BUDGETS = [80e6, 150e6, 250e6, 400e6, 700e6];

export default async function Plans({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const style = PLAN_STYLE_KEYS.includes(sp.style as PlanStyle) ? (sp.style as PlanStyle) : undefined;
  const beds = Number(sp.beds) || undefined;
  const max = Number(sp.max) || undefined;
  const where: Prisma.HousePlanWhereInput = {
    published: true,
    ...(style ? { style } : {}),
    ...(beds ? { bedrooms: beds >= 5 ? { gte: 5 } : beds } : {}),
    ...(max ? { OR: [{ buildFrom: { lte: max } }, { buildFrom: null }] } : {}),
  };
  const [plans, total] = await Promise.all([
    db.housePlan.findMany({ where, orderBy: [{ sort: "asc" }, { id: "desc" }], include: { _count: { select: { photos: true } } } }),
    db.housePlan.count({ where: { published: true } }),
  ]);
  const keep = { style, beds: beds ? String(beds) : undefined, max: max ? String(max) : undefined };
  const href = (patch: Partial<Record<keyof SP, string | undefined>>) => {
    const p = new URLSearchParams(Object.entries({ ...keep, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/build/plans${p.size ? `?${p}` : ""}`;
  };

  return (
    <main>
      <SearchBand title="House plans" text="Ready-made plans by CasaVilla, each with an estimated cost to build. Buy the drawings, adjust them, or have us build it.">
        <div className="flex flex-wrap gap-2">
          <Link href={href({ style: undefined })} className={!style ? "chip-active" : "chip border-white/20 bg-white/10 text-white"}>All types</Link>
          {PLAN_STYLE_KEYS.map((s) => <Link key={s} href={href({ style: style === s ? undefined : s })} className={style === s ? "chip-active" : "chip border-white/20 bg-white/10 text-white"}>{PLAN_STYLES[s].plural}</Link>)}
        </div>
      </SearchBand>

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-500">Bedrooms</span>
          {[2, 3, 4, 5].map((b) => <Link key={b} href={href({ beds: beds === b ? undefined : String(b) })} className={beds === b ? "chip-active" : "chip"}>{b}{b === 5 ? "+" : ""}</Link>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-stone-500">Build budget</span>
          {BUDGETS.map((b) => <Link key={b} href={href({ max: max === b ? undefined : String(b) })} className={max === b ? "chip-active" : "chip"}>Up to {shortUgx(b).replace("UGX ", "")}</Link>)}
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-950">{style ? PLAN_STYLES[style].plural : "All plans"} <span className="text-sm font-normal text-stone-500">· {plans.length} of {total}</span></h2>
          {(style || beds || max) && <Link href="/build/plans" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:underline"><X className="h-3 w-3" /> Clear filters</Link>}
        </div>

        {plans.length > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{plans.map((p) => <PlanCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="mt-3 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><DraftingCompass className="h-6 w-6" /></div>
            <div className="mt-3 font-semibold text-brand-950">{total ? "No plan matches yet" : "Plans are being added"}</div>
            <p className="mt-1 text-sm text-stone-500">Tell us what you need and we&apos;ll draw it for your plot and budget.</p>
          </div>
        )}

        <div className="mb-10 mt-8 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Want a plan drawn just for you?</div>
            <p className="text-sm text-white/70">We design for your plot, your budget and the way you live — and handle the approval.</p>
          </div>
          <Link href="/build/start?kind=plans" className="btn-gold shrink-0">Ask for a custom plan</Link>
        </div>
      </div>
    </main>
  );
}
