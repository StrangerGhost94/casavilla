import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { Badge, Field, Photo } from "@/components/ui";
import { Submit } from "@/components/client";
import { applyForUnit } from "@/app/tenant/actions";

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/listings" className="link text-sm">← All homes</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Photo id={property.photoId} alt={property.name} className="h-72 w-full rounded-xl" />
          <h1 className="h1 mt-6">{property.name} · {unit.label}</h1>
          <div className="muted mt-1">{property.location} · {property.type} · {unit.bedrooms} bedroom{unit.bedrooms > 1 ? "s" : ""}</div>
          <div className="mt-3 text-2xl font-bold text-brand-600">{ugx(unit.rent)} <span className="text-sm font-normal text-stone-500">per month</span></div>
          {property.description && <p className="mt-4 whitespace-pre-line text-stone-700">{property.description}</p>}
          {others.length > 1 && (
            <div className="mt-6">
              <div className="h2">Other vacant units here</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {others.filter((o) => o.id !== unit.id).map((o) => (
                  <Link key={o.id} href={`/listings/${o.id}`} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm hover:border-brand-500">
                    {o.label} · {ugx(o.rent)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="card h-fit">
          <div className="text-xs font-semibold uppercase text-stone-500">Landlord</div>
          <div className="font-semibold text-stone-900">{landlord.name}</div>
          <div className="mt-1 text-xs text-stone-500">Managed with CasaVilla</div>
          <hr className="my-4 border-stone-100" />
          {unit.status !== "vacant" ? (
            <Badge>occupied</Badge>
          ) : sent || existing ? (
            <div className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
              Application {existing ? <Badge>{existing.status}</Badge> : "sent"}. The landlord will respond in your dashboard.
              <Link href="/tenant/applications" className="link mt-2 block">View my applications →</Link>
            </div>
          ) : user?.role === "tenant" ? (
            <form action={applyForUnit} className="space-y-3">
              <input type="hidden" name="unitId" value={unit.id} />
              <Field label="Preferred move-in"><input type="date" name="moveIn" className="input" /></Field>
              <Field label="Message to landlord"><textarea name="message" rows={3} className="input" placeholder="Introduce yourself, household size, work…" /></Field>
              <Submit className="btn-primary w-full">Apply for this home</Submit>
            </form>
          ) : user ? (
            <div className="muted">Only tenant accounts can apply for homes.</div>
          ) : (
            <div className="space-y-2">
              <Link href={`/register?role=tenant&next=/listings/${unit.id}`} className="btn-primary w-full">Create tenant account to apply</Link>
              <Link href={`/login?next=/listings/${unit.id}`} className="btn-outline w-full">I already have an account</Link>
            </div>
          )}
          <a href={`https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, I'm interested in ${property.name} ${unit.label} (${property.location}).`)}`} className="btn-ghost mt-3 w-full">Ask CasaVilla on WhatsApp</a>
        </aside>
      </div>
    </main>
  );
}
