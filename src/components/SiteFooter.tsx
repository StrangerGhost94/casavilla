import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone, Smartphone } from "lucide-react";
import { BuildingArt, Logo } from "./ui";
import { SocialLinks } from "./SocialLinks";
import { CONTACT, tel } from "@/lib/social";
import { areaHref, type SeoKind } from "@/lib/seo";

/** Popular searches: links to the area pages people look for on Google (also how Google finds them). */
const POPULAR: { kind: SeoKind; title: string; areas: string[] }[] = [
  { kind: "houses-for-rent", title: "Houses for rent", areas: ["Kampala", "Ntinda", "Kira", "Najjera", "Kololo", "Bukoto", "Muyenga", "Kyanja", "Naalya", "Mukono", "Entebbe"] },
  { kind: "land-for-sale", title: "Land for sale", areas: ["Wakiso", "Mukono", "Kira", "Gayaza", "Entebbe", "Namugongo", "Seeta", "Kasangati", "Kajjansi"] },
  { kind: "short-stays", title: "Short stays", areas: ["Kampala", "Entebbe", "Kololo", "Ntinda", "Muyenga", "Munyonyo", "Bugolobi"] },
  { kind: "houses-for-sale", title: "Houses for sale", areas: ["Kampala", "Kira", "Najjera", "Mukono", "Entebbe", "Wakiso", "Namugongo"] },
];

const BUILD_LINKS = [
  ["/build", "House construction"], ["/build/plans", "House plans"], ["/build/plans?style=bungalow", "Bungalows"],
  ["/build/plans?style=storeyed", "Storeyed houses"], ["/build/plans?style=apartments", "Apartment blocks"], ["/build/start?kind=renovation", "Renovations"],
] as const;

/** One compact row per kind — "Houses for rent: Kampala · Ntinda · Kira…" — same links, a fraction of the space. */
export function PopularSearches() {
  const row = "flex flex-wrap items-baseline gap-x-1 gap-y-1";
  const label = "mr-2 shrink-0 text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-300";
  const link = "transition hover:text-white";
  return (
    <div className="space-y-2.5 text-xs leading-relaxed text-white/55">
      {POPULAR.map((g) => (
        <nav key={g.kind} aria-label={`${g.title} by area`} className={row}>
          <span className={label}>{g.title}</span>
          {g.areas.map((a, i) => <span key={a}>{i > 0 && <span aria-hidden className="mr-1 text-white/25">·</span>}<Link href={areaHref(g.kind, a)} className={link} title={`${g.title} in ${a}`}>{a}</Link></span>)}
        </nav>
      ))}
      <nav aria-label="Building" className={row}>
        <span className={label}>Building</span>
        {BUILD_LINKS.map(([href, l], i) => <span key={href}>{i > 0 && <span aria-hidden className="mr-1 text-white/25">·</span>}<Link href={href} className={link}>{l}</Link></span>)}
      </nav>
    </div>
  );
}

const COLUMNS = [
  { title: "Explore", links: [["/listings", "Homes for rent"], ["/stays", "Short stays"], ["/sale", "Land & property for sale"], ["/build", "Build with CasaVilla"], ["/services", "Home services"], ["/shop", "Shop"]] },
  { title: "For owners", links: [["/list", "List a property"], ["/sale?kind=land", "Sell land"], ["/build/start?kind=apartments", "Build or extend"], ["/register?role=landlord", "Landlord account"], ["/register?role=provider", "Become a provider"]] },
  { title: "CasaVilla", links: [["/about", "About us"], ["/how-it-works", "How it works"], ["/get-app", "Get the app"], ["/contact", "Contact"], ["/privacy", "Privacy"], ["/terms", "Terms of use"]] },
] as const;

const heading = "text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300";

