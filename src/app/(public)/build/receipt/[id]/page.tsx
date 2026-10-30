import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PAY_METHOD } from "@/lib/build";
import { canSeeSite, siteSummary } from "@/lib/build-sites";
import { CONTACT } from "@/lib/social";
import { Logo } from "@/components/ui";
import { PrintButton } from "@/components/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Build payment receipt", robots: { index: false } };

export default async function BuildReceipt({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const p = await db.buildPayment.findUnique({ where: { id: Number((await params).id) || 0 }, include: { stage: { select: { name: true } } } });
  if (!p || p.status !== "success") notFound();
  const sum = await siteSummary(p.siteId);
  if (!sum || !canSeeSite(u, sum.site)) notFound();
  const s = sum.site;
  // As it stood when this payment came in (later payments don't change an old receipt).
  const at = (x: { paidAt: Date | null; createdAt: Date; id: number }) => [(x.paidAt ?? x.createdAt).getTime(), x.id] as const;
  const [t0, id0] = at(p);
  const upTo = s.payments.filter((x) => x.status === "success" && (at(x)[0] < t0 || (at(x)[0] === t0 && x.id <= id0))).reduce((a, x) => a + x.amount, 0);
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Link href={`/build/my/${s.id}`} className="btn-ghost">← My project</Link>
        <PrintButton />
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-800 pb-5">
          <Logo size="md" />
          <div className="text-right text-xs text-stone-500">
            <div className="text-sm font-semibold text-stone-800">CasaVilla Property Management</div>
            <div>{CONTACT.address}</div>
            <div>{CONTACT.phones.join(" · ")}</div>
            <div>{CONTACT.email}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div><div className="text-xs font-semibold uppercase tracking-widest text-brand-700">Construction payment receipt</div><div className="text-2xl font-bold">{p.receiptNo}</div></div>
          <div className="text-sm sm:text-right"><div className="text-stone-500">Date paid</div><div className="font-semibold">{fmtDate(p.paidAt ?? p.createdAt)}</div></div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand-700 p-4">
          <div><div className="text-xs text-stone-500">Amount paid</div><div className="text-2xl font-bold text-brand-800">{ugx(p.amount)}</div></div>
          <span className="-rotate-6 rounded-lg border-2 border-brand-700 px-3 py-1 text-sm font-black uppercase tracking-[0.2em] text-brand-700">Paid</span>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-stone-500">Received from</dt><dd className="font-semibold">{s.clientName}</dd><dd className="text-stone-500">{s.clientPhone}</dd></div>
          <div><dt className="text-stone-500">Project</dt><dd className="font-semibold">{s.title}</dd><dd className="text-stone-500">{s.location}</dd></div>
          <div><dt className="text-stone-500">For</dt><dd className="font-semibold">{p.stage?.name ?? "Construction works"}</dd></div>
          <div><dt className="text-stone-500">Payment method</dt><dd className="font-semibold">{PAY_METHOD[p.method] ?? p.method}</dd><dd className="break-all text-stone-500">Ref: {p.note || p.reference}</dd></div>
        </dl>
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-200 text-sm">
          <div className="flex justify-between px-3 py-2"><span className="text-stone-500">Contract sum</span><span>{ugx(s.contractSum)}</span></div>
          <div className="flex justify-between border-t border-stone-100 px-3 py-2"><span className="text-stone-500">Paid to date (including this payment)</span><span className="font-semibold">{ugx(upTo)}</span></div>
          <div className="flex justify-between border-t border-stone-100 px-3 py-2"><span className="text-stone-500">Balance on the contract</span><span>{ugx(Math.max(0, s.contractSum - upTo))}</span></div>
        </div>
        <div className="mt-8 w-56 border-t border-stone-800 pt-1 text-xs text-stone-500">For CasaVilla Property Management</div>
        <p className="mt-6 text-center text-[11px] text-stone-400">Issued electronically by CasaVilla.</p>
      </div>
    </main>
  );
}
