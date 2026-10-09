import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BrandForm } from "@/components/BrandForm";
import { mailConfigured } from "@/lib/mail";

export const metadata = { title: "Receipts & documents" };
export default async function ManagerDocuments() {
  await requireUser("manager");
  const [sample, queued, sent, failed] = await Promise.all([
    db.payment.findFirst({ where: { status: "success" }, orderBy: { id: "desc" }, select: { id: true } }),
    db.emailOutbox.count({ where: { status: "queued" } }), db.emailOutbox.count({ where: { status: "sent" } }), db.emailOutbox.count({ where: { status: "failed" } }),
  ]);
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader title="Receipts & documents" subtitle="CasaVilla's default look. Landlords can set their own under their Receipts & documents page." />
      <BrandForm sampleReceiptId={sample?.id} />
      <div className="card text-sm">
        <div className="h2">Email delivery</div>
        {mailConfigured()
          ? <p className="mt-1 text-brand-700">Switched on — receipts and booking confirmations are emailed automatically.</p>
          : <p className="mt-1 text-stone-600">Not switched on yet. Receipts are queued and will send as soon as <code className="rounded bg-stone-100 px-1">RESEND_API_KEY</code> and <code className="rounded bg-stone-100 px-1">MAIL_FROM</code> are added in Railway.</p>}
        <p className="mt-2 text-xs text-stone-500">{queued} waiting · {sent} sent · {failed} failed</p>
      </div>
    </div>
  );
}
