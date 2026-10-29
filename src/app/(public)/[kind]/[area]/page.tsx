import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronRight, MessageCircle } from "lucide-react";
import { ugx } from "@/lib/format";
import { shortUgx } from "@/lib/sales";
import { abs, areaHref, areaName, breadcrumbLd, POPULAR_AREAS, rentHref, saleHref, SEO_KINDS, stayHref, type SeoKind } from "@/lib/seo";
import { rentFacts, rentIn, salesIn, staysIn } from "@/lib/seo-areas";
import { PropertyCard, StayCard } from "@/components/PropertyCard";
import { SaleCard } from "@/components/SaleCard";
import { SearchBand } from "@/components/ListingParts";
import { JsonLd } from "@/components/JsonLd";
import { CONTACT } from "@/lib/social";

export const revalidate = 1800;
type Params = { kind: string; area: string };

async function load(p: Params) {
  if (!(p.kind in SEO_KINDS)) return null;
  const kind = p.kind as SeoKind, k = SEO_KINDS[kind], area = areaName(p.area);
  if (k.market === "rent") { const rows = await rentIn(area); return { kind, k, area, market: "rent" as const, rows, facts: rentFacts(rows) }; }
  if (k.market === "stays") { const rows = await staysIn(area); return { kind, k, area, market: "stays" as const, rows, from: rows.length ? Math.min(...rows.map((r) => r.nightlyRate ?? 0)) : 0 }; }
  const rows = await salesIn(area, k.saleKind); return { kind, k, area, market: "sale" as const, rows, from: rows.length ? Math.min(...rows.map((r) => r.price)) : 0 };
}

const where = (area: string) => (area === "Kampala" ? "Kampala" : `${area}, ${["Entebbe", "Mukono", "Wakiso", "Kira", "Najjera", "Nansana", "Kasangati", "Gayaza", "Seeta", "Kajjansi", "Namugongo"].includes(area) ? "near Kampala" : "Kampala"}`);

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const d = await load(await params);
  if (!d) return {};
  const n = d.rows.length;
  const price = d.market === "rent" ? (n ? ` from ${ugx(d.facts.from)} a month` : "") : d.market === "stays" ? (n ? ` from ${ugx(d.from)} a night` : "") : n ? ` from ${shortUgx(d.from)}` : "";
  const title = `${d.k.noun} in ${where(d.area)}${n ? ` (${n} available)` : ""}`;
  const description = n
    ? `${n} ${d.k.short.toLowerCase()} in ${d.area}${price}. Verified listings with photos, prices and location — book a viewing, apply or enquire online with CasaVilla.`
    : `${d.k.noun} in ${d.area}: get an alert the moment a new listing appears, or tell CasaVilla what you need on WhatsApp.`;
  const path = areaHref(d.kind, d.area);
  return { title, description, alternates: { canonical: path }, openGraph: { title, description, url: path }, robots: n ? undefined : { index: false, follow: true } };
}

