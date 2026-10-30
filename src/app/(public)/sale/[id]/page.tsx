import type { Metadata } from "next";
import { abs, areaHref, areaOf, breadcrumbLd, idFrom, listingLd, saleHref } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { fileUrl } from "@/lib/file-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, BedDouble, Bath, FileCheck2, HardHat, Landmark, MapPin, MessageCircle, Phone, Ruler, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { crumbText, trailFor } from "@/lib/geo";
import { AroundHere } from "@/components/AroundHere";
import { KIND, TENURE, TITLE, fullUgx, perAcre, shortUgx, sizeText, toAcres, type SaleKind } from "@/lib/sales";
import { PhotoMosaic } from "@/components/Gallery";
import { VideoTour } from "@/components/VideoTour";
import { ViewingBox } from "@/components/Viewings";
import { ActionBar, Checklist, LocationCard, PhotoButtons, shareLink } from "@/components/ListingParts";
import { SaleCard } from "@/components/SaleCard";
import { SaleEnquiryForm, SaleViewCounter, ShareButton } from "@/components/SaleClient";
import { CONTACT, tel, waLink } from "@/lib/social";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const l = await db.saleListing.findUnique({ where: { id: idFrom((await params).id) } });
  if (!l || !["active", "under_offer", "sold"].includes(l.status)) return { title: "For sale", robots: { index: false } };
  const size = sizeText(l);
  const title = `${l.title} — ${shortUgx(l.price)}${l.status === "sold" ? " (sold)" : ""}`;
  const description = `${KIND[l.kind as SaleKind]?.label ?? "Property"} for sale in ${l.location}${size ? `, ${size}` : ""}. ${fullUgx(l.price)}${l.negotiable ? " (negotiable)" : ""}.${l.titleStatus === "titled" ? " Has a land title." : ""}${l.titleVerified ? " Title verified by CasaVilla." : ""} Book a viewing or enquire online.`.slice(0, 300);
  const path = saleHref(l);
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, images: l.photoId ? [{ url: abs(fileUrl(l.photoId, 1024)), width: 1024, alt: l.title }] : undefined },
    robots: l.status === "sold" ? { index: false, follow: true } : undefined,
  };
}

