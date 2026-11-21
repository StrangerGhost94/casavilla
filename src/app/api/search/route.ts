import { NextResponse } from "next/server";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { roleLabel } from "@/lib/nav";
import { ugx } from "@/lib/format";

export type Hit = { group: string; label: string; sub?: string; href: string };

/** Office search: tenants (by lease), people, receipts, properties and sale listings, five of each. */
export async function GET(req: Request) {
  const me = await getUser();
  if (!me || me.role !== "manager") return NextResponse.json({ hits: [] }, { status: 404 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const has = { contains: q, mode: "insensitive" as const };
  const digits = q.replace(/\D/g, "");
  const phone = digits.length >= 4 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : [];
  const num = /^#?\d+$/.test(q) ? Number(q.replace("#", "")) : null;
  const [leases, people, payments, properties, listings] = await Promise.all([
    db.lease.findMany({
      where: { status: "active", OR: [{ tenant: { name: has } }, { tenant: { OR: phone.length ? phone : [{ id: -1 }] } }, { unit: { label: has } }] },
      take: 5, orderBy: { startDate: "desc" },
      select: { id: true, rent: true, tenant: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } },
    }),
    db.user.findMany({
      where: { OR: [{ name: has }, { email: has }, { businessName: has }, ...phone] }, take: 5, orderBy: { name: "asc" },
      select: { id: true, name: true, businessName: true, role: true, superAdmin: true, status: true },
    }),
    db.payment.findMany({
      where: { status: { in: ["success", "reversed"] }, OR: [{ receiptNo: has }, { reference: has }] }, take: 5, orderBy: { paidAt: "desc" },
      select: { id: true, receiptNo: true, amount: true, method: true, tenant: { select: { name: true } } },
    }),
    db.property.findMany({
      where: { archivedAt: null, OR: [{ name: has }, { location: has }] }, take: 5, orderBy: { name: "asc" },
      select: { id: true, name: true, location: true },
    }),
    db.saleListing.findMany({
      where: { OR: [{ title: has }, { location: has }, ...(num ? [{ id: num }] : [])] }, take: 5, orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, location: true, status: true },
    }),
  ]);
  const hits: Hit[] = [
    ...leases.map((l) => ({ group: "Tenants", label: l.tenant.name, sub: `${l.unit.property.name} · ${l.unit.label} · ${ugx(l.rent)}/month`, href: `/manager/tenants/${l.id}` })),
    ...people.map((u) => ({ group: "People", label: u.businessName || u.name, sub: `${roleLabel(u)}${u.status !== "active" ? ` · ${u.status}` : ""}`, href: `/manager/people/${u.id}` })),
    ...payments.map((p) => ({ group: "Receipts", label: p.receiptNo ?? `Payment #${p.id}`, sub: `${p.tenant.name} · ${ugx(p.amount)} · ${p.method}`, href: `/receipts/${p.id}` })),
    ...properties.map((p) => ({ group: "Properties", label: p.name, sub: p.location, href: `/manager/properties/${p.id}` })),
    ...listings.map((l) => ({ group: "For sale", label: l.title, sub: `${l.location} · ${l.status.replace("_", " ")}`, href: `/manager/sale/${l.id}` })),
  ];
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "private, no-store" } });
}
