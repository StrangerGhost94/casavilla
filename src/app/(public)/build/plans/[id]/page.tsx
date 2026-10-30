import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Bath, BedDouble, Layers, MessageCircle, Phone, Ruler, Square } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { PLAN_STYLES, buildCost, planFacts, type PlanStyle } from "@/lib/build";
import { fullUgx, shortUgx } from "@/lib/sales";
import { fileUrl } from "@/lib/file-url";
import { CONTACT, tel, waLink } from "@/lib/social";
import { ORG_ID, abs, breadcrumbLd, idFrom, planHref } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { PhotoMosaic } from "@/components/Gallery";
import { ActionBar, Checklist, PhotoButtons, shareLink } from "@/components/ListingParts";
import { PlanCard } from "@/components/BuildCards";
import { BuildRequestForm } from "@/components/BuildClient";

export const dynamic = "force-dynamic";

const load = (param: string) => db.housePlan.findFirst({
  where: { id: idFrom(param), published: true },
  include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] } },
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await load((await params).id);
  if (!p) return { title: "House plan", robots: { index: false } };
  const cost = buildCost(p);
  const title = `${p.title} — house plan${p.price ? `, ${shortUgx(p.price)}` : ""}`;
  const description = `${PLAN_STYLES[p.style as PlanStyle]?.label ?? "House"} plan: ${planFacts(p)}.${cost ? ` Estimated cost to build in Uganda: ${cost}.` : ""} ${p.summary ?? "Buy the drawings or have CasaVilla build it, with approval handled."}`.slice(0, 300);
  const path = planHref(p);
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", ...(p.photoId ? { images: [{ url: abs(fileUrl(p.photoId, 1024)), alt: p.title }] } : {}) },
  };
}

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const [p, me] = await Promise.all([load((await params).id), getUser()]);
  if (!p) notFound();
  const path = planHref(p);
  const others = await db.housePlan.findMany({
    where: { published: true, id: { not: p.id }, OR: [{ style: p.style }, { bedrooms: p.bedrooms }] },
    orderBy: [{ sort: "asc" }, { id: "desc" }], take: 3, include: { _count: { select: { photos: true } } },
  });
  const cost = buildCost(p);
  const styleLabel = PLAN_STYLES[p.style as PlanStyle]?.label ?? p.style;
  const buildKind = p.style === "apartments" ? "apartments" : p.style === "commercial" ? "commercial" : "house";
  const wa = waLink(`Hello CasaVilla, I'm interested in the house plan "${p.title}" (${abs(path)}).`);
  const facts: [typeof BedDouble, string, string][] = [
    ...(p.bedrooms != null ? [[BedDouble, "Bedrooms", String(p.bedrooms)] as [typeof BedDouble, string, string]] : []),
    ...(p.bathrooms != null ? [[Bath, "Bathrooms", String(p.bathrooms)] as [typeof BedDouble, string, string]] : []),
    [Layers, "Floors", String(p.floors)],
    ...(p.areaSqm ? [[Square, "Floor area", `${p.areaSqm} m²`] as [typeof BedDouble, string, string]] : []),
    ...(p.plotSize ? [[Ruler, "Fits a plot of", p.plotSize] as [typeof BedDouble, string, string]] : []),
  ];

  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "Product", name: `${p.title} — house plan`, url: abs(path), category: "House plans",
          description: p.summary ?? p.description ?? `${styleLabel} plan: ${planFacts(p)}`,
          ...(p.photos.length ? { image: p.photos.slice(0, 6).map((ph) => abs(fileUrl(ph.fileId, 1024))) } : {}),
          brand: { "@id": ORG_ID },
          offers: { "@type": "Offer", price: p.price, priceCurrency: "UGX", availability: "https://schema.org/InStock", seller: { "@id": ORG_ID }, url: abs(path) },
        },
        breadcrumbLd([["Home", "/"], ["Build with CasaVilla", "/build"], ["House plans", "/build/plans"], [p.title, path]]),
      ]} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PhotoMosaic photos={p.photos.map((ph, i) => ({ id: ph.id, fileId: ph.fileId, label: `${p.title} — drawing ${i + 1}` }))} alt={p.title}
            overlay={<PhotoButtons back="/build/plans" backLabel="Back to house plans" share={shareLink(`${p.title} — house plan by CasaVilla`, path)} />} />
          <div className="relative -mt-6 rounded-t-3xl bg-cream px-4 pt-5 md:mt-0 md:bg-transparent md:px-0">
            <nav aria-label="Breadcrumb" className="text-xs text-stone-500"><Link href="/build" className="hover:underline">Build</Link> › <Link href="/build/plans" className="hover:underline">House plans</Link></nav>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="pill bg-brand-800 uppercase tracking-wide text-white">House plan</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{styleLabel}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-brand-950">{p.title}</h1>
            {p.summary && <p className="mt-1 text-sm text-stone-600">{p.summary}</p>}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-stone-200/70 bg-white p-4">
                <div className="text-xs text-stone-500">Price of the plans</div>
                <div className="text-2xl font-bold text-brand-900">{p.price ? fullUgx(p.price) : "Free with a CasaVilla build"}</div>
                <div className="text-[11px] text-stone-500">Architectural drawings{p.price ? " · adjustments on request" : ""}</div>
              </div>
              {cost && (
                <div className="rounded-2xl border border-gold-200 bg-gold-50/60 p-4">
                  <div className="text-xs text-stone-600">Estimated cost to build</div>
                  <div className="text-2xl font-bold text-brand-900">{cost}</div>
                  <div className="text-[11px] text-stone-500">Depends on the site and finishes — fixed in your quote</div>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map(([I, k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><I className="h-4 w-4" /></span>
                  <div className="min-w-0"><div className="text-[11px] text-stone-500">{k}</div><div className="text-sm font-semibold text-stone-800">{v}</div></div>
                </div>
              ))}
            </div>

            {p.description && (
              <section className="mt-6">
                <h2 className="h2">About this plan</h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{p.description}</p>
              </section>
            )}
            <Checklist title="What's included" items={p.features} />

            <section className="mt-6 rounded-2xl border border-stone-200/70 bg-white p-4 text-sm text-stone-600">
              <h2 className="font-semibold text-brand-950">What you get with the plans</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Architectural drawings: floor plans, elevations and sections.</li>
                <li>Changes to fit your plot and the way you live, on request.</li>
                <li>Structural drawings and submission for building approval, if you want us to handle it.</li>
              </ul>
            </section>

            {others.length > 0 && (
              <section className="mt-8 pb-4">
                <h2 className="h2">Similar plans</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">{others.map((o) => <PlanCard key={o.id} p={o} />)}</div>
              </section>
            )}
          </div>
        </div>

        <aside id="enquire" className="min-w-0 scroll-mt-20 px-4 pb-24 md:px-0 lg:pb-6">
          <div className="card space-y-4 lg:sticky lg:top-24">
            <div>
              <div className="font-semibold text-brand-950">Buy this plan or build it</div>
              <div className="text-xs text-stone-500">Tell us where and when. CasaVilla calls you back — free, no obligation.</div>
            </div>
            <BuildRequestForm me={me ? { name: me.name, phone: me.phone, email: me.email } : null} kind={buildKind} planId={p.id} compact />
            <div className="grid grid-cols-2 gap-2">
              <a href={tel(CONTACT.phones[0])} className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
              <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
          </div>
        </aside>
      </div>

      <ActionBar price={p.price ? shortUgx(p.price) : "Plan"} sub={`${p.title}${cost ? ` · build ${cost}` : ""}`}>
        <a href={wa} aria-label="Message on WhatsApp" className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>
        <a href="#enquire" className="btn-primary btn-sm">Get this plan</a>
      </ActionBar>
    </main>
  );
}
