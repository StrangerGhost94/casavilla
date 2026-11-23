import Link from "next/link";
import { CheckCircle2, Trash2 } from "lucide-react";
import { getUser } from "@/lib/auth";
import { deletionBlockers, KEPT } from "@/lib/account-deletion";
import { deleteMyAccount, requestAccountDeletion } from "@/app/account-actions";
import { ConfirmSubmit, Submit } from "@/components/client";
import { CONTACT } from "@/lib/social";

export const metadata = { title: "Delete your account", description: "How to delete your CasaVilla account, what is erased and what is kept.", alternates: { canonical: "/delete-account" } };
export const dynamic = "force-dynamic";

/** Google Play's required deletion page: delete in the app, or ask CasaVilla here without signing in. */
export default async function DeleteAccount({ searchParams }: { searchParams: Promise<{ done?: string; sent?: string }> }) {
  const sp = await searchParams;
  const me = await getUser();
  const blockers = me ? await deletionBlockers(me) : [];
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-brand-950">Delete your CasaVilla account</h1>
      {sp.done && <div className="card mt-4 flex items-start gap-3 border-brand-100 bg-brand-50/60 text-sm"><CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" /><div><b>Your account is deleted.</b> Your details have been erased and you&apos;ve been signed out.</div></div>}
      {sp.sent && <div className="card mt-4 flex items-start gap-3 border-brand-100 bg-brand-50/60 text-sm"><CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" /><div><b>Request received.</b> CasaVilla will delete your account within 7 days and contact you to confirm.</div></div>}

      <section className="mt-6 space-y-2 text-sm text-stone-700">
        <h2 className="text-base font-semibold text-brand-950">What happens</h2>
        <p><b>Erased:</b> your name, email, phone number, password, ID documents, saved homes and searches, notifications, and any open applications, viewing requests and enquiries. You can no longer sign in.</p>
        <p><b>Kept, without your name, email or phone:</b> {KEPT.join("; ").toLowerCase()}. The law requires CasaVilla to keep money and tenancy records (Uganda Revenue Authority; the Landlord and Tenant Act, 2022).</p>
        <p>Deleting in the app happens straight away. A request sent below is handled within 7 days.</p>
      </section>

      {!sp.done && me && blockers.length === 0 && (
        <form action={deleteMyAccount} className="card mt-6 space-y-3 border-maroon-100 text-sm">
          <div className="flex items-center gap-2 font-semibold text-maroon-700"><Trash2 className="h-5 w-5" /> Delete {me.email}</div>
          <input name="password" type="password" required autoComplete="current-password" placeholder="Your password" aria-label="Your password" className="input" />
          <input name="confirm" required autoComplete="off" placeholder="Type DELETE" aria-label="Type DELETE to confirm" className="input" />
          <ConfirmSubmit message="Delete your account for good? This can't be undone." className="btn w-full border border-maroon-200 bg-white text-maroon-600 hover:bg-maroon-50">Delete my account</ConfirmSubmit>
        </form>
      )}
      {!sp.done && me && blockers.length > 0 && (
        <div className="card mt-6 space-y-2 border-gold-200 bg-gold-50/50 text-sm">
          <div className="font-semibold text-brand-950">This account can&apos;t be deleted straight away</div>
          <ul className="list-disc space-y-1 pl-5 text-stone-700">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          <p className="text-stone-600">Ask CasaVilla below and the office will sort it out with you.</p>
        </div>
      )}
      {!sp.done && !me && (
        <div className="card mt-6 text-sm">
          <div className="font-semibold text-brand-950">Can you sign in?</div>
          <p className="mt-1 text-stone-600">Sign in and come back here to delete your account straight away.</p>
          <Link href="/login?next=/delete-account" className="btn-primary btn-sm mt-3">Sign in</Link>
        </div>
      )}

      {!sp.done && !sp.sent && (me ? blockers.length > 0 : true) && (
        <form action={requestAccountDeletion} className="card mt-4 space-y-3 text-sm">
          <div className="font-semibold text-brand-950">{me ? "Ask CasaVilla to delete it" : "Can't sign in? Ask CasaVilla to delete it"}</div>
          {!me && <input name="contact" required maxLength={120} placeholder="Email or phone number on your account" aria-label="Email or phone number on your account" className="input" />}
          <textarea name="reason" rows={2} maxLength={500} placeholder="Anything we should know (optional)" aria-label="Anything we should know" className="input" />
          <Submit className="btn-outline btn-sm">Send request</Submit>
        </form>
      )}
      <p className="mt-6 text-xs text-stone-500">Questions: WhatsApp or call {CONTACT.phones[0]}. See also our <Link href="/privacy" className="link">privacy policy</Link>.</p>
    </main>
  );
}
