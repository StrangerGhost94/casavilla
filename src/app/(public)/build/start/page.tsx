import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { BUILD_KIND_KEYS, buildCost, type BuildKind } from "@/lib/build";
import { shortUgx, sizeText } from "@/lib/sales";
import { fileUrl } from "@/lib/file-url";
import { planHref, saleHref } from "@/lib/seo";
import { BuildRequestForm } from "@/components/BuildClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Start Your Building Project — Free Consultation",
  description: "Tell CasaVilla what you want to build and where: a house, apartments, a commercial building, a renovation or just the plans. Free consultation and site visit.",
  alternates: { canonical: "/build/start" },
};

export default async function Start({ searchParams }: { searchParams: Promise<{ plan?: string; plot?: string; kind?: string; where?: string; budget?: string }> }) {
  const sp = await searchParams;
  const [me, plan, plot] = await Promise.all([
    getUser(),
    Number(sp.plan) ? db.housePlan.findFirst({ where: { id: Number(sp.plan), published: true } }) : null,
    Number(sp.plot) ? db.saleListing.findFirst({ where: { id: Number(sp.plot), status: { in: ["active", "under_offer"] } } }) : null,
  ]);
  const kind: BuildKind = BUILD_KIND_KEYS.includes(sp.kind as BuildKind) ? (sp.kind as BuildKind)
    : plan ? (plan.style === "apartments" ? "apartments" : plan.style === "commercial" ? "commercial" : "house") : "house";
  const context = plan ? { href: planHref(plan), photoId: plan.photoId, label: "House plan", title: plan.title, sub: buildCost(plan) ? `Build cost about ${buildCost(plan)}` : shortUgx(plan.price) }
    : plot ? { href: saleHref(plot), photoId: plot.photoId, label: "Build on this plot", title: plot.title, sub: [plot.location, sizeText(plot)].filter(Boolean).join(" · ") }
    : null;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:pb-10">
      <Link href="/build" className="link text-sm">← Build with CasaVilla</Link>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-5">
        <div className="md:col-span-3">
          <h1 className="text-2xl font-bold text-brand-950 md:text-3xl">Start your project</h1>
          <p className="mt-1 text-sm text-stone-600">A few details and CasaVilla calls you back to talk it through and book a site visit.</p>
          {context && (
            <Link href={context.href} className="mt-4 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-3 hover:border-brand-200">
              <span className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-brand-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {context.photoId && <img src={fileUrl(context.photoId, 320)} alt="" className="h-full w-full object-cover" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-700">{context.label}</span>
                <span className="block truncate font-semibold text-brand-950">{context.title}</span>
                <span className="flex items-center gap-1 truncate text-xs text-stone-500">{plot && <MapPin className="h-3 w-3 shrink-0" />}{context.sub}</span>
              </span>
            </Link>
          )}
          <div className="card mt-4">
            <BuildRequestForm me={me ? { name: me.name, phone: me.phone, email: me.email } : null} kind={kind} planId={plan?.id} saleListingId={plot?.id} where={sp.where?.slice(0, 160) ?? ""} budget={Number(sp.budget) > 0 && Number(sp.budget) < 1e13 ? Math.round(Number(sp.budget)) : undefined} />
          </div>
        </div>
        <aside className="space-y-3 md:col-span-2">
          <div className="rounded-3xl bg-brand-900 p-5 text-white">
            <div className="font-semibold">What happens next</div>
            <ol className="mt-3 space-y-3 text-sm text-white/85">
              {[["We call you", "to understand what you want, your plot and your budget."], ["Site visit", "free — we check the plot, access and soil."], ["Design & quote", "plans, a bill of quantities and a fixed price, paid in stages."]].map(([t, d], i) => (
                <li key={t} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-brand-950">{i + 1}</span><span><b className="text-white">{t}</b> {d}</span></li>
              ))}
            </ol>
          </div>
          <ul className="space-y-2 rounded-3xl border border-stone-200/70 bg-white p-5 text-sm text-stone-700">
            {["Approvals from KCCA or your municipality handled", "Photo updates at every stage", "When it's done, CasaVilla can find tenants and manage it"].map((t) => (
              <li key={t} className="flex gap-2"><BadgeCheck className="h-4 w-4 shrink-0 text-brand-600" />{t}</li>
            ))}
          </ul>
        </aside>
      </div>
    </main>
  );
}
