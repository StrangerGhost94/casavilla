import Link from "next/link";
import { BadgeCheck, Calculator, ChevronRight, ClipboardCheck, DraftingCompass, FileCheck2, HardHat, Hammer, MessageCircle, Phone, Trees } from "lucide-react";
import { db } from "@/db";
import { BUILD_SERVICES, BUILD_STEPS } from "@/lib/build";
import { CONTACT, tel } from "@/lib/social";
import { ORG_ID, abs, breadcrumbLd, planHref } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { PlanCard, ProjectCard } from "@/components/BuildCards";

export const revalidate = 600;
export const metadata = {
  title: "House Construction, Building Plans & Approvals in Kampala, Uganda",
  description: "Build with CasaVilla: architectural house plans, building approval from KCCA or your municipality, bills of quantities, and construction of houses, apartments and commercial buildings in Kampala, Wakiso, Mukono and across Uganda. Free consultation.",
  alternates: { canonical: "/build" },
};

const ICONS = { plans: DraftingCompass, approval: FileCheck2, costing: Calculator, build: HardHat, renovate: Hammer, supervise: ClipboardCheck } as const;

const FAQS: [string, string][] = [
  ["How much does it cost to build a house in Uganda?", "It depends on the size, the finishes and the plot — a sloping or rocky site costs more to build on. Each ready-made CasaVilla plan shows an estimated build cost. For your own design, we give a fixed quote with a bill of quantities after a free site visit."],
  ["Do you handle building approval?", "Yes. We prepare the architectural and structural drawings and submit them for approval to KCCA or your municipality or town council, and follow them up until the permit is issued."],
  ["Can I pay in stages?", "Yes. The quote is split into stages — foundation, walls, roofing, finishing — and you pay as each stage is reached, with photo updates from the site."],
  ["Can you build on a plot I buy through CasaVilla?", "Yes. Every plot for sale on CasaVilla has a “Build on this plot” button. We can check the title and the site before you buy, then design and build."],
  ["Can I buy just the house plans?", "Yes. Buy any ready-made plan as it is, ask us to adjust it, or have us draw a new one for your plot. Plans can be bought without asking us to build."],
  ["Do you build rental apartments?", "Yes — apartment blocks, row houses and rental units. When they're finished, CasaVilla can find tenants and manage them for you."],
];

