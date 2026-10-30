import type { MetadataRoute } from "next";
import { CASAVILLA_ONLY, db } from "@/db";
import { abs, areaHref, planHref, POPULAR_AREAS, providerHref, rentHref, saleHref, SEO_KINDS, stayHref, type SeoKind } from "@/lib/seo";
import { areaListings } from "@/lib/seo-areas";

export const revalidate = 3600;

/** Every public page worth finding: the marketplace, each listing and provider, and area pages that have listings. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [units, stays, sales, providers, plans] = await Promise.all([
    db.unit.findMany({ where: { mode: "long", listed: true, status: "vacant", property: { archivedAt: null, landlord: { status: "active" } } }, select: { id: true, bedrooms: true, createdAt: true, property: { select: { type: true, location: true } } } }).catch(() => []),
    db.unit.findMany({ where: { mode: "short", listed: true, nightlyRate: { not: null }, property: { archivedAt: null, landlord: { status: "active" } } }, select: { id: true, label: true, createdAt: true, property: { select: { name: true, location: true } } } }).catch(() => []),
    db.saleListing.findMany({ where: { status: { in: ["active", "under_offer"] } }, select: { id: true, title: true, updatedAt: true } }).catch(() => []),
    db.user.findMany({ where: { role: "provider", status: "active", services: { some: { active: true, category: { notIn: CASAVILLA_ONLY } } } }, select: { id: true, name: true, businessName: true } }).catch(() => []),
    db.housePlan.findMany({ where: { published: true }, select: { id: true, title: true, updatedAt: true } }).catch(() => []),
  ]);
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"], lastModified: Date = now) => ({ url: abs(path), lastModified, changeFrequency, priority });

  // Area pages only where there's something to show (no thin pages).
  const areas: MetadataRoute.Sitemap = [];
  for (const kind of Object.keys(SEO_KINDS) as SeoKind[]) {
    for (const a of POPULAR_AREAS) {
      const n = (await areaListings(kind, a, 1).catch(() => [])).length;
      if (n) areas.push(page(areaHref(kind, a), 0.8, "daily"));
    }
  }

  return [
    page("/", 1, "daily"),
    page("/listings", 0.9, "hourly"), page("/stays", 0.8, "daily"), page("/sale", 0.8, "daily"),
    page("/build", 0.8, "weekly"), page("/build/plans", 0.7, "weekly"), page("/build/start", 0.5, "monthly"),
    page("/services", 0.7, "weekly"), page("/shop", 0.6, "weekly"), page("/list", 0.6, "monthly"),
    ...areas,
    ...units.map((u) => page(rentHref({ id: u.id, bedrooms: u.bedrooms, type: u.property.type, location: u.property.location }), 0.7, "weekly", u.createdAt)),
    ...stays.map((u) => page(stayHref(u), 0.6, "weekly", u.createdAt)),
    ...sales.map((l) => page(saleHref(l), 0.7, "weekly", l.updatedAt)),
    ...plans.map((p) => page(planHref(p), 0.6, "monthly", p.updatedAt)),
    ...providers.map((p) => page(providerHref({ id: p.id, name: p.businessName || p.name }), 0.5, "monthly")),
  ];
}
