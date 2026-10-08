import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Badge, Empty } from "@/components/ui";
import { Submit } from "@/components/client";
import { updateOrder } from "../actions";

export default async function ProviderOrders() {
  const u = await requireUser("provider");
  const rows = (await db.order.findMany({
    where: { providerId: u.id }, orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } }, buyer: { select: { name: true, phone: true } } },
  })).map((o) => ({ o, product: o.product.name, buyer: o.buyer.name, phone: o.buyer.phone }));
  const next: Record<string, string[]> = { placed: ["confirmed", "cancelled"], confirmed: ["delivered", "cancelled"] };
  return (
    <>
      <PageHeader title="Orders" subtitle="Contact the buyer to arrange delivery and payment." />
      {rows.length === 0 ? <Empty title="No orders yet" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="table table-stack">
            <thead><tr><th>#</th><th>Date</th><th>Item</th><th>Buyer</th><th>Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.o.id}>
                  <td data-label="">Order #{r.o.id}</td>
                  <td data-label="Date" className="whitespace-nowrap">{fmtDate(r.o.createdAt)}</td>
                  <td data-label="Item">{r.o.quantity} × {r.product}{r.o.deliveryNote && <div className="text-xs text-stone-500">{r.o.deliveryNote}</div>}</td>
                  <td data-label="Buyer">{r.buyer}<div className="text-xs text-stone-500">{r.phone}</div></td>
                  <td data-label="Total">{ugx(r.o.total)}</td>
                  <td data-label="Status"><Badge>{r.o.status}</Badge></td>
                  <td data-label=""><div className="flex gap-1">
                    {(next[r.o.status] || []).map((s) => (
                      <form key={s} action={updateOrder}><input type="hidden" name="id" value={r.o.id} /><input type="hidden" name="status" value={s} />
                        <Submit className={s === "cancelled" ? "btn-ghost btn-sm" : "btn-outline btn-sm"}>{s === "confirmed" ? "Confirm" : s === "delivered" ? "Delivered" : "Cancel"}</Submit></form>
                    ))}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
