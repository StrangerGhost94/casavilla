import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { provider } from "@/lib/momo";
import { PageHeader } from "@/components/ui";
import { PayForm } from "./PayForm";

export default async function PayPage({ params }: { params: Promise<{ chargeId: string }> }) {
  const u = await requireUser("tenant");
  const { chargeId } = await params;
  const c = await db.charge.findFirst({ where: { id: Number(chargeId), lease: { tenantId: u.id } } });
  if (!c) notFound();
  const row = { c };
  const balance = row.c.amount - row.c.paid;
  return (
    <div className="max-w-lg">
      <PageHeader title="Pay with Mobile Money" subtitle={`${row.c.description} · balance ${ugx(balance)}`} />
      {balance <= 0 ? <div className="card">This charge is fully paid.</div> : (
        <div className="card">
          <PayForm chargeId={row.c.id} balance={balance} phone={u.phone} />
          {provider === "sandbox" && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">Test mode: no money will be taken. CasaVilla switches on live MTN/Airtel collection once the payment account is connected.</p>}
        </div>
      )}
    </div>
  );
}