export default async function AreaPage({ params }: { params: Promise<Params> }) {
  const d = await load(await params);
  if (!d) notFound();
  const { kind, k, area } = d;
  const n = d.rows.length;
  const path = areaHref(kind, area);
  const results = d.market === "rent" ? `/listings?q=${encodeURIComponent(area)}` : d.market === "stays" ? `/stays?q=${encodeURIComponent(area)}` : `/sale?q=${encodeURIComponent(area)}${k.saleKind ? `&kind=${k.saleKind}` : ""}`;
  const wa = `${CONTACT.whatsapp}?text=${encodeURIComponent(`Hello CasaVilla, I'm looking for ${k.short.toLowerCase()} in ${area}.`)}`;

  // What the page says, from the listings themselves.
  const intro = d.market === "rent"
    ? n ? `There ${n === 1 ? "is" : "are"} ${n} ${n === 1 ? "home" : "houses and apartments"} for rent in ${area} on CasaVilla right now, from ${ugx(d.facts.from)} a month. Typical rent here is about ${ugx(d.facts.typical)} a month.` : `No homes for rent in ${area} are listed right now — new ones appear every week.`
    : d.market === "stays" ? n ? `${n} furnished short stay${n === 1 ? "" : "s"} in ${area}, from ${ugx(d.from)} a night. Book by the night and pay with Mobile Money.` : `No short stays in ${area} are listed right now.`
    : n ? `${n} ${k.short.toLowerCase().replace(" for sale", "")} listing${n === 1 ? "" : "s"} for sale in ${area}, from ${shortUgx(d.from)}. Every listing is reviewed by CasaVilla before it appears, and land titles can be checked on request.` : `No ${k.short.toLowerCase()} in ${area} are listed right now.`;

  const faqs: [string, string][] = d.market === "rent" ? [
    [`How much is rent in ${area}?`, n ? `On CasaVilla, homes in ${area} currently rent from ${ugx(d.facts.from)} a month${d.facts.byBeds.map((b) => `; ${b.beds === 0 ? "studios" : `${b.beds}${b.beds === 4 ? "+" : ""}-bedroom homes`} about ${ugx(b.typical)}`).join("")}.` : `Prices depend on size and finish. Turn on an alert to see new ${area} listings with their prices as soon as they're posted.`],
    ["How do I rent a home through CasaVilla?", "Open a home, book a viewing or apply online. Once the landlord accepts, your lease, rent, receipts and repairs are all in the CasaVilla app."],
    ["Can I pay rent with Mobile Money?", "Yes. Rent is paid with MTN Mobile Money or Airtel Money in the app, and you get a receipt straight away."],
    ["Are the listings verified?", "Listings marked Verified have been visited by the CasaVilla team, who checked the property and that the landlord owns it."],
  ] : d.market === "stays" ? [
    [`How much is a short stay in ${area}?`, n ? `From ${ugx(d.from)} a night on CasaVilla, plus any cleaning fee shown on the listing.` : "Prices vary by size and season; turn on an alert to hear about new places."],
    ["How do I book?", "Pick your dates on the listing, then pay with MTN or Airtel Mobile Money. The booking is confirmed in the app."],
  ] : [
    [`How much does ${k.saleKind === "land" ? "land" : "a house"} in ${area} cost?`, n ? `Listings on CasaVilla start from ${shortUgx(d.from)}. Price depends on size, title and access.` : "Turn on an alert to see new listings with prices as soon as they're posted."],
    ["How do I avoid land fraud?", "Do an official search at the Ministry of Lands and visit the land before paying any deposit. CasaVilla can arrange the search and the viewing."],
    ["Can I view before buying?", "Yes — book a viewing on the listing, or contact CasaVilla on WhatsApp."],
  ];

  const otherKinds = (Object.keys(SEO_KINDS) as SeoKind[]).filter((x) => x !== kind);
  const crumbs: [string, string][] = [["Home", "/"], [k.short, areaHref(kind, "Kampala")], [area, path]];
  const items = d.market === "rent" ? d.rows.map((r) => rentHref(r)) : d.market === "stays" ? d.rows.map((r) => stayHref(r)) : d.rows.map((r) => saleHref(r));

  return (
    <main>
      <JsonLd data={[
        breadcrumbLd(crumbs),
        { "@context": "https://schema.org", "@type": "ItemList", name: `${k.noun} in ${area}`, numberOfItems: n, itemListElement: items.slice(0, 30).map((u, i) => ({ "@type": "ListItem", position: i + 1, url: abs(u) })) },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      ]} />
      <SearchBand title={`${k.noun} in ${area}`} text={intro} />

      <div className="mx-auto max-w-6xl px-4 pt-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-stone-500">
          {crumbs.map(([name, href], i) => <span key={href} className="flex items-center gap-1">{i > 0 && <ChevronRight className="h-3 w-3" />}{i < crumbs.length - 1 ? <Link href={href} className="hover:underline">{name}</Link> : <span className="font-semibold text-stone-700">{name}</span>}</span>)}
        </nav>

        {d.market === "rent" && d.facts.byBeds.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {d.facts.byBeds.map((b) => (
              <div key={b.beds} className="rounded-2xl border border-stone-200/70 bg-white px-4 py-2.5 shadow-card">
                <div className="text-[11px] text-stone-500">{b.beds === 0 ? "Studio" : `${b.beds}${b.beds === 4 ? "+" : ""} bedroom${b.beds === 1 ? "" : "s"}`} · {b.count} listed</div>
                <div className="text-sm font-bold text-brand-950">about {ugx(b.typical)}<span className="text-xs font-normal text-stone-500"> / month</span></div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-950">{n ? `${n} available in ${area}` : `Nothing listed in ${area} yet`}</h2>
          <Link href={results} className="text-sm font-semibold text-brand-700 hover:underline">Filter by price, size and more →</Link>
        </div>
        {n > 0 ? (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.market === "rent" && d.rows.map((h) => <PropertyCard key={h.id} h={h} />)}
            {d.market === "stays" && d.rows.map((u) => <StayCard key={u.id} u={u} />)}
            {d.market === "sale" && d.rows.map((l) => <SaleCard key={l.id} l={l} />)}
          </div>
        ) : (
          <div className="mt-3 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-8 text-center text-sm text-stone-600">
            New listings in {area} appear often. <Link href={results} className="link">Search and tap “Alert me”</Link> to be told first, or <a href={wa} className="link">tell us on WhatsApp</a> what you need.
          </div>
        )}

        <div className="mt-8 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Looking in {area}?</div>
            <p className="text-sm text-white/70">Tell us your budget and what you need. We often have places before they&apos;re listed.</p>
          </div>
          <a href={wa} className="btn-gold shrink-0"><MessageCircle className="h-4 w-4" /> Ask on WhatsApp</a>
        </div>

        <section className="mt-10">
          <h2 className="h2">Questions about {k.short.toLowerCase()} in {area}</h2>
          <div className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200/70 bg-white">
            {faqs.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-stone-800">{q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h2 className="h2">{k.short} in other areas</h2>
            <div className="mt-3 flex flex-wrap gap-2">{POPULAR_AREAS.filter((a) => a !== area).map((a) => <Link key={a} href={areaHref(kind, a)} className="chip">{a}</Link>)}</div>
          </div>
          <div>
            <h2 className="h2">More in {area}</h2>
            <div className="mt-3 flex flex-wrap gap-2">{otherKinds.map((x) => <Link key={x} href={areaHref(x, area)} className="chip">{SEO_KINDS[x].short} in {area}</Link>)}</div>
          </div>
        </section>
      </div>
    </main>
  );
}
