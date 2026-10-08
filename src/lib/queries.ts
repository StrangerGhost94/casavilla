import "server-only";
import { db } from "@/db";

export async function listedUnits(f: { q?: string; max?: number; beds?: number; limit?: number } = {}) {
  const rows = await db.unit.findMany({
    where: {
      listed: true, status: "vacant",
      rent: f.max ? { lte: f.max } : undefined,
      bedrooms: f.beds ? { gte: f.beds } : undefined,
      property: {
        landlord: { status: "active" },
        ...(f.q ? { OR: [{ location: { contains: f.q, mode: "insensitive" } }, { name: { contains: f.q, mode: "insensitive" } }] } : {}),
      },
    },
    include: { property: { include: { landlord: { select: { name: true } } } } },
    orderBy: { id: "desc" }, take: f.limit ?? 60,
  });
  return rows.map((u) => ({
    id: u.id, label: u.label, rent: u.rent, bedrooms: u.bedrooms,
    propertyId: u.property.id, property: u.property.name, type: u.property.type, location: u.property.location,
    photoId: u.property.photoId, landlord: u.property.landlord.name,
  }));
}

export async function activeProviders(category?: string) {
  const list = await db.user.findMany({
    where: { role: "provider", status: "active", services: { some: { active: true, ...(category ? { category } : {}) } } },
    include: { services: { where: { active: true } } },
    orderBy: { id: "asc" },
  });
  return list.map((p) => {
    const prices = p.services.map((s) => s.priceFrom).filter((n): n is number => n != null);
    return {
      id: p.id, name: p.businessName || p.name, area: p.area, bio: p.bio,
      categories: new Set(p.services.map((s) => s.category)),
      from: prices.length ? Math.min(...prices) : null,
    };
  });
}

export async function shopProducts(providerId?: number) {
  const rows = await db.product.findMany({
    where: { active: true, provider: { status: "active" }, ...(providerId ? { providerId } : {}) },
    include: { provider: { select: { id: true, name: true, businessName: true } } },
    orderBy: { id: "desc" },
  });
  return rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, price: p.price, stock: p.stock, photoId: p.photoId,
    providerId: p.provider.id, seller: p.provider.businessName, sellerName: p.provider.name,
  }));
}
