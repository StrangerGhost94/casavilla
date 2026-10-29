import type { Metadata } from "next";
import { abs, areaHref, areaOf, breadcrumbLd, idFrom, listingLd, rentHref } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { fileUrl } from "@/lib/file-url";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ListingPhotos } from "@/components/Gallery";
import { VideoTour } from "@/components/VideoTour";
import { ViewingBox } from "@/components/Viewings";
import { ActionBar, Checklist, FactTiles, LocationCard, PhotoButtons, shareLink } from "@/components/ListingParts";
import { Bath, BadgeCheck, BedDouble, CalendarCheck, Building2, ChevronRight, DoorOpen, MapPin, MessageCircle, Phone, Ruler, Sofa } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { Avatar, Badge, Field } from "@/components/ui";
import { Submit } from "@/components/client";
import { applyForUnit } from "@/app/tenant/actions";
import { crumbText, trailFor } from "@/lib/geo";
import { AroundHere, LivingHere } from "@/components/AroundHere";
import { homeNoun, homeTitle, PropertyCard } from "@/components/PropertyCard";
import { listedUnits } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const u = await db.unit.findUnique({ where: { id: idFrom((await params).id) }, include: { property: true } });
  if (!u || u.mode !== "long") return {};
  const p = u.property, area = areaOf(p.location);
  const title = `${homeTitle(u.bedrooms, p.type)} for rent in ${area} — ${ugx(u.rent)} a month`;
  const bits = [u.bathrooms && `${u.bathrooms} bathroom${u.bathrooms === 1 ? "" : "s"}`, u.selfContained && "self-contained", u.furnished && "furnished", ...u.amenities.slice(0, 4)].filter(Boolean).join(", ");
  const description = `${homeTitle(u.bedrooms, p.type)} at ${p.name}, ${p.location}. ${ugx(u.rent)} per month${bits ? `; ${bits}` : ""}.${p.verifiedAt ? " Verified by CasaVilla." : ""} Book a viewing or apply online.`.slice(0, 300);
  const path = rentHref({ id: u.id, bedrooms: u.bedrooms, type: p.type, location: p.location });
  const live = u.listed && u.status === "vacant" && !p.archivedAt;
  return {
    title, description, alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", images: p.photoId ? [{ url: abs(fileUrl(p.photoId, 1024)), width: 1024, alt: title }] : undefined },
    robots: live ? undefined : { index: false, follow: true },
  };
}

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params;
  const { sent } = await searchParams;
  const row = await db.unit.findUnique({
    where: { id: idFrom(id) },
    include: { property: { include: { landlord: { select: { id: true, name: true, phone: true, status: true } } } } },
  });
  if (!row || row.property.landlord.status !== "active") notFound();
  if (row.mode === "short") redirect(`/stays/${row.id}`);
  const { property, ...unit } = row;
  const landlord = property.landlord;
  const others = await db.unit.findMany({ where: { propertyId: property.id, listed: true, status: "vacant", mode: "long" }, orderBy: { label: "asc" } });
  const user = await getUser();
  const existing = user?.role === "tenant"
    ? await db.application.findFirst({ where: { unitId: unit.id, tenantId: user.id }, orderBy: { createdAt: "desc" } })
    : null;
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm interested in ${property.name} ${unit.label} (${property.location}).`)}`;
  const trail = await trailFor(property.locationId);
  const area = [...trail].reverse().find((c) => ["subcounty", "county", "district"].includes(c.level));
  // Similar: other vacant homes within about a third of this rent, nearest in price first.
  const similar = (await listedUnits({ max: Math.round(unit.rent * 1.35), exclude: unit.id, limit: 30 }))
    .filter((h) => h.rent >= unit.rent * 0.65)
    .sort((a, b) => Math.abs(a.rent - unit.rent) - Math.abs(b.rent - unit.rent)).slice(0, 3);
  const title = homeTitle(unit.bedrooms, property.type);
  const share = shareLink(`${title} at ${property.name}, ${property.location}: ${ugx(unit.rent)} / month`, `/listings/${unit.id}`);
  const facts: [typeof BedDouble, string, string][] = [
    [BedDouble, unit.bedrooms ? String(unit.bedrooms) : "Studio", unit.bedrooms === 1 ? "Bedroom" : unit.bedrooms ? "Bedrooms" : "Layout"],
    [Bath, String(unit.bathrooms), unit.bathrooms === 1 ? "Bathroom" : "Bathrooms"],
    ...(unit.sizeSqm ? [[Ruler, `${unit.sizeSqm} m²`, "Size"] as [typeof BedDouble, string, string]] : []),
    [Building2, homeNoun(property.type), "Type"],
    [Sofa, unit.furnished ? "Furnished" : "Unfurnished", unit.selfContained ? "Self-contained" : "Shared facilities"],
    [DoorOpen, unit.label, "Unit"],
  ];
  const amenities = [unit.selfContained ? "Self-contained" : null, unit.furnished ? "Furnished" : null, ...unit.amenities].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <JsonLd data={[
        listingLd({
          path: rentHref({ id: unit.id, bedrooms: unit.bedrooms, type: property.type, location: property.location }), name: `${title} · ${property.name}`, description: property.description,
          image: property.photoId ? fileUrl(property.photoId, 1024) : null, type: /house/i.test(property.type) ? "House" : /apartment/i.test(property.type) ? "Apartment" : "Residence",
          price: unit.rent, per: "MON", rooms: unit.bedrooms, bathrooms: unit.bathrooms, sizeSqm: unit.sizeSqm, address: property.location,
          lat: property.lat, lng: property.lng, amenities: amenities, available: unit.status === "vacant", datePosted: unit.createdAt,
        }),
        breadcrumbLd([["Home", "/"], ["Houses for rent", "/listings"], [areaOf(property.location), areaHref("houses-for-rent", areaOf(property.location))], [title, rentHref({ id: unit.id, bedrooms: unit.bedrooms, type: property.type, location: property.location })]]),
      ]} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <ListingPhotos propertyId={property.id} unitId={unit.id} coverId={property.photoId} alt={property.name} overlay={<PhotoButtons back="/listings" backLabel="Back to homes" share={share} video={!!property.videoUrl} save={{ kind: "rent", id: unit.id }} />} />
          <div className="relative -mt-6 rounded-t-3xl bg-cream px-4 pt-5 md:mt-0 md:bg-transparent md:px-0">
            <div className="flex flex-wrap gap-1.5">
              <span className="pill bg-brand-800 uppercase tracking-wide text-white">For rent</span>
              {property.verifiedAt && <span className="pill bg-brand-50 text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
              {unit.status === "vacant" && <span className="pill bg-gold-50 text-gold-700">Available now</span>}
            </div>
            <nav aria-label="Breadcrumb" className="mt-3 flex flex-wrap items-center gap-1 text-[11px] text-stone-500">
              <Link href="/listings" className="hover:underline">Houses for rent</Link><ChevronRight className="h-3 w-3" />
              <Link href={areaHref("houses-for-rent", areaOf(property.location))} className="hover:underline">{areaOf(property.location)}</Link>
            </nav>
            <h1 className="mt-1 text-2xl font-bold text-brand-950 md:text-3xl">{title} · {property.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" /> {property.location}</div>
            {trail.length > 1 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
            {property.landmark && <div className="mt-1 break-words text-xs text-stone-500">Landmark: {property.landmark}</div>}
            <div className="mt-3 text-2xl font-bold text-brand-900 lg:hidden">{ugx(unit.rent)} <span className="text-sm font-normal text-stone-500">/ month</span></div>

            <FactTiles facts={facts} />
            {property.verifiedAt && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-3 text-sm">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
                <div><span className="font-semibold text-brand-900">Verified by CasaVilla.</span> <span className="text-stone-600">Our team visited this property and checked the landlord owns it.</span></div>
              </div>
            )}

            {property.videoUrl && <VideoTour url={property.videoUrl} title={`${title} · ${property.name}`} />}
            <Checklist title="What this home offers" items={amenities} />
            {property.description && (
              <section className="mt-6">
                <h2 className="h2">Overview</h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{property.description}</p>
              </section>
            )}
            <LocationCard address={property.location} landmark={property.landmark} lat={property.lat} lng={property.lng} />
            <LivingHere />
            {others.length > 1 && (
              <section className="mt-6">
                <h2 className="h2">Other vacant units here</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {others.filter((o) => o.id !== unit.id).map((o) => (
                    <Link key={o.id} href={`/listings/${o.id}`} className="chip py-2">{o.label} · {ugx(o.rent)}</Link>
                  ))}
                </div>
              </section>
            )}
            <AroundHere area={area} />
            {similar.length > 0 && (
              <section className="mt-8">
                <div className="mb-3 flex items-end justify-between">
                  <h2 className="h2">Similar homes</h2>
                  <Link href={`/listings?max=${Math.round(unit.rent * 1.35)}`} className="flex items-center gap-0.5 text-sm font-semibold text-brand-700">See more <ChevronRight className="h-4 w-4" /></Link>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{similar.map((h) => <PropertyCard key={h.id} h={h} />)}</div>
              </section>
            )}
          </div>
        </div>

        <aside id="apply" className="min-w-0 scroll-mt-20 px-4 pb-24 md:px-0 lg:pb-0">
          <div className="card lg:sticky lg:top-24">
            <div className="mb-4 hidden lg:block">
              <div className="text-2xl font-bold text-brand-950">{ugx(unit.rent)} <span className="text-sm font-normal text-stone-500">/ month</span></div>
              <div className="mt-0.5 text-xs text-stone-500">{title} · Unit {unit.label}</div>
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={landlord.name} />
              <div>
                <div className="text-xs text-stone-500">Landlord</div>
                <div className="font-semibold text-brand-950">{landlord.name}</div>
              </div>
            </div>
            <div className="my-4 border-t border-stone-100" />
            {unit.status === "vacant" && <div className="mb-4"><ViewingBox unitId={unit.id} hostId={landlord.id} next={`/listings/${unit.id}`} /></div>}
            {unit.status !== "vacant" ? (
              <Badge>occupied</Badge>
            ) : sent || existing ? (
              <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">
                Application {existing ? <Badge>{existing.status}</Badge> : "sent"}. The landlord will respond in your dashboard.
                <Link href="/tenant/applications" className="link mt-2 block">View my applications →</Link>
              </div>
            ) : user?.role === "tenant" ? (
              <form action={applyForUnit} className="space-y-3">
                <input type="hidden" name="unitId" value={unit.id} />
                <Field label="Preferred move-in"><input type="date" name="moveIn" className="input" /></Field>
                <Field label="Message to landlord"><textarea name="message" rows={3} className="input" placeholder="Introduce yourself, household size, work…" /></Field>
                <Submit className="btn-primary btn-lg w-full">Apply for this home</Submit>
              </form>
            ) : user ? (
              <div className="muted">Only tenant accounts can apply for homes.</div>
            ) : (
              <div className="space-y-2">
                <Link href={`/register?role=tenant&next=/listings/${unit.id}`} className="btn-primary btn-lg w-full">Apply for this home</Link>
                <p className="text-center text-xs text-stone-500">Free account · takes a minute</p>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="tel:+256776593482" className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
              <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
            <p className="mt-3 text-center text-[11px] text-stone-400">CasaVilla never asks for money before you&apos;ve seen the home.</p>
          </div>
        </aside>
      </div>

      {/* Phones: price and the main action always in reach, above the tab bar */}
      {unit.status === "vacant" && !sent && !existing && (
        <ActionBar price={ugx(unit.rent)} per="/ month" sub={`${title} · ${property.name}`}>
          <a href={wa} aria-label="Message on WhatsApp" className="btn-outline btn-sm px-2.5"><MessageCircle className="h-4 w-4" /></a>
          <a href="#viewing" aria-label="Book a viewing" className="btn-outline btn-sm px-2.5"><CalendarCheck className="h-4 w-4" /></a>
          <a href={user ? "#apply" : `/register?role=tenant&next=/listings/${unit.id}`} className="btn-primary btn-sm">Apply</a>
        </ActionBar>
      )}
    </main>
  );
}