export default async function SaleListingPage({ params }: { params: Promise<{ id: string }> }) {
  const l = await db.saleListing.findUnique({
    where: { id: idFrom((await params).id) },
    include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] }, owner: { select: { id: true, name: true, businessName: true, role: true } } },
  });
  const me = await getUser();
  const mine = !!me && (me.id === l?.ownerId || me.role === "manager");
  // Public once live (and kept visible as "Sold" so shared links don't break); otherwise only the owner/CasaVilla.
  if (!l || (!["active", "under_offer", "sold"].includes(l.status) && !mine)) notFound();
  const trail = await trailFor(l.locationId);
  const size = sizeText(l);
  const isLand = l.kind === "land" || l.kind === "farm";
  const pa = isLand ? perAcre(l) : null;
  const acres = l.sizeValue && l.sizeUnit && l.sizeUnit !== "acres" ? toAcres(l.sizeValue, l.sizeUnit) : null;
  const wa = waLink(`Hello CasaVilla, I'm interested in "${l.title}" (${l.location}) — listing #${l.id}.`);
  const area = [...trail].reverse().find((c) => ["subcounty", "county", "district"].includes(c.level));
  const similar = await db.saleListing.findMany({
    where: { id: { not: l.id }, status: { in: ["active", "under_offer"] }, kind: l.kind, ...(area ? { place: { path: { contains: `/${area.id}/` } } } : {}) },
    orderBy: { publishedAt: "desc" }, take: 3, include: { _count: { select: { photos: true } } },
  });
  const facts: [React.ReactNode, string, string][] = [
    [<Ruler key="r" className="h-5 w-5 text-brand-700" />, "Size", size || "—"],
    ...(l.bedrooms != null ? [[<BedDouble key="b" className="h-5 w-5 text-brand-700" />, "Bedrooms", String(l.bedrooms)] as [React.ReactNode, string, string]] : []),
    ...(l.bathrooms != null ? [[<Bath key="ba" className="h-5 w-5 text-brand-700" />, "Bathrooms", String(l.bathrooms)] as [React.ReactNode, string, string]] : []),
    [<Landmark key="t" className="h-5 w-5 text-brand-700" />, "Tenure", l.tenure ? TENURE[l.tenure].label : "Ask"],
    [<FileCheck2 key="f" className="h-5 w-5 text-brand-700" />, "Title", TITLE[l.titleStatus]],
  ];
  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <SaleViewCounter id={l.id} />
      <JsonLd data={[
        listingLd({ path: saleHref(l), name: l.title, description: l.description, image: l.photoId ? fileUrl(l.photoId, 1024) : null,
          type: isLand ? "Landform" : l.kind === "apartment" ? "Apartment" : "House", price: l.price, per: null, rooms: l.bedrooms, bathrooms: l.bathrooms,
          address: l.location, lat: l.lat, lng: l.lng, amenities: l.features, available: l.status !== "sold", datePosted: l.publishedAt }),
        breadcrumbLd([["Home", "/"], ["For sale", "/sale"], [areaOf(l.location), areaHref(isLand ? "land-for-sale" : "houses-for-sale", areaOf(l.location))], [l.title, saleHref(l)]]),
      ]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <PhotoMosaic photos={l.photos.map((p, i) => ({ id: p.id, fileId: p.fileId, label: `${l.title} — photo ${i + 1}` }))
            .concat(!l.photos.length && l.photoId ? [{ id: 0, fileId: l.photoId, label: l.title }] : [])}
            alt={l.title} overlay={<PhotoButtons back="/sale" backLabel="Back to listings for sale" share={shareLink(`${l.title}, ${l.location}: ${fullUgx(l.price)}`, `/sale/${l.id}`)} video={!!l.videoUrl} save={{ kind: "sale", id: l.id }} />} />
          <div className="relative -mt-6 rounded-t-3xl bg-cream px-4 pt-5 md:mt-0 md:bg-transparent md:px-0">
            {mine && l.status !== "active" && (
              <div className="mb-3 rounded-xl bg-gold-50 p-3 text-xs text-gold-700">Only you and CasaVilla can see this page right now ({l.status.replace("_", " ")}).</div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill bg-gold-400 uppercase tracking-wide text-brand-950">{l.status === "sold" ? "Sold" : l.status === "under_offer" ? "Under offer" : "For sale"}</span>
              <span className="text-xs font-semibold uppercase tracking-wide text-stone-500">{KIND[l.kind as SaleKind]?.label}</span>
            </div>
            <h1 className="mt-3 text-2xl font-bold text-brand-950">{l.title}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" /> {l.location}</div>
            {trail.length > 1 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
            {l.landmark && <div className="mt-1 break-words text-xs text-stone-500">Landmark: {l.landmark}</div>}

            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-bold text-brand-900">{fullUgx(l.price)}</span>
              {l.negotiable && <span className="pill bg-white text-stone-600 ring-1 ring-stone-200">Negotiable</span>}
            </div>
            {pa && <div className="mt-1 text-sm text-stone-500">≈ {shortUgx(pa)} per acre{acres ? ` · ${Number(acres.toFixed(3))} acres` : ""}</div>}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map(([icon, k, v]) => (
                <div key={k} className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white p-3">
                  {icon}
                  <div className="min-w-0"><div className="text-[11px] text-stone-500">{k}</div><div className="text-sm font-semibold leading-snug text-stone-800">{v}</div></div>
                </div>
              ))}
            </div>
            {l.titleVerified && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-brand-100 bg-brand-50/70 p-3 text-sm text-brand-900">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                <span><b>Title verified by CasaVilla.</b> We have seen the land title and checked it with a land search.</span>
              </div>
            )}

            {l.videoUrl && <VideoTour url={l.videoUrl} title={l.title} />}
            {l.description && (
              <section className="mt-6">
                <h2 className="h2">About this {isLand ? "land" : "property"}</h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{l.description}</p>
              </section>
            )}
            <Checklist title="Features" items={l.features} />
            {l.tenure && (
              <section className="mt-6">
                <h2 className="h2">Ownership</h2>
                <p className="mt-2 text-sm text-stone-600"><b>{TENURE[l.tenure].label}</b> — {TENURE[l.tenure].hint}. {TITLE[l.titleStatus]}.</p>
              </section>
            )}
            <LocationCard address={l.location} landmark={l.landmark} lat={l.lat} lng={l.lng} />
            {isLand && l.status !== "sold" && (
              <section className="mt-6 flex flex-col gap-4 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><HardHat className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">Build on this plot with CasaVilla</h2>
                  <p className="text-sm text-white/75">House plans, approvals and construction — and a free site visit before you buy.</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/build/start?plot=${l.id}`} className="btn-gold btn-sm">Build on this plot</Link>
                  <Link href="/build/plans" className="btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">House plans</Link>
                </div>
              </section>
            )}
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50/60 p-3.5 text-xs text-stone-700">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
              <span>Before paying any deposit, do an official land search at the Ministry of Lands and visit the land. Never send money to someone you haven&apos;t met — CasaVilla can arrange the search and the viewing.</span>
            </div>
            {similar.length > 0 && (
              <section className="mt-8">
                <h2 className="h2">Similar {area ? `in ${area.name}` : "listings"}</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">{similar.map((s) => <SaleCard key={s.id} l={s} />)}</div>
              </section>
            )}
            <AroundHere area={area} skip="sale" />
          </div>
        </div>

        <aside id="enquire" className="min-w-0 scroll-mt-20 px-4 pb-24 md:px-0 lg:pb-6">
          <div className="card space-y-4 lg:sticky lg:top-24">
            <div>
              <div className="text-xs text-stone-500">Listed by</div>
              <div className="font-semibold text-brand-950">{l.owner.role === "manager" ? "CasaVilla Property Management" : l.owner.businessName || l.owner.name}</div>
              <div className="text-xs text-stone-500">Viewings and offers are handled through CasaVilla.</div>
            </div>
            {l.status === "sold"
              ? <div className="rounded-xl bg-stone-100 p-3 text-sm text-stone-600">This property has been sold. <Link href="/sale" className="link">See what&apos;s still available →</Link></div>
              : mine ? <Link href={`/${me!.role}/sale/${l.id}`} className="btn-primary w-full">Manage this listing</Link>
              : <SaleEnquiryForm listingId={l.id} title={l.title} me={me ? { name: me.name, phone: me.phone } : null} />}
            {l.status !== "sold" && !mine && <ViewingBox saleListingId={l.id} hostId={l.ownerId} next={`/sale/${l.id}`} />}
            <div className="grid grid-cols-2 gap-2">
              <a href={tel(CONTACT.phones[0])} className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
              <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500"><span>Listing #{l.id}</span><ShareButton title={l.title} /></div>
          </div>
        </aside>
      </div>
      {l.status !== "sold" && !mine && (
        <ActionBar price={shortUgx(l.price)} sub={`${l.title}${l.negotiable ? " · negotiable" : ""}`}>
          <a href={wa} aria-label="Message on WhatsApp" className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>
          <a href="#enquire" className="btn-primary btn-sm">Enquire</a>
        </ActionBar>
      )}
    </main>
  );
}
