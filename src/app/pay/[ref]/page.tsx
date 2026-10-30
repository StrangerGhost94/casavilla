import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { homeFor, requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { provider, verifyCharge } from "@/lib/momo";
import { completePayment, failPayment } from "@/lib/billing";
import { sandboxResolve } from "@/app/tenant/actions";
import { Logo } from "@/components/ui";
import { PayPending } from "@/components/PayPending";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status" };

export default async function PayStatus({ params }: { params: Promise<{ ref: string }> }) {
  const u = await requireUser();
  const { ref } = await params;
  let p = await db.payment.findUnique({ where: { reference: ref } });
  if (!p || (p.tenantId !== u.id && u.role !== "manager")) notFound();
  if (p.status === "pending" && provider !== "sandbox") {
    const r = await verifyCharge(ref, p.amount);
    if (r === "success") await completePayment(p.id);
    if (r === "failed") await failPayment(p.id);
    p = await db.payment.findUniqueOrThrow({ where: { reference: ref } });
  }
  const c = await db.charge.findUniqueOrThrow({ where: { id: p.chargeId } });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Logo />
      <div className="card mt-6 w-full">
        <div className="text-sm text-stone-500">{c.description}</div>
        <div className="mt-1 text-3xl font-bold">{ugx(p.amount)}</div>
        <div className="text-xs uppercase text-stone-500">{p.method} · {p.phone}</div>
        {p.status === "pending" && <PayPending reference={ref} sandbox={sandboxResolve} title="Waiting for you to approve on your phone…" />}
        {p.status === "success" && (
          <div className="mt-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-2xl text-white">✓</div>
            <div className="mt-3 font-semibold text-brand-700">Payment received</div>
            <div className="muted">Receipt {p.receiptNo}</div>
            <Link href={`/receipts/${p.id}`} className="btn-primary mt-4">View receipt</Link>
          </div>
        )}
        {p.status === "failed" && (
          <div className="mt-6">
            <div className="font-semibold text-maroon-600">Payment was not completed</div>
            <div className="muted">No money was taken. You can try again.</div>
            <Link href={`/tenant/pay/${p.chargeId}`} className="btn-primary mt-4">Try again</Link>
          </div>
        )}
      </div>
      <Link href={homeFor(u.role)} className="btn-ghost mt-4">Back to dashboard</Link>
    </main>
  );
}
