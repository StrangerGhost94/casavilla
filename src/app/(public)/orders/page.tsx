import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My orders" };

export default async function MyOrders({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  const u = await requireUser();
  const { placed } = await searchParams;
  const rows = (await db.order.findMany({
    where: { buyerId: u.id }, orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } }, provider: { select: { name: true, businessName: true, phone: true } } },
  })).map((o) => ({ o, product: o.product.name, seller: o.provider.businessName, sellerName: o.provider.name, sellerPhone: o.provider.phone }));
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="h1">My orders</h1>
      {placed && <div className="mt-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-700">Order placed. The seller has been notified and will contact you.</div>}
      <div className="card mt-6 overflow-x-auto p-0">
        {rows.length === 0 ? <div className="p-5"><Empty title="No orders yet" /></div> : (
          <table className="table">
            <thead><tr><th>Date</th><th>Item</th><th>Seller</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.o.id}>
                  <td>{fmtDate(r.o.createdAt)}</td>
                  <td>{r.o.quantity} × {r.product}</td>
                  <td>{r.seller || r.sellerName}<div className="text-xs text-stone-500">{r.sellerPhone}</div></td>
                  <td>{ugx(r.o.total)}</td>
                  <td><Badge>{r.o.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
