import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { BuildingArt, Logo } from "./ui";
import { SocialLinks } from "./SocialLinks";
import { CONTACT, tel } from "@/lib/social";

const COLUMNS = [
  { title: "Explore", links: [["/listings", "Homes for rent"], ["/stays", "Short stays"], ["/sale", "Land & property for sale"], ["/services", "Home services"], ["/shop", "Shop"]] },
  { title: "For owners", links: [["/list", "List a property"], ["/sale?kind=land", "Sell land"], ["/register?role=landlord", "Landlord account"], ["/register?role=provider", "Become a provider"]] },
] as const;

/** Computers: the full footer. (Phones use the tab bar for navigation; the home page ends with MobileFooter.) */
export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print web-only relative mt-16 hidden overflow-hidden bg-brand-950 text-white/70 lg:block">
      <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-56 w-full text-white/[0.035]" />
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Owner call-to-action */}
        <div className="flex items-center justify-between gap-6 border-b border-white/10 py-10">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">Own property in Uganda?</div>
            <div className="mt-1.5 text-2xl font-semibold text-white">Let CasaVilla find tenants and collect your rent.</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Link href="/list" className="btn-gold">List a property</Link>
            <a href={CONTACT.whatsapp} className="btn border border-white/20 text-white hover:bg-white/10"><MessageCircle className="h-4 w-4" /> Talk to us</a>
          </div>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr_1fr_1.3fr] gap-10 py-12 text-sm">
          <div>
            <Logo tile />
            <p className="mt-4 max-w-xs leading-relaxed">Connect. Manage. Grow. Homes, land and trusted service providers — and everything after you move in.</p>
            <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Follow us</div>
            <SocialLinks className="mt-3" />
          </div>
          {COLUMNS.map((c) => (
            <nav key={c.title} aria-label={c.title}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">{c.title}</div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([href, label]) => <li key={href}><Link href={href} className="transition hover:text-white">{label}</Link></li>)}
              </ul>
            </nav>
          ))}
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Visit or call</div>
            <ul className="mt-4 space-y-3">
              {CONTACT.phones.map((p) => <li key={p}><a href={tel(p)} className="flex items-center gap-2.5 transition hover:text-white"><Phone className="h-4 w-4 text-gold-300/80" /> {p}</a></li>)}
              <li><a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2.5 break-all transition hover:text-white"><Mail className="h-4 w-4 shrink-0 text-gold-300/80" /> {CONTACT.email}</a></li>
              <li>
                <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-2.5 transition hover:text-white">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-300/80" />
                  <span>{CONTACT.address}<span className="mt-0.5 flex items-center gap-0.5 text-xs font-semibold text-gold-300 group-hover:text-gold-200">Open in Maps <ArrowUpRight className="h-3 w-3" /></span></span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 py-6 text-xs text-white/45">
          <span>© {year} CasaVilla Property Management · Kampala, Uganda</span>
          <span>Rent, stays and land — paid with Mobile Money</span>
        </div>
      </div>
    </footer>
  );
}

/** Phones: the home page ends with this compact card — follow, contact, and where we are. */
export function MobileFooter() {
  return (
    <footer className="no-print relative mt-12 overflow-hidden rounded-3xl bg-brand-950 px-5 pb-6 pt-7 text-white lg:hidden">
      <BuildingArt className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full text-white/[0.05]" />
      <div className="relative">
        <Logo tile size="sm" />
        <p className="mt-3 text-sm leading-relaxed text-white/65">Homes, land and trusted services in Uganda — and everything after you move in.</p>

        <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300">Follow us</div>
        <SocialLinks size="sm" className="mt-3" />

        <div className="mt-6 grid grid-cols-3 gap-2">
          <a href={tel(CONTACT.phones[0])} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] py-3 text-xs font-semibold ring-1 ring-white/10 active:bg-white/15"><Phone className="h-4 w-4 text-gold-300" /> Call</a>
          <a href={CONTACT.whatsapp} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] py-3 text-xs font-semibold ring-1 ring-white/10 active:bg-white/15"><MessageCircle className="h-4 w-4 text-gold-300" /> WhatsApp</a>
          <a href={`mailto:${CONTACT.email}`} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.07] py-3 text-xs font-semibold ring-1 ring-white/10 active:bg-white/15"><Mail className="h-4 w-4 text-gold-300" /> Email</a>
        </div>

        <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className="mt-5 flex items-start gap-2 text-xs text-white/60">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/80" /> <span>{CONTACT.address} · <span className="font-semibold text-gold-300">Map</span></span>
        </a>
        <div className="mt-5 border-t border-white/10 pt-4 text-[11px] text-white/40">© {new Date().getFullYear()} CasaVilla Property Management</div>
      </div>
    </footer>
  );
}
