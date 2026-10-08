"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { ugx } from "@/lib/format";
import { fail } from "@/lib/flash";

/** Any signed-in tenant, landlord or manager can book a provider's service directly. */
export async function bookService(fd: FormData) {
  const u = await requireUser("tenant", "landlord", "manager");
  const svc = await db.service.findUnique({ where: { id: Number(fd.get("serviceId")) } });
  if (!svc) return fail("Service not found");
  let propertyId: number | null = null, unitId: number | null = null, landlordId: number | null = null;
  if (u.role === "tenant") {
    const l = await db.lease.findFirst({ where: { tenantId: u.id, status: "active" }, include: { unit: true } });
    if (l) { unitId = l.unitId; landlordId = l.landlordId; propertyId = l.unit.propertyId; }
  } else if (u.role === "landlord") {
    const pid = Number(fd.get("propertyId")) || null;
    if (pid) {
      const p = await db.property.findFirst({ where: { id: pid, landlordId: u.id } });
      if (p) { propertyId = p.id; landlordId = u.id; }
    }
  }
  const job = await db.job.create({
    data: {
      requesterId: u.id, providerId: svc.providerId, serviceId: svc.id, category: svc.category,
      title: svc.title, description: String(fd.get("description") || "").trim() || svc.title,
      propertyId, unitId, landlordId, status: "assigned",
    },
  });
  await notify(svc.providerId, `New booking from ${u.name}: ${svc.title}`, `/provider/jobs/${job.id}`);
  if (landlordId && landlordId !== u.id) await notify(landlordId, `${u.name} booked ${svc.title} for their unit.`, `/landlord/maintenance/${job.id}`);
  redirect(`/${u.role}/${u.role === "landlord" ? "maintenance" : u.role === "manager" ? "jobs" : "requests"}/${job.id}`);
}

export async function placeOrder(fd: FormData) {
  const u = await requireUser();
  const productId = Number(fd.get("productId"));
  const qty = Math.max(1, Number(fd.get("quantity")) || 1);
  const p = await db.product.findUnique({ where: { id: productId } });
  if (!p || !p.active) return fail("Product not available");
  // Take stock only if enough is left, so two buyers can't both get the last item.
  const took = await db.product.updateMany({ where: { id: p.id, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
  if (took.count === 0) redirect(`/shop?error=${encodeURIComponent(`Only ${p.stock} of ${p.name} left`)}`);
  const o = await db.order.create({
    data: {
      productId: p.id, buyerId: u.id, providerId: p.providerId, quantity: qty, total: p.price * qty,
      deliveryNote: String(fd.get("deliveryNote") || "") || null,
    },
  });
  await notify(p.providerId, `New order: ${qty} × ${p.name} (${ugx(o.total)}) from ${u.name}`, "/provider/orders");
  revalidatePath("/shop");
  redirect(`/orders?placed=${o.id}`);
}
