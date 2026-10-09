import "server-only";
import { db } from "@/db";
import { notify } from "./notify";
import { fail } from "./flash";
import { audit } from "./audit";
import { canMove, ORDER_FLOW } from "./rules";

/** Moves a shop order forward (seller or manager). Cancelling puts the stock back, exactly once. */
export async function advanceOrder(orderId: number, to: string, actorId: number, providerId?: number) {
  const o = await db.order.findFirst({ where: { id: orderId, ...(providerId ? { providerId } : {}) } });
  if (!o) return fail("Order not found");
  if (!canMove(ORDER_FLOW, o.status, to)) return fail(`An order that is ${o.status} can't be marked ${to}`);
  const ok = await db.$transaction(async (tx) => {
    const r = await tx.order.updateMany({ where: { id: o.id, status: o.status }, data: { status: to } });
    if (r.count && to === "cancelled") await tx.product.update({ where: { id: o.productId }, data: { stock: { increment: o.quantity } } });
    return r.count > 0;
  });
  if (!ok) return fail("This order was just updated — refresh to see its status");
  await notify(o.buyerId, `Your order #${o.id} is ${to}.`, "/orders");
  await audit(actorId, `order.${to}`, "order", o.id);
}
