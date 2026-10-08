import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, periodLabel, ugx } from "@/lib/format";
import { provider } from "@/lib/momo";
import { Badge, Photo, SectionTitle } from "@/components/ui";
import { PayForm } from "./PayForm";

export default async function PayPage({ params }: { params: Promise<{ chargeId: string }> }) {
  const u = await requireUser("tenant");
  const { chargeId } = await params;
  const c = await db.charge.findFirst({
    where: { id: Number(chargeId), lease: { tenantId: u.id } },
    include: { lease: { include: { unit: { include: { property: true } } } } },
  });
  if (!c) notFound();
  const balance = c.amount - c.paid;
  const property = c.lease.unit.property;
  const history = await db.charge.findMany({ where: { leaseId: c.leaseId, status: "paid" }, orderBy: { dueDate: "desc" }, take: 4 });

  return (
    <div className="mx-auto max-w-lg">
      <div className="card flex items-center gap-3 p-4">
        <Photo id={property.photoId} alt={property.name} className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <div className="truncate font-semibold text-brand-950">{property.name}</div>
          <div className="text-xs text-stone-500">Unit {c.lease.unit.label} · {c.description}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-stone-500">{c.paid > 0 ? "Balance" : "Rent amount"}</div>
          <div className="text-xl font-bold text-brand-950">{ugx(balance)}</div>
        </div>
        <div>
          <div className="text-xs text-stone-500">Due date</div>
          <div className="text-xl font-bold text-brand-950">{fmtDate(c.dueDate)}</div>
        </div>
      </div>

      {balance <= 0 ? (
        <div className="card mt-4 text-sm">This charge is fully paid. <Link href="/tenant/rent" className="link">See receipts</Link></div>
      ) : (
        <div className="mt-4">
          <PayForm chargeId={c.id} balance={balance} phone={u.phone} />
          {provider === "sandbox" && <p className="mt-4 rounded-xl border border-gold-200 bg-gold-50 p-3 text-xs text-gold-700">Test mode: no money will be taken. CasaVilla switches on live MTN/Airtel collection once the payment account is connected.</p>}
        </div>
      )}

      {history.length > 0 && (
        <>
          <SectionTitle title="Payment history" href="/tenant/rent" />
          <div className="card divide-y divide-stone-100 p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-stone-700">{/^\d{4}-\d{2}$/.test(h.period) ? periodLabel(h.period) : h.description}</span>
                <span className="flex items-center gap-2 font-medium text-stone-800">{ugx(h.amount)} <Badge>paid</Badge></span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
