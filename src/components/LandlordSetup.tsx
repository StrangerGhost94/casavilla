import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { db, type User } from "@/db";

/**
 * "Get set up": the few steps that make CasaVilla work for a new landlord, each linking to where it's done.
 * Disappears once everything is in place.
 */
export async function LandlordSetup({ u }: { u: User }) {
  const [first, units, tenants, payout] = await Promise.all([
    db.property.findFirst({ where: { landlordId: u.id, archivedAt: null }, orderBy: { id: "asc" }, select: { id: true } }),
    db.unit.count({ where: { property: { landlordId: u.id, archivedAt: null } } }),
    db.lease.count({ where: { landlordId: u.id } }).then(async (n) => n + await db.tenantLink.count({ where: { landlordId: u.id } })),
    db.payoutAccount.findUnique({ where: { landlordId: u.id }, select: { landlordId: true } }),
  ]);
  const steps: { done: boolean; title: string; why: string; href: string }[] = [
    { done: !!u.phoneVerifiedAt, title: "Confirm your phone number", why: "So tenants can find you and you can sign in with a code.", href: "/profile" },
    { done: !!first, title: "Add your first property", why: "The building or compound: name, location and photos.", href: "/landlord/properties/new" },
    { done: units > 0, title: "Add its units", why: "Each room, apartment or house you rent out, with its rent.", href: first ? `/landlord/properties/${first.id}` : "/landlord/properties/new" },
    { done: tenants > 0, title: "Bring in your tenants", why: "Invite current tenants by WhatsApp, or list vacant units to find new ones.", href: "/landlord/tenants#invite" },
    { done: !!payout, title: "Say where your rent goes", why: "Your Mobile Money number or bank account for payouts.", href: "/landlord/payouts" },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (!left) return null;
  return (
    <section className="card mt-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-semibold text-brand-950">Get set up</div>
          <div className="text-xs text-stone-500">{steps.length - left} of {steps.length} done — a few minutes and you&apos;re collecting rent in the app.</div>
        </div>
        <div className="h-2 w-24 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${((steps.length - left) / steps.length) * 100}%` }} /></div>
      </div>
      <ol className="mt-3 divide-y divide-stone-100">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Link href={s.href} className={`flex items-center gap-3 py-2.5 ${s.done ? "pointer-events-none" : "group"}`} aria-disabled={s.done}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-800"}`}>{s.done ? <Check className="h-4 w-4" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${s.done ? "text-stone-400 line-through" : "text-brand-950"}`}>{s.title}</span>
                {!s.done && <span className="block text-xs text-stone-500">{s.why}</span>}
              </span>
              {!s.done && <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 group-hover:text-brand-700" />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
