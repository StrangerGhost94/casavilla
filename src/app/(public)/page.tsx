import Link from "next/link";
import { listedUnits } from "@/lib/queries";
import { SERVICE_CATEGORIES } from "@/db";
import { ugx } from "@/lib/format";
import { Photo } from "@/components/ui";

export const dynamic = "force-dynamic";

const roles = [
  { title: "Tenants", body: "Find a home, pick your landlord, pay rent by MTN or Airtel Mobile Money, get instant receipts and report repairs from your phone.", cta: "Find a home", href: "/listings" },
  { title: "Landlords", body: "List every property and unit, approve tenants, track who has paid and who owes, and send repairs to vetted providers.", cta: "List your property", href: "/register?role=landlord" },
  { title: "Service providers", body: "Cleaners, plumbers, electricians, builders, pest control and carpenters receive jobs and sell materials directly.", cta: "Join as a provider", href: "/register?role=provider" },
  { title: "CasaVilla team", body: "Oversees every property, approves landlords and providers, assigns jobs and keeps rent collection on track.", cta: "Contact us", href: "#contact" },
];

export default async function Home() {
  const homes = await listedUnits({ limit: 6 });
  return (
    <main>
      <section className="relative overflow-hidden bg-gradient-to-br from-white via-stone-50 to-brand-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-block rounded-full bg-maroon-50 px-3 py-1 text-xs font-semibold text-maroon-600">Kampala · Rubaga Road</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-stone-900 md:text-5xl">
              One home for <span className="text-brand-600">landlords</span>, <span className="text-maroon-600">tenants</span> and the people who keep properties running.
            </h1>
            <p className="mt-4 text-lg text-stone-600">Rent tracking, Mobile Money payments, leases and maintenance — all connected in one place by CasaVilla Property Management.</p>
            <form action="/listings" className="mt-6 flex max-w-md gap-2">
              <input name="q" className="input" placeholder="Search area, e.g. Rubaga, Ntinda, Kira" />
              <button className="btn-primary">Search</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link href="/register?role=landlord" className="btn-outline">I&apos;m a landlord</Link>
              <Link href="/register?role=provider" className="btn-outline">I offer a service</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[["Rent collected", "MTN & Airtel MoMo"], ["Receipts", "Issued instantly"], ["Repairs", "Tracked to done"], ["Providers", "Vetted by CasaVilla"]].map(([a, b], i) => (
              <div key={a} className={`card ${i % 2 ? "mt-6" : ""}`}>
                <div className={`h-1.5 w-10 rounded ${i % 3 ? "bg-maroon-600" : "bg-brand-500"}`} />
                <div className="mt-3 font-bold text-stone-900">{a}</div>
                <div className="muted">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-stone-900">Everyone connected</h2>
        <p className="muted mt-1">Each person gets their own dashboard, and everything links together.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <div key={r.title} className="card flex flex-col">
              <div className="font-bold text-stone-900">{r.title}</div>
              <p className="mt-2 flex-1 text-sm text-stone-600">{r.body}</p>
              <Link href={r.href} className="link mt-4 text-sm">{r.cta} →</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Available now</h2>
            <p className="muted mt-1">Vacant units from CasaVilla landlords.</p>
          </div>
          <Link href="/listings" className="link text-sm">See all →</Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {homes.length === 0 && <div className="muted">New listings coming soon.</div>}
          {homes.map((h) => (
            <Link key={h.id} href={`/listings/${h.id}`} className="card overflow-hidden p-0 hover:shadow-md">
              <Photo id={h.photoId} alt={h.property} className="h-44 w-full" />
              <div className="p-4">
                <div className="font-semibold text-stone-900">{h.property} · {h.label}</div>
                <div className="muted">{h.location} · {h.bedrooms} bed</div>
                <div className="mt-2 font-bold text-brand-600">{ugx(h.rent)}<span className="text-xs font-normal text-stone-500"> / month</span></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-stone-900">Services for your property</h2>
        <div className="mt-5 flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((c) => (
            <Link key={c} href={`/services?category=${encodeURIComponent(c)}`} className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium hover:border-brand-500 hover:text-brand-600">{c}</Link>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4">
        <div className="rounded-2xl bg-brand-700 p-8 text-white md:flex md:items-center md:justify-between">
          <div>
            <div className="text-2xl font-bold">Talk to CasaVilla</div>
            <p className="mt-1 text-brand-100">Want us to manage your property? Call, email or WhatsApp us.</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 md:mt-0">
            <a href="https://wa.me/256776593482" className="btn bg-white text-brand-700 hover:bg-brand-50">WhatsApp</a>
            <a href="tel:+256776593482" className="btn border border-white/40 text-white hover:bg-white/10">+256 776 593 482</a>
          </div>
        </div>
      </section>
    </main>
  );
}