/** Computers: the full footer. (Phones use the tab bar for navigation; the home page ends with MobileFooter.) */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print web-only relative mt-16 hidden overflow-hidden bg-brand-950 text-white/70 lg:block">
      <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full text-white/[0.035]" />
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Owner call-to-action */}
        <div className="mt-10 flex items-center justify-between gap-6 rounded-3xl bg-white/[0.04] px-7 py-6 ring-1 ring-white/10">
          <div>
            <div className={heading}>Own property in Uganda?</div>
            <div className="mt-1 text-xl font-semibold text-white">Let CasaVilla find tenants, collect your rent — or build your next one.</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/list" className="btn-gold">List a property</Link>
            <a href={CONTACT.whatsapp} className="btn border border-white/20 text-white hover:bg-white/10"><MessageCircle className="h-4 w-4" /> Talk to us</a>
          </div>
        </div>

        <div className="grid grid-cols-[1.5fr_1fr_1fr_0.9fr] gap-10 py-12 text-sm">
          <div>
            <Logo tile />
            <p className="mt-4 max-w-xs leading-relaxed">Homes, land and trusted services in Uganda — and everything after you move in.</p>
            <ul className="mt-5 space-y-2.5">
              {CONTACT.phones.map((p) => <li key={p}><a href={tel(p)} className="flex items-center gap-2.5 transition hover:text-white"><Phone className="h-4 w-4 text-gold-300/80" /> {p}</a></li>)}
              <li><a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2.5 break-all transition hover:text-white"><Mail className="h-4 w-4 shrink-0 text-gold-300/80" /> {CONTACT.email}</a></li>
              <li>
                <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2.5 transition hover:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300/80" />
                  <span>{CONTACT.address} <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-gold-300 group-hover:text-gold-200">Map <ArrowUpRight className="h-3 w-3" /></span></span>
                </a>
              </li>
            </ul>
            <SocialLinks className="mt-5" />
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <div className={heading}>{c.title}</div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([href, label]) => <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>)}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-t border-white/10 py-8">
          <div className={`${heading} mb-3`}>Popular searches</div>
          <PopularSearches />
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 py-6 text-xs text-white/45">
          <span>© {year} CasaVilla Property Management · Kampala, Uganda</span>
          <span className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-gold-300/70" /> Pay with MTN & Airtel Mobile Money</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Phones: the home page ends with this compact card — contact, the company pages, and where we are. */
export function MobileFooter() {
  const btn = "flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] py-3 text-xs font-semibold ring-1 ring-white/10 active:bg-white/15";
  return (
    <footer className="no-print relative mt-12 overflow-hidden rounded-3xl bg-brand-950 px-5 pb-6 pt-7 text-white lg:hidden">
      <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full text-white/[0.05]" />
      <div className="relative">
        <Logo tile size="sm" />
        <p className="mt-3 text-sm leading-relaxed text-white/65">Homes, land and trusted services in Uganda — and everything after you move in.</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <a href={tel(CONTACT.phones[0])} className={btn}><Phone className="h-4 w-4 text-gold-300" /> Call</a>
          <a href={CONTACT.whatsapp} className={btn}><MessageCircle className="h-4 w-4 text-gold-300" /> WhatsApp</a>
          <a href={`mailto:${CONTACT.email}`} className={btn}><Mail className="h-4 w-4 text-gold-300" /> Email</a>
        </div>

        <nav aria-label="CasaVilla" className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm text-white/75">
          {[["/about", "About us"], ["/how-it-works", "How it works"], ["/get-app", "Get the app"], ["/list", "List a property"], ["/contact", "Contact"], ["/privacy", "Privacy & terms"]].map(([href, l]) => (
            <Link key={href} href={href} className="active:text-white">{l}</Link>
          ))}
        </nav>

        <details className="mt-5 rounded-2xl bg-white/[0.05] p-3 text-white/70 ring-1 ring-white/10">
          <summary className="cursor-pointer list-none text-xs font-semibold text-white">Popular searches</summary>
          <div className="mt-3"><PopularSearches /></div>
        </details>

        <SocialLinks size="sm" className="mt-5" />

        <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-start gap-2 text-xs text-white/60">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/80" /> <span>{CONTACT.address} · <span className="font-semibold text-gold-300">Map</span></span>
        </a>
        <div className="mt-5 border-t border-white/10 pt-4 text-[11px] text-white/40">© {new Date().getFullYear()} CasaVilla Property Management</div>
      </div>
    </footer>
  );
}
