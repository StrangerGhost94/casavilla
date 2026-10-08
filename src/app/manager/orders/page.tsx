import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";


export default async function ManagerOrders() {
  await requireUser("manager");
  const rows = (await db.order.findMany({
    orderBy: { createdAt: "desc" }, take: 300,
    include: { product: { select: { name: true } }, buyer: { select: { name: true } }, provider: { select: { name: true, businessName: true } } },
  })).map((o) => ({ o, product: o.product.name, buyer: o.buyer.name, seller: o.provider.businessName, sellerName: o.provider.name }));
  return (
    <>
      <PageHeader title="Shop orders" subtitle="Items bought from service providers through CasaVilla." />
      {rows.length === 0 ? <Empty title="No orders yet" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead><tr><th>#</th><th>Date</th><th>Item</th><th>Buyer</th><th>Seller</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.o.id}><td>{r.o.id}</td><td>{fmtDate(r.o.createdAt)}</td><td>{r.o.quantity} × {r.product}</td><td>{r.buyer}</td><td>{r.seller || r.sellerName}</td><td>{ugx(r.o.total)}</td><td><Badge>{r.o.status}</Badge></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </>
  );
}
