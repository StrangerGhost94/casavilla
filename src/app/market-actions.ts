"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ugx } from "@/lib/format";
import { fail } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { id, int, text } from "@/lib/validate";

/** Any signed-in tenant, landlord or manager can book a provider's service directly. */
export async function bookService(fd: FormData) {
  const u = await requireUser("tenant", "landlord", "manager");
  const svc = await db.service.findUnique({ where: { id: id(fd, "serviceId") }, include: { provider: { select: { status: true } } } });
  if (!svc || !svc.active || svc.provider.status !== "active") return fail("This service isn't available right now");
  if (svc.providerId === u.id) return fail("You can't book your own service");
  const description = (await text(fd, "description", "what you need", { optional: true, max: 2000 })) || svc.title;
  let propertyId: number | null = null, unitId: number | null = null, landlordId: number | null = null;
  if (u.role === "tenant") {
    const l = await db.lease.findFirst({ where: { tenantId: u.id, status: "active" }, include: { unit: true } });
    if (l) { unitId = l.unitId; landlordId = l.landlordId; propertyId = l.unit.propertyId; }
  } else if (u.role === "landlord") {
    const pid = id(fd, "propertyId");
    if (pid) {
      const p = await db.property.findFirst({ where: { id: pid, landlordId: u.id } });
      if (!p) return fail("Choose one of your properties");
      propertyId = p.id; landlordId = u.id;
    }
  }
  const recent = await db.job.findFirst({ where: { requesterId: u.id, serviceId: svc.id, status: { in: ["assigned", "quoted", "accepted", "in_progress"] }, createdAt: { gt: new Date(Date.now() - 86400000) } } });
  const base = `/${u.role}/${u.role === "landlord" ? "maintenance" : u.role === "manager" ? "jobs" : "requests"}`;
  if (recent) redirect(`${base}/${recent.id}`);
  const job = await db.job.create({
    data: {
      requesterId: u.id, providerId: svc.providerId, serviceId: svc.id, category: svc.category,
      title: svc.title, description, propertyId, unitId, landlordId, status: "assigned", assignedAt: new Date(),
      notes: { create: { authorId: u.id, body: `${u.name} booked ${svc.title}${svc.priceFrom ? ` (from ${ugx(svc.priceFrom)})` : ""}`, system: true } },
    },
  });
  await notify(svc.providerId, `New booking from ${u.name}: ${svc.title}. Accept it and send your quote.`, `/provider/jobs/${job.id}`);
  if (landlordId && landlordId !== u.id) await notify(landlordId, `${u.name} booked ${svc.title} for their unit (they pay the provider).`, `/landlord/maintenance/${job.id}`);
  await audit(u.id, "job.booked", "job", job.id, svc.title);
  redirect(`${base}/${job.id}`);
}

export async function placeOrder(fd: FormData) {
  const u = await requireUser();
  const productId = id(fd, "productId");
  const qty = await int(fd, "quantity", "a quantity", { min: 1, max: 100, fallback: 1 });
  const p = await db.product.findUnique({ where: { id: productId }, include: { provider: { select: { status: true } } } });
  if (!p || !p.active || p.provider.status !== "active") return fail("This item isn't available");
  if (p.providerId === u.id) return fail("You can't order your own item");
  const deliveryNote = await text(fd, "deliveryNote", "delivery details", { optional: true, max: 500 });
  // Stock is taken and the order created together: two buyers can't both get the last item, and stock is never lost.
  const o = await db.$transaction(async (tx) => {
    const took = await tx.product.updateMany({ where: { id: p.id, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
    if (took.count === 0) return null;
    return tx.order.create({ data: { productId: p.id, buyerId: u.id, providerId: p.providerId, quantity: qty, total: p.price * qty, deliveryNote } });
  });
  if (!o) return fail(p.stock > 0 ? `Only ${p.stock} ${p.name} left` : `${p.name} is sold out`);
  await notify(p.providerId, `New order: ${qty} × ${p.name} (${ugx(o.total)}) from ${u.name}`, "/provider/orders");
  await audit(u.id, "order.placed", "order", o.id, `${qty} × ${p.name}`);
  revalidatePath("/shop");
  redirect(`/orders?placed=${o.id}`);
}

/** Buyers can cancel an order until the seller confirms it. */
export async function cancelMyOrder(fd: FormData) {
  const u = await requireUser();
  const o = await db.order.findFirst({ where: { id: id(fd), buyerId: u.id } });
  if (!o) return fail("Order not found");
  if (o.status !== "placed") return fail("The seller has already confirmed this order — contact them to cancel");
  const ok = await db.$transaction(async (tx) => {
    const r = await tx.order.updateMany({ where: { id: o.id, status: "placed" }, data: { status: "cancelled" } });
    if (r.count) await tx.product.update({ where: { id: o.productId }, data: { stock: { increment: o.quantity } } });
    return r.count > 0;
  });
  if (ok) {
    await notify(o.providerId, `Order #${o.id} was cancelled by the buyer.`, "/provider/orders");
    await audit(u.id, "order.cancelled", "order", o.id, "by buyer");
  }
  revalidatePath("/orders");
}
