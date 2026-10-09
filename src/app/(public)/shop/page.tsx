import Link from "next/link";
import { getUser } from "@/lib/auth";
import { shopProducts } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Empty, Photo } from "@/components/ui";
import { Submit } from "@/components/client";
import { placeOrder } from "@/app/market-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shop" };

export default async function Shop({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const items = await shopProducts();
  const me = await getUser();
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="h1">Shop</h1>
      <p className="muted mt-1">Materials, fittings and supplies sold by CasaVilla service providers. Pay the seller on delivery.</p>
      {error && <div className="mt-4 rounded-lg bg-maroon-50 p-3 text-sm text-maroon-600">{error}</div>}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <div key={p.id} className="card flex flex-col overflow-hidden p-0">
            <Photo id={p.photoId} alt={p.name} className="h-40 w-full" />
            <div className="flex flex-1 flex-col p-4">
              <div className="font-semibold text-stone-900">{p.name}</div>
              <Link href={`/services/${p.providerId}`} className="text-xs text-stone-500 hover:underline">by {p.seller || p.sellerName}</Link>
              {p.description && <p className="mt-1 line-clamp-2 text-sm text-stone-600">{p.description}</p>}
              <div className="mt-auto pt-3">
                <div className="font-bold text-brand-600">{ugx(p.price)}</div>
                <div className="text-xs text-stone-500">{p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>
                {p.stock > 0 && (me ? (
                  <form action={placeOrder} className="mt-2 space-y-2">
                    <input type="hidden" name="productId" value={p.id} />
                    <div className="flex gap-2">
                      <input type="number" name="quantity" min={1} max={p.stock} defaultValue={1} className="input w-20" />
                      <Submit className="btn-primary btn-sm flex-1">Order</Submit>
                    </div>
                    <input name="deliveryNote" className="input" placeholder="Delivery address / note" />
                  </form>
                ) : (
                  <Link href="/login?next=/shop" className="link mt-2 inline-block text-sm">Sign in to order →</Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <div className="mt-6"><Empty title="No items for sale yet" /></div>}
    </main>
  );
}
