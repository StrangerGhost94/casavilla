import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { shopProducts } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Badge, Photo } from "@/components/ui";
import { Submit } from "@/components/client";
import { bookService, placeOrder } from "@/app/market-actions";

export const dynamic = "force-dynamic";

export default async function ProviderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await db.user.findFirst({ where: { id: Number(id) || 0, role: "provider", status: "active" } });
  if (!p) notFound();
  const svcs = await db.service.findMany({ where: { providerId: p.id, active: true }, orderBy: { category: "asc" } });
  const prods = await shopProducts(p.id);
  const me = await getUser();
  const canBook = me && ["tenant", "landlord", "manager"].includes(me.role);
  const myProps = me?.role === "landlord" ? await db.property.findMany({ where: { landlordId: me.id }, orderBy: { name: "asc" } }) : [];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <Link href="/services" className="link text-sm">← All providers</Link>
      <h1 className="h1 mt-3">{p.businessName || p.name}</h1>
      <div className="muted">{p.area || "Kampala"} · Verified by CasaVilla</div>
      {p.bio && <p className="mt-3 max-w-2xl text-stone-700">{p.bio}</p>}

      <h2 className="h2 mt-8">Services</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {svcs.map((s) => (
          <div key={s.id} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{s.title}</div>
                <Badge color="green">{s.category}</Badge>
              </div>
              {s.priceFrom != null && <div className="text-sm font-semibold text-brand-600">From {ugx(s.priceFrom)}</div>}
            </div>
            {s.description && <p className="mt-2 text-sm text-stone-600">{s.description}</p>}
            {canBook ? (
              <details className="mt-3">
                <summary className="btn-outline btn-sm cursor-pointer list-none">Request this service</summary>
                <form action={bookService} className="mt-3 space-y-2">
                  <input type="hidden" name="serviceId" value={s.id} />
                  {myProps.length > 0 && (
                    <select name="propertyId" className="input">
                      <option value="">Which property? (optional)</option>
                      {myProps.map((mp) => <option key={mp.id} value={mp.id}>{mp.name}</option>)}
                    </select>
                  )}
                  <textarea name="description" rows={2} className="input" placeholder="Describe what you need, where and when" required />
                  <Submit className="btn-primary btn-sm">Send request</Submit>
                </form>
              </details>
            ) : !me ? (
              <Link href={`/login?next=/services/${p.id}`} className="link mt-3 inline-block text-sm">Sign in to request →</Link>
            ) : null}
          </div>
        ))}
      </div>

      {prods.length > 0 && (
        <>
          <h2 className="h2 mt-10">Items for sale</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prods.map((pr) => (
              <div key={pr.id} className="card overflow-hidden p-0">
                <Photo id={pr.photoId} alt={pr.name} className="h-36 w-full" />
                <div className="p-4">
                  <div className="font-semibold">{pr.name}</div>
                  <div className="font-bold text-brand-600">{ugx(pr.price)}</div>
                  <div className="text-xs text-stone-500">{pr.stock > 0 ? `${pr.stock} in stock` : "Out of stock"}</div>
                  {me && pr.stock > 0 && (
                    <form action={placeOrder} className="mt-2 flex gap-2">
                      <input type="hidden" name="productId" value={pr.id} />
                      <input type="number" name="quantity" min={1} max={pr.stock} defaultValue={1} className="input w-20" />
                      <Submit className="btn-primary btn-sm">Order</Submit>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
