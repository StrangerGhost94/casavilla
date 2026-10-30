import { provider } from "@/lib/momo";
import { AutoRefresh, Submit } from "./client";

/**
 * "Approve on your phone…" while a Mobile Money prompt is open: refreshes until it settles; in test mode,
 * buttons to play the customer's answer. Shared by rent, short-stay and building payments.
 */
export function PayPending({ reference, sandbox, title = "Approve the payment on your phone…", note = "Enter your Mobile Money PIN when prompted. This page updates automatically.", who = "customer" }: {
  reference: string; sandbox: (fd: FormData) => Promise<void>; title?: string; note?: string; who?: string;
}) {
  return (
    <div className="mt-6">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
      <div className="mt-3 font-semibold">{title}</div>
      <div className="muted">{note}</div>
      {provider !== "sandbox" && <AutoRefresh seconds={5} />}
      {provider === "sandbox" && (
        <div className="mt-5 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-800">
          <div className="mb-2 font-semibold">Test mode — simulate the {who}&apos;s response:</div>
          <div className="flex gap-2">
            <form action={sandbox}><input type="hidden" name="ref" value={reference} /><input type="hidden" name="outcome" value="approve" /><Submit className="btn-primary btn-sm">Approve payment</Submit></form>
            <form action={sandbox}><input type="hidden" name="ref" value={reference} /><input type="hidden" name="outcome" value="decline" /><Submit className="btn-outline btn-sm">Decline</Submit></form>
          </div>
        </div>
      )}
    </div>
  );
}
