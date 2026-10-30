import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Landmark, MessageCircle, Phone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { MOMO_MAX, canSeeSite, siteSummary } from "@/lib/build-sites";
import { CONTACT, tel } from "@/lib/social";
import { BuildPayForm } from "@/components/BuildPayForm";
import { MoneyCards, PaymentList, SiteHeader, StageList, UpdateFeed } from "@/components/BuildSiteView";

export const dynamic = "force-dynamic";
export const metadata = { title: "My building project", robots: { index: false } };

export default async function MyBuild({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser();
  const sum = await siteSummary(Number((await params).id) || 0);
  if (!sum || !canSeeSite(u, sum.site)) notFound();
  const s = sum.site;
  const payable = sum.stages.filter((st) => st.balance > 0).map((st) => ({ id: st.id, name: st.name, balance: st.balance }));
  const open = ["active", "on_hold"].includes(s.status);
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent(`Hello CasaVilla, about my building project “${s.title}”.`)}`;
  return (
    <main className="pb-24">
      <SiteHeader sum={sum} back={<Link href={u.role === "manager" ? `/manager/build/sites/${s.id}` : "/build/my"} className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white"><ArrowLeft className="h-4 w-4" /> {u.role === "manager" ? "Manage this site" : "My projects"}</Link>} />
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-5">
        <MoneyCards sum={sum} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <section><h2 className="h2 mb-3">Stages</h2><StageList sum={sum} /></section>
            <section><h2 className="h2 mb-3">Progress from the site</h2><UpdateFeed sum={sum} /></section>
          </div>
          <div className="space-y-6 lg:col-span-2">
            {open && payable.length > 0 && (
              <section id="pay" className="card scroll-mt-24 space-y-3">
                <div><div className="font-semibold text-brand-950">Make a payment</div><div className="text-xs text-stone-500">{sum.due ? `${new Intl.NumberFormat("en-UG").format(sum.due)} UGX is due for stages under way.` : "Pay ahead for a coming stage if you like."}</div></div>
                <BuildPayForm siteId={s.id} stages={payable} defaultStageId={sum.next?.id} phone={u.phone} max={MOMO_MAX} />
                <div className="flex gap-2 rounded-xl bg-stone-50 p-3 text-xs text-stone-600"><Landmark className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" /><span>Paying by bank transfer? Ask CasaVilla for the account details. We record it here when it arrives, with a receipt.</span></div>
              </section>
            )}
            <section><h2 className="h2 mb-3">Payments</h2><PaymentList sum={sum} /></section>
            <section className="card space-y-2">
              <div className="font-semibold text-brand-950">Questions about your build?</div>
              <div className="grid grid-cols-2 gap-2">
                <a href={tel(CONTACT.phones[0])} className="btn-outline"><Phone className="h-4 w-4" /> Call</a>
                <a href={wa} className="btn-outline"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
