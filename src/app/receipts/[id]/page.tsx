import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Mail } from "lucide-react";
import { homeFor, requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { receiptData } from "@/lib/receipts";
import { mailConfigured } from "@/lib/mail";
import { Logo } from "@/components/ui";
import { PrintButton, Submit } from "@/components/client";
import { emailMyReceipt } from "@/app/doc-actions";

export const metadata = { title: "Receipt" };

export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const r = await receiptData(Number((await params).id) || 0, me);
  if (!r) notFound();
  const accent = r.brand.accentColor;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={homeFor(me.role)} className="btn-ghost">← Dashboard</Link>
        <div className="flex flex-wrap gap-2">
          <a href={`/receipts/${r.p.id}/pdf`} className="btn-primary"><Download className="h-4 w-4" /> Download PDF</a>
          <PrintButton />
        </div>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 pb-5" style={{ borderColor: accent }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.brand.logoFileId ? <img src={`/api/files/${r.brand.logoFileId}`} alt={r.brand.displayName} className="h-14 w-auto" /> : <Logo size="md" />}
          <div className="text-right text-xs text-stone-500">
            <div className="text-sm font-semibold text-stone-800">{r.brand.displayName}</div>
            {r.brand.address && <div>{r.brand.address}</div>}{r.brand.phone && <div>{r.brand.phone}</div>}{r.brand.email && <div>{r.brand.email}</div>}
            {r.brand.tin && <div>TIN: {r.brand.tin}</div>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>Payment receipt</div>
            <div className="text-2xl font-bold">{r.p.receiptNo}</div>
          </div>
          <div className="text-right text-sm"><div className="text-stone-500">Date paid</div><div className="font-semibold">{fmtDate(r.p.paidAt)}</div></div>
        </div>
        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div><dt className="text-stone-500">Received from</dt><dd className="font-semibold">{r.tenant.name}</dd><dd className="text-stone-500">{r.tenant.phone}</dd></div>
          <div><dt className="text-stone-500">Property</dt><dd className="font-semibold">{r.property} · {r.unit}</dd><dd className="text-stone-500">{r.address}</dd></div>
          <div><dt className="text-stone-500">Landlord</dt><dd className="font-semibold">{r.landlord.name}</dd></div>
          <div><dt className="text-stone-500">Payment method</dt><dd className="font-semibold">{r.method}</dd><dd className="break-all text-stone-500">Ref: {r.p.reference}</dd></div>
        </dl>
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-xs text-stone-500"><tr><th className="px-3 py-2 text-left font-semibold">Description</th><th className="px-3 py-2 text-left font-semibold">Period</th><th className="px-3 py-2 text-right font-semibold">Amount</th></tr></thead>
            <tbody>
              {r.lines.map((l, i) => <tr key={i} className="border-t border-stone-100"><td className="px-3 py-2">{l.description}</td><td className="px-3 py-2 text-stone-500">{l.period}</td><td className="px-3 py-2 text-right">{ugx(l.amount)}</td></tr>)}
              {r.credit > 0 && <tr className="border-t border-stone-100"><td className="px-3 py-2" colSpan={2}>Kept as credit for upcoming rent</td><td className="px-3 py-2 text-right">{ugx(r.credit)}</td></tr>}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-200"><td colSpan={2} className="px-3 pt-3 text-right font-semibold">Total paid</td><td className="px-3 pt-3 text-right text-lg font-bold" style={{ color: accent }}>{ugx(r.p.amount)}</td></tr>
              <tr><td colSpan={2} className="px-3 pb-3 text-right text-stone-500">Balance still owed</td><td className="px-3 pb-3 text-right text-stone-500">{ugx(r.balance)}</td></tr>
            </tfoot>
          </table>
        </div>
        {r.brand.footerNote && <p className="mt-6 text-sm italic text-stone-600">{r.brand.footerNote}</p>}
        <div className="mt-8 w-56 border-t border-stone-800 pt-1 text-xs text-stone-500">{r.brand.signatoryTitle || `For ${r.brand.displayName}`}{r.brand.signatory && <div className="font-semibold text-stone-800">{r.brand.signatory}</div>}</div>
        <p className="mt-6 text-center text-[11px] text-stone-400">Issued electronically in line with section 25 of the Landlord and Tenant Act, 2022.{r.brand.showCasaVilla && " Generated by CasaVilla Property Management."}</p>
      </div>
      {me.id === r.tenant.id && (
        <form action={emailMyReceipt} className="no-print mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-sm shadow-card">
          <input type="hidden" name="id" value={r.p.id} />
          <span className="flex items-center gap-2 text-stone-600"><Mail className="h-4 w-4 text-brand-700" /> {mailConfigured() ? `Send a copy to ${me.email}` : `Email a copy to ${me.email} (sent once email is switched on)`}</span>
          <Submit className="btn-outline btn-sm" doneText="Queued">Email me</Submit>
        </form>
      )}
    </main>
  );
}
