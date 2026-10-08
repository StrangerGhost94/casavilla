import Link from "next/link";
import { Building2, ChevronRight, Home as HomeIcon, Search, UserRound, Wrench } from "lucide-react";
import { listedUnits } from "@/lib/queries";
import { SERVICE_CATEGORIES } from "@/db";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { BuildingArt, Logo, SectionTitle } from "@/components/ui";
import { PropertyCard } from "@/components/PropertyCard";

export const dynamic = "force-dynamic";

const roles = [
  { id: "tenant", title: "Tenant", body: "Find a home, pay rent, request services", icon: UserRound, tone: "bg-brand-800 text-gold-300" },
  { id: "landlord", title: "Landlord", body: "List properties, track income, manage tenants", icon: HomeIcon, tone: "bg-gold-400 text-brand-950" },
  { id: "provider", title: "Service provider", body: "Offer your services, get hired", icon: Wrench, tone: "bg-brand-800 text-gold-300" },
];

export default async function Home() {
  const homes = await listedUnits({ limit: 6 });
  return (
    <main>
      {/* Splash / hero */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/launch.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_60%]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-brand-950/90" />
        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-10 text-center md:pb-24 md:pt-16">
          <Logo tone="light" size="lg" className="animate-fade-up" />
          <h1 className="mt-8 text-2xl font-semibold drop-shadow md:text-4xl">Connect. Manage. Grow.</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/85 drop-shadow md:text-base">All your property needs in one place — rent, Mobile Money payments, leases, repairs and trusted service providers.</p>
          <form action="/listings" className="mx-auto mt-7 flex max-w-md items-center gap-2 rounded-2xl bg-white p-1.5 shadow-float">
            <Search className="ml-2.5 h-5 w-5 shrink-0 text-stone-400" />
            <input name="q" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none" placeholder="Search location, e.g. Rubaga, Kira, Ntinda" />
            <button className="btn-primary px-4 py-2">Search</button>
          </form>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/register" className="btn-gold px-6">Get started</Link>
            <Link href="/login" className="btn border border-white/30 px-6 text-white hover:bg-white/10">Sign in</Link>
          </div>
        </div>
      </section>

      <div className="relative z-10 mx-auto -mt-6 max-w-6xl rounded-t-3xl bg-cream px-4 pt-6 md:rounded-none md:pt-10">
        {/* Role picker */}
        <h2 className="text-xl font-bold text-brand-950 md:text-2xl">How do you want to use CasaVilla?</h2>
        <p className="muted mt-1">Each person gets their own dashboard, and everything links together.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {roles.map((r) => (
            <Link key={r.id} href={`/register?role=${r.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${r.tone}`}><r.icon className="h-6 w-6" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-brand-950">{r.title}</span>
                <span className="block text-xs text-stone-500">{r.body}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-stone-400" />
            </Link>
          ))}
        </div>

        {/* Featured properties */}
        <SectionTitle title="Featured properties" href="/listings" />
        {homes.length === 0 ? (
          <div className="card text-center text-sm text-stone-500">New listings coming soon.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {homes.map((h) => <PropertyCard key={h.id} h={h} />)}
          </div>
        )}

        {/* Services */}
        <SectionTitle title="Services for your property" href="/services" />
        <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-11">
          {SERVICE_CATEGORIES.map((c) => (
            <Link key={c} href={`/services?category=${encodeURIComponent(c)}`} className="flex flex-col items-center gap-2 rounded-2xl border border-stone-200/70 bg-white px-1 py-3 text-center shadow-card transition hover:border-brand-200">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><CategoryIcon category={c} /></span>
              <span className="text-[11px] font-medium leading-tight text-stone-700">{categoryLabel[c] ?? c}</span>
            </Link>
          ))}
        </div>

        {/* Better living */}
        <section id="contact" className="relative mt-10 overflow-hidden rounded-3xl bg-brand-900 p-7 text-white md:flex md:items-center md:justify-between md:p-10">
          <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-white/[0.06]" />
          <div className="relative">
            <div className="flex items-center gap-2 text-gold-300"><Building2 className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-widest">Better living starts here</span></div>
            <div className="mt-2 text-2xl font-semibold">Want CasaVilla to manage your property?</div>
            <p className="mt-1 text-sm text-white/70">Call, email or WhatsApp our team on Rubaga Road.</p>
          </div>
          <div className="relative mt-5 flex flex-wrap gap-2 md:mt-0">
            <a href="https://wa.me/256776593482" className="btn-gold">WhatsApp us</a>
            <a href="tel:+256776593482" className="btn border border-white/30 text-white hover:bg-white/10">+256 776 593 482</a>
          </div>
        </section>
      </div>
    </main>
  );
}