export default async function Build() {
  const [plans, projects, nPlans] = await Promise.all([
    db.housePlan.findMany({ where: { published: true }, orderBy: [{ sort: "asc" }, { id: "desc" }], take: 6, include: { _count: { select: { photos: true } } } }),
    db.buildProject.findMany({ where: { published: true }, orderBy: [{ year: "desc" }, { id: "desc" }], take: 9 }),
    db.housePlan.count({ where: { published: true } }),
  ]);
  const wa = `https://wa.me/256776593482?text=${encodeURIComponent("Hello CasaVilla, I'd like to talk about building.")}`;

  return (
    <main>
      <JsonLd data={[
        breadcrumbLd([["Home", "/"], ["Build with CasaVilla", "/build"]]),
        {
          "@context": "https://schema.org", "@type": "Service", "@id": abs("/build#service"),
          name: "Design & build with CasaVilla", serviceType: "House construction", url: abs("/build"),
          description: metadata.description, provider: { "@id": ORG_ID }, areaServed: { "@type": "Country", name: "Uganda" },
          ...(plans.length ? { hasOfferCatalog: { "@type": "OfferCatalog", name: "House plans", itemListElement: plans.map((p) => ({ "@type": "Offer", url: abs(planHref(p)), price: p.price, priceCurrency: "UGX", itemOffered: { "@type": "Product", name: p.title } })) } } : {}),
        },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      ]} />

      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[30%_55%] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/30" />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-6 md:pb-16 md:pt-14">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Build with CasaVilla</div>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight md:text-5xl">Your home, designed and built by CasaVilla</h1>
          <p className="mt-3 max-w-xl text-white/80 md:text-lg">House plans, approvals, construction and renovation — one team from the first drawing to the keys.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/build/start" className="btn-gold">Start your project</Link>
            <Link href="/build/plans" className="btn rounded-xl bg-white/10 px-4 py-2.5 font-semibold text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/20">See house plans{nPlans ? ` (${nPlans})` : ""}</Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/85">
            {["Free consultation & site visit", "Fixed quote, paid in stages", "Approvals handled for you"].map((t) => (
              <li key={t} className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-gold-300" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        <section className="mt-8">
          <h2 className="h2">What we do</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BUILD_SERVICES.map((s) => {
              const I = ICONS[s.icon];
              return (
                <div key={s.title} className="flex gap-3 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-card">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><I className="h-5 w-5" /></span>
                  <div className="min-w-0"><div className="font-semibold text-brand-950">{s.title}</div><p className="mt-0.5 text-sm leading-relaxed text-stone-600">{s.text}</p></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="h2">Ready-made house plans</h2>
              <p className="text-sm text-stone-500">Buy the drawings, or have us build it for you. Every plan can be adjusted.</p>
            </div>
            {plans.length > 0 && <Link href="/build/plans" className="flex shrink-0 items-center gap-0.5 text-sm font-semibold text-brand-700">See all <ChevronRight className="h-4 w-4" /></Link>}
          </div>
          {plans.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{plans.map((p) => <PlanCard key={p.id} p={p} />)}</div>
          ) : (
            <div className="mt-3 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-8 text-center text-sm text-stone-600">
              Our plan catalogue is being added. <Link href="/build/start?kind=plans" className="link">Ask for a plan drawn for your plot</Link> — it&apos;s the best fit anyway.
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl bg-white p-5 shadow-card md:p-8">
          <h2 className="h2">How it works</h2>
          <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BUILD_STEPS.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-900 text-sm font-bold text-gold-300">{i + 1}</span>
                <div><div className="font-semibold text-brand-950">{t}</div><p className="text-sm text-stone-600">{d}</p></div>
              </li>
            ))}
          </ol>
          <Link href="/build/start" className="btn-primary mt-6">Book a free consultation</Link>
        </section>

        {projects.length > 0 && (
          <section className="mt-10">
            <h2 className="h2">Our work</h2>
            <p className="text-sm text-stone-500">Homes and buildings CasaVilla has designed and built.</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
          </section>
        )}

        <section className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link href="/sale?kind=land" className="group flex items-center gap-4 rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card hover:border-brand-200">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-50 text-gold-700"><Trees className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1"><div className="font-semibold text-brand-950">Need a plot first?</div><p className="text-sm text-stone-600">Land for sale, reviewed by CasaVilla — with titles checked on request.</p></div>
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 group-hover:text-brand-700" />
          </Link>
          <Link href="/list" className="group flex items-center gap-4 rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card hover:border-brand-200">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><HardHat className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1"><div className="font-semibold text-brand-950">Building to rent out?</div><p className="text-sm text-stone-600">When it&apos;s done, CasaVilla finds tenants, collects the rent and looks after it.</p></div>
            <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 group-hover:text-brand-700" />
          </Link>
        </section>

        <section className="mt-10">
          <h2 className="h2">Questions about building</h2>
          <div className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200/70 bg-white">
            {FAQS.map(([q, a]) => (
              <details key={q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-stone-800">{q}</summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mb-10 mt-10 flex flex-col items-start gap-4 rounded-3xl bg-brand-900 p-6 text-white md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">Thinking of building?</div>
            <p className="text-sm text-white/75">Tell us what and where. The first consultation and the site visit are free.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/build/start" className="btn-gold">Start your project</Link>
            <a href={wa} className="btn rounded-xl bg-white/10 px-4 py-2.5 font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
            <a href={tel(CONTACT.phones[0])} className="btn rounded-xl bg-white/10 px-4 py-2.5 font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"><Phone className="h-4 w-4" /> Call</a>
          </div>
        </section>
      </div>
    </main>
  );
}
