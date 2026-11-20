import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { LeaseDetail } from "@/components/Portfolio";
import { History } from "@/components/History";

export default async function ManagerLease({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const id = Number((await params).id) || 0;
  // The lease, its charges and its payments, together.
  const [charges, payments] = await Promise.all([
    db.charge.findMany({ where: { leaseId: id }, select: { id: true } }),
    db.payment.findMany({ where: { leaseId: id }, select: { id: true } }),
  ]);
  return (
    <>
      <LeaseDetail id={id} viewer={u} base="/manager/tenants" />
      <div className="mx-auto mt-6 max-w-5xl">
        <History refs={[{ entity: "lease", ids: [id] }, { entity: "charge", ids: charges.map((c) => c.id) }, { entity: "payment", ids: payments.map((p) => p.id) }]} />
      </div>
    </>
  );
}
