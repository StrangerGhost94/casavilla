import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { provider, verifyCharge } from "@/lib/momo";
import { canSeeSite, completeBuildPayment, failBuildPayment } from "@/lib/build-sites";
import { sandboxBuildPay } from "@/app/build-site-actions";
import { AutoRefresh, Submit } from "@/components/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment status", robots: { index: false } };

export default async function BuildPay({ params }: { params: Promise<{ ref: string }> }) {
  const u = await requireUser();
  const { ref } = await params;
  const load = () => db.buildPayment.findUnique({ where: { reference: ref }, include: { site: { select: { id: true, title: true, clientId: true } }, stage: { select: { name: true } } } });
  let p = await load();
  if (!p || !canSeeSite(u, p.site)) notFound();
  if (p.status === "pending" && provider !== "sandbox") {
    const r = await verifyCharge(ref, p.amount);
    if (r === "success") await completeBuildPayment(p.id);
    if (r === "failed") await failBuildPayment(p.id);
    p = (await load())!;
  }
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <div className="card w-full">
        <div className="text-sm text-stone-500">{p.site.title}{p.stage ? ` · ${p.stage.name}` : ""}</div>
        <div className="mt-1 text-3xl font-bold">{ugx(p.amount)}</div>
        <div className="text-xs uppercase text-stone-500">{p.method} · {p.phone}</div>
        {p.status === "pending" && (
          <div className="mt-6">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
            <div className="mt-3 font-semibold">Approve the payment on your phone…</div>
            <div className="muted">Enter your Mobile Money PIN when prompted. This page updates automatically.</div>
            {provider !== "sandbox" && <AutoRefresh seconds={5} />}
            {provider === "sandbox" && (
              <div className="mt-5 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-800">
                <div className="mb-2 font-semibold">Test mode — simulate the customer&apos;s response:</div>
                <div className="flex gap-2">
                  <form action={sandboxBuildPay}><input type="hidden" name="ref" value={ref} /><input type="hidden" name="outcome" value="approve" /><Submit className="btn-primary btn-sm">Approve payment</Submit></form>
                  <form action={sandboxBuildPay}><input type="hidden" name="ref" value={ref} /><input type="hidden" name="outcome" value="decline" /><Submit className="btn-outline btn-sm">Decline</Submit></form>
                </div>
              </div>
            )}
          </div>
        )}
        {p.status === "success" && (
          <div className="mt-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-2xl text-white">✓</div>
            <div className="mt-3 font-semibold text-brand-700">Payment received</div>
            <div className="muted">Receipt {p.receiptNo}</div>
            <div className="mt-4 flex justify-center gap-2">
              <Link href={`/build/receipt/${p.id}`} className="btn-primary">View receipt</Link>
              <Link href={`/build/my/${p.site.id}`} className="btn-outline">Back to my project</Link>
            </div>
          </div>
        )}
        {p.status === "failed" && (
          <div className="mt-6">
            <div className="font-semibold text-maroon-600">Payment was not completed</div>
            <div className="muted">No money was taken. You can try again.</div>
            <Link href={`/build/my/${p.site.id}#pay`} className="btn-primary mt-4">Try again</Link>
          </div>
        )}
      </div>
    </main>
  );
}
