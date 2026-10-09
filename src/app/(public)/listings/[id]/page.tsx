import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, BedDouble, Building2, DoorOpen, MapPin, MessageCircle, Phone } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { Avatar, Badge, Field, Photo } from "@/components/ui";
import { Submit } from "@/components/client";
import { applyForUnit } from "@/app/tenant/actions";
import { crumbText, trailFor } from "@/lib/geo";

export const dynamic = "force-dynamic";

export default async function ListingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string }> }) {
  const { id } = await params;
  const { sent } = await searchParams;
  const row = await db.unit.findUnique({
    where: { id: Number(id) || 0 },
    include: { property: { include: { landlord: { select: { id: true, name: true, phone: true, status: true } } } } },
  });
  if (!row || row.property.landlord.status !== "active") notFound();
  const { property, ...unit } = row;
  const landlord = property.landlord;
  const others = await db.unit.findMany({ where: { propertyId: property.id, listed: true, status: "vacant" }, orderBy: { label: "asc" } });
  const user = await getUser();
  const existing = user?.role === "tenant"
    ? await db.application.findFirst({ where: { unitId: unit.id, tenantId: user.id }, orderBy: { createdAt: "desc" } })
    : null;
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm interested in ${property.name} ${unit.label} (${property.location}).`)}`;
  const trail = await trailFor(property.locationId);
  // A real pin opens the exact spot; otherwise the map searches the address (never a made-up point).
  const maps = property.lat != null && property.lng != null
    ? `https://www.google.com/maps/search/?api=1&query=${property.lat},${property.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.location + ", Uganda")}`;
  const area = [...trail].reverse().find((c) => ["subcounty", "county", "district"].includes(c.level));

  return (
    <main className="mx-auto max-w-6xl md:px-4 md:pt-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="relative">
            <Photo id={property.photoId} alt={property.name} className="h-72 w-full md:h-96 md:rounded-3xl" />
            <Link href="/listings" aria-label="Back to homes" className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-900 shadow-card backdrop-blur">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </div>
          <div className="relative -mt-6 rounded-t-3xl bg-cream px-4 pt-5 md:mt-0 md:bg-transparent md:px-0">
            <span className="pill bg-brand-800 uppercase tracking-wide text-white">For rent</span>
            <h1 className="mt-3 text-2xl font-bold text-brand-950">{unit.bedrooms} Bedroom · {property.name}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-stone-500"><MapPin className="h-4 w-4 shrink-0" /> {property.location}</div>
            {trail.length > 1 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
            {property.landmark && <div className="mt-1 text-xs text-stone-500">Landmark: {property.landmark}</div>}
            {area && <Link href={`/listings?in=${area.id}`} className="link mt-1 inline-block text-xs">More homes in {area.name} →</Link>}
            <div className="mt-3 text-2xl font-bold text-brand-900">{ugx(unit.rent)} <span className="text-sm font-normal text-stone-500">/ month</span></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[[BedDouble, `${unit.bedrooms} bed${unit.bedrooms > 1 ? "s" : ""}`], [Building2, property.type], [DoorOpen, `Unit ${unit.label}`]].map(([I, t], i) => {
                const Icon = I as typeof BedDouble;
                return <div key={i} className="flex flex-col items-center gap-1 rounded-2xl border border-stone-200/70 bg-white p-3 text-center text-xs text-stone-600"><Icon className="h-5 w-5 text-brand-700" />{t as string}</div>;
              })}
            </div>
            <span className="pill mt-4 bg-brand-50 text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified listing · managed with CasaVilla</span>

            {property.description && (
              <section className="mt-6">
                <h2 className="h2">Overview</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone-600">{property.description}</p>
              </section>
            )}
            <section className="mt-6">
              <h2 className="h2">Location</h2>
              <a href={maps} target="_blank" rel="noreferrer" className="card mt-2 flex items-center gap-3 p-4 hover:border-brand-200">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-5 w-5" /></span>
                <span className="flex-1 text-sm text-stone-700">{property.location}</span>
                <span className="text-xs font-semibold text-brand-700">View on map</span>
              </a>
            </section>
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
          </div>
        </div>

        <aside className="px-4 md:px-0">
          <div className="card lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <Avatar name={landlord.name} />
              <div>
                <div className="text-xs text-stone-500">Landlord</div>
                <div className="font-semibold text-brand-950">{landlord.name}</div>
              </div>
            </div>
            <div className="my-4 border-t border-stone-100" />
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
                <Link href={`/login?next=/listings/${unit.id}`} className="btn-outline w-full">I already have an account</Link>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <a href="tel:+256776593482" className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
              <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> Message</a>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
