"use server";
import { revalidatePath } from "next/cache";
import { db, SERVICE_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { saveUpload } from "@/lib/uploads";
import { normalizePhone } from "@/lib/format";
import { fail } from "@/lib/flash";
import { advanceOrder } from "@/lib/orders";
import { id, int, oneOf, optInt, reqText, text } from "@/lib/validate";

const refresh = () => revalidatePath("/", "layout");

export async function saveService(fd: FormData) {
  const u = await requireUser("provider");
  const sid = id(fd) || null;
  const data = {
    category: await oneOf(fd, "category", SERVICE_CATEGORIES, "category"),
    title: await reqText(fd, "title", "a service name", { max: 120 }),
    description: await text(fd, "description", "the description", { optional: true, max: 2000 }),
    priceFrom: await optInt(fd, "priceFrom", "the starting price", { min: 0, max: 100_000_000 }),
    active: fd.get("active") !== "off",
  };
  if (sid) {
    const r = await db.service.updateMany({ where: { id: sid, providerId: u.id }, data });
    if (!r.count) return fail("Service not found");
  } else {
    const same = await db.service.findFirst({ where: { providerId: u.id, title: { equals: data.title, mode: "insensitive" } } });
    if (same) return fail(`You already list "${same.title}"`);
    await db.service.create({ data: { ...data, providerId: u.id } });
  }
  refresh();
}

export async function toggleService(fd: FormData) {
  const u = await requireUser("provider");
  const s = await db.service.findFirst({ where: { id: id(fd), providerId: u.id } });
  if (s) await db.service.update({ where: { id: s.id }, data: { active: !s.active } });
  refresh();
}

export async function saveProduct(fd: FormData) {
  const u = await requireUser("provider");
  const pid = id(fd) || null;
  const data = {
    name: await reqText(fd, "name", "the item name", { max: 120 }),
    description: await text(fd, "description", "the description", { optional: true, max: 2000 }),
    price: await int(fd, "price", "the price", { min: 100, max: 100_000_000 }),
    stock: await int(fd, "stock", "the stock", { min: 0, max: 100_000, fallback: 0 }),
  };
  if (pid && !(await db.product.findFirst({ where: { id: pid, providerId: u.id } }))) return fail("Item not found");
  const photoId = await saveUpload(fd.get("photo"), u.id, true, true);
  const full = { ...data, ...(photoId ? { photoId } : {}) };
  if (pid) await db.product.update({ where: { id: pid }, data: full });
  else await db.product.create({ data: { ...full, providerId: u.id } });
  refresh();
}

export async function toggleProduct(fd: FormData) {
  const u = await requireUser("provider");
  const p = await db.product.findFirst({ where: { id: id(fd), providerId: u.id } });
  if (p) await db.product.update({ where: { id: p.id }, data: { active: !p.active } });
  refresh();
}

export async function updateOrder(fd: FormData) {
  const u = await requireUser("provider");
  const status = await oneOf(fd, "status", ["confirmed", "delivered", "cancelled"] as const, "status");
  await advanceOrder(id(fd), status, u.id, u.id);
  refresh();
}

export async function saveProfile(fd: FormData) {
  const u = await requireUser("provider");
  const phone = normalizePhone(String(fd.get("phone") || u.phone));
  if (!/^\+256\d{9}$/.test(phone)) return fail("Enter a valid Ugandan phone number");
  await db.user.update({
    where: { id: u.id },
    data: {
      name: await reqText(fd, "name", "your name", { max: 100 }),
      businessName: await text(fd, "businessName", "the business name", { optional: true, max: 120 }),
      area: await text(fd, "area", "your area", { optional: true, max: 120 }),
      bio: await text(fd, "bio", "the bio", { optional: true, max: 1500 }),
      phone,
    },
  });
  refresh();
}
