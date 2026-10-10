import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, BedDouble, Bath, FileCheck2, Landmark, MapPin, MessageCircle, Phone, Ruler, ShieldAlert } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { crumbText, trailFor } from "@/lib/geo";
import { KIND, TENURE, TITLE, fullUgx, perAcre, shortUgx, sizeText, toAcres, type SaleKind } from "@/lib/sales";
import { Photo } from "@/components/ui";
import { PhotoZoom } from "@/components/FileButton";
import { SaleCard } from "@/components/SaleCard";
import { SaleEnquiryForm, SaleViewCounter, ShareButton } from "@/components/SaleClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const l = await db.saleListing.findUnique({ where: { id: Number((await params).id) || 0 }, select: { title: true, status: true } });
  return { title: l && ["active", "under_offer", "sold"].includes(l.status) ? `${l.title} — for sale` : "For sale" };
}

export default async function SaleListingPage({ params }: { params: Promise<{ id: string }> }) {
  const l = await db.saleListing.findUnique({
    where: { id: Number((await params).id) || 0 },
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
  const maps = l.lat != null && l.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.location + ", Uganda")}`;
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm interested in "${l.title}" (${l.location}) — listing #${l.id}.`)}`;
  const area = [...trail].reverse().find((c) => ["subcounty", "county", "district"].includes(c.level));
  const similar = await db.saleListing.findMany({
    where: { id: { not: l.id }, status: { in: ["active", "under_offer"] }, kind: l.kind, ...(area ? { place: { path: { contains: `/${area.id}/` } } } : {}) },
    orderBy: { publishedAt: "desc" }, take: 3,
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <div className="relative">
            <Photo id={l.photoId} alt={l.title} className="h-72 w-full md:h-96 md:rounded-3xl" />
            <Link href="/sale" aria-label="Back to listings for sale" className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-card backdrop-blur"><ArrowLeft className="h-5 w-5" /></Link>
            {l.photos.length > 1 && <span className="absolute bottom-8 right-4 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white md:bottom-4">{l.photos.length} photos</span>}
          </div>
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

            {l.photos.length > 1 && (
              <section className="mt-6">
                <h2 className="h2">Photos <span className="text-xs font-normal text-stone-500">({l.photos.length})</span></h2>
                <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                  {l.photos.map((p, i) => (
                    <PhotoZoom key={p.id} src={`/api/files/${p.fileId}`} alt={`${l.title} — photo ${i + 1}`} className="relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl bg-stone-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/files/${p.fileId}`} alt="" loading="lazy" className="h-44 w-full object-cover" />
                    </PhotoZoom>
                  ))}
                </div>
              </section>
            )}

            {l.description && (
              <section className="mt-6">
                <h2 className="h2">About this {isLand ? "land" : "property"}</h2>
                <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-stone-600">{l.description}</p>
              </section>
            )}
            {l.features.length > 0 && (
              <section className="mt-6">
                <h2 className="h2">Features</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">{l.features.map((f) => <span key={f} className="pill bg-white text-stone-700 ring-1 ring-stone-200">{f}</span>)}</div>
              </section>
            )}
            {l.tenure && (
              <section className="mt-6">
                <h2 className="h2">Ownership</h2>
                <p className="mt-2 text-sm text-stone-600"><b>{TENURE[l.tenure].label}</b> — {TENURE[l.tenure].hint}. {TITLE[l.titleStatus]}.</p>
              </section>
            )}
            <section className="mt-6">
              <h2 className="h2">Location</h2>
              <a href={maps} target="_blank" rel="noreferrer" className="card mt-2 flex items-center gap-3 p-4 hover:border-brand-200">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1 break-words text-sm text-stone-700">{l.location}{l.lat == null ? " (approximate — exact spot shown at the viewing)" : ""}</span>
                <span className="shrink-0 text-xs font-semibold text-brand-700">View on map</span>
              </a>
            </section>
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-gold-200 bg-gold-50/60 p-3.5 text-xs text-stone-700">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" />
              <span>Before paying any deposit, do an official land search at the Ministry of Lands and visit the land. Never send money to someone you haven&apos;t met — CasaVilla can arrange the search and the viewing.</span>
            </div>
            {similar.length > 0 && (
              <section className="mt-8">
                <h2 className="h2">Similar {area ? `in ${area.name}` : "listings"}</h2>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">{similar.map((s) => <SaleCard key={s.id} l={s} />)}</div>
              </section>
            )}
          </div>
        </div>

        <aside className="min-w-0 px-4 pb-6 md:px-0">
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
            <div className="grid grid-cols-2 gap-2">
              <a href="tel:+256776593482" className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
              <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500"><span>Listing #{l.id}</span><ShareButton title={l.title} /></div>
          </div>
        </aside>
      </div>
    </main>
  );
}
