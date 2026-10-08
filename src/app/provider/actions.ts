"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { notify } from "@/lib/notify";
import { normalizePhone } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");

export async function saveService(fd: FormData) {
  const u = await requireUser("provider");
  const id = Number(fd.get("id")) || null;
  const data = {
    category: String(fd.get("category")), title: String(fd.get("title")).trim(),
    description: String(fd.get("description") || "").trim() || null,
    priceFrom: Number(fd.get("priceFrom")) || null, active: fd.get("active") !== "off",
  };
  if (id) await db.service.updateMany({ where: { id, providerId: u.id }, data });
  else await db.service.create({ data: { ...data, providerId: u.id } });
  refresh();
}

export async function toggleService(fd: FormData) {
  const u = await requireUser("provider");
  const s = await db.service.findFirst({ where: { id: Number(fd.get("id")), providerId: u.id } });
  if (s) await db.service.update({ where: { id: s.id }, data: { active: !s.active } });
  refresh();
}

export async function saveProduct(fd: FormData) {
  const u = await requireUser("provider");
  const id = Number(fd.get("id")) || null;
  const photoId = await saveUpload(fd.get("photo"), u.id, true, true);
  const data = {
    name: String(fd.get("name")).trim(), description: String(fd.get("description") || "").trim() || null,
    price: Number(fd.get("price")), stock: Number(fd.get("stock")) || 0, ...(photoId ? { photoId } : {}),
  };
  if (id) await db.product.updateMany({ where: { id, providerId: u.id }, data });
  else await db.product.create({ data: { ...data, providerId: u.id } });
  refresh();
}

export async function toggleProduct(fd: FormData) {
  const u = await requireUser("provider");
  const p = await db.product.findFirst({ where: { id: Number(fd.get("id")), providerId: u.id } });
  if (p) await db.product.update({ where: { id: p.id }, data: { active: !p.active } });
  refresh();
}

export async function updateOrder(fd: FormData) {
  const u = await requireUser("provider");
  const status = String(fd.get("status"));
  if (!["confirmed", "delivered", "cancelled"].includes(status)) throw new Error("Bad status");
  const o = await db.order.findFirst({ where: { id: Number(fd.get("id")), providerId: u.id } });
  if (!o) throw new Error("Order not found");
  await db.order.update({ where: { id: o.id }, data: { status } });
  if (status === "cancelled" && o.status !== "cancelled") {
    await db.product.update({ where: { id: o.productId }, data: { stock: { increment: o.quantity } } });
  }
  await notify(o.buyerId, `Your order #${o.id} is ${status}.`, "/orders");
  refresh();
}

export async function saveProfile(fd: FormData) {
  const u = await requireUser("provider");
  await db.user.update({
    where: { id: u.id },
    data: {
      name: String(fd.get("name")).trim() || u.name, businessName: String(fd.get("businessName") || "").trim() || null,
      area: String(fd.get("area") || "").trim() || null, bio: String(fd.get("bio") || "").trim() || null,
      phone: normalizePhone(String(fd.get("phone") || u.phone)),
    },
  });
  refresh();
}
