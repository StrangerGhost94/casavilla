import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { homeFor, requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { Logo } from "@/components/ui";
import { PrintButton } from "@/components/client";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const p = await db.payment.findUnique({
    where: { id: Number(id) || 0 },
    include: {
      charge: true,
      lease: { include: { tenant: true, landlord: true, unit: { include: { property: true } } } },
    },
  });
  if (!p || p.status !== "success") notFound();
  const r = {
    p, c: p.charge, l: p.lease, unit: p.lease.unit.label, property: p.lease.unit.property.name, location: p.lease.unit.property.location,
    tenant: p.lease.tenant.name, tenantPhone: p.lease.tenant.phone, landlord: p.lease.landlord.name,
  };
  if (me.role !== "manager" && me.id !== r.l.tenantId && me.id !== r.l.landlordId) notFound();
  const methods: Record<string, string> = { mtn: "MTN Mobile Money", airtel: "Airtel Money", cash: "Cash", bank: "Bank transfer" };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="no-print mb-4 flex justify-between">
        <Link href={homeFor(me.role)} className="btn-ghost">← Dashboard</Link>
        <PrintButton />
      </div>
      <div className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-6">
          <Logo size="md" />
          <div className="text-right text-xs text-stone-500">
            <div>P.O. Box 214887, Rubaga Road</div><div>Kampala, Uganda</div>
            <div>+256 776 593 482 · +256 756 390 089</div><div>info.casavilla026@gmail.com</div>
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-gold-600">Payment receipt</div>
            <div className="text-2xl font-bold">{r.p.receiptNo}</div>
          </div>
          <div className="text-right text-sm">
            <div className="text-stone-500">Date paid</div>
            <div className="font-semibold">{fmtDate(r.p.paidAt)}</div>
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div><dt className="text-stone-500">Received from</dt><dd className="font-semibold">{r.tenant}</dd><dd className="text-stone-500">{r.tenantPhone}</dd></div>
          <div><dt className="text-stone-500">Property</dt><dd className="font-semibold">{r.property} · {r.unit}</dd><dd className="text-stone-500">{r.location}</dd></div>
          <div><dt className="text-stone-500">Landlord</dt><dd className="font-semibold">{r.landlord}</dd></div>
          <div><dt className="text-stone-500">Payment method</dt><dd className="font-semibold">{methods[r.p.method]}</dd><dd className="text-stone-500">Ref: {r.p.reference}</dd></div>
        </dl>
        <table className="table mt-6">
          <thead><tr><th>Description</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            <tr><td>{r.c.description}</td><td className="text-right">{ugx(r.p.amount)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td className="pt-3 text-right font-semibold">Total paid</td><td className="pt-3 text-right text-lg font-bold text-brand-600">{ugx(r.p.amount)}</td></tr>
            <tr><td className="text-right text-stone-500">Balance on this charge</td><td className="text-right text-stone-500">{ugx(Math.max(0, r.c.amount - r.c.paid))}</td></tr>
          </tfoot>
        </table>
        <p className="mt-8 text-center text-xs text-stone-400">Thank you. This receipt was generated electronically by CasaVilla Property Management.</p>
      </div>
    </main>
  );
}
