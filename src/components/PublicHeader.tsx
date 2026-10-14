import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getUser, homeFor } from "@/lib/auth";
import { tabs } from "@/lib/nav";
import { Avatar, Logo } from "./ui";
import { SocialLinks } from "./SocialLinks";
import { CONTACT } from "@/lib/social";
import { BottomNav } from "./NavLinks";

export async function PublicHeader() {
  const u = await getUser();
  return (
    <>
      {/* Dark like the hero and the status bar, so the iPhone clock/battery stay readable and there is no white band. */}
      <header className="no-print sticky top-0 z-30 bg-brand-950 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 md:h-16">
          <Link href="/" aria-label="CasaVilla home" className="flex items-center"><Logo tone="light" size="sm" className="[&_img]:h-7 md:[&_img]:h-9" /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[["/listings", "To rent"], ["/stays", "Short stays"], ["/sale", "For sale"], ["/services", "Services"], ["/shop", "Shop"]].map(([h, l]) => (
              <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">{l}</Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {u ? (
              <Link href={homeFor(u.role)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-white hover:bg-white/10">
                <Avatar name={u.name} className="h-8 w-8 text-xs ring-2 ring-gold-400/70" /> <span className="hidden sm:inline">{u.role === "tenant" ? "My home" : "My dashboard"}</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">Sign in</Link>
                <Link href="/list" className="rounded-lg px-3 py-2 text-sm font-semibold text-white/90 hover:bg-white/10">List a property</Link>
                <Link href="/register" className="btn-gold btn-sm px-4 py-2">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <BottomNav tabs={tabs[u?.role ?? "guest"]} />
    </>
  );
}

/** Phones don't get the full footer (the tab bar does that job); the home page ends with this instead. */
export function MobileFooter() {
  return (
    <footer className="no-print mt-10 border-t border-stone-200/80 pb-4 pt-6 text-center lg:hidden">
      <div className="text-xs font-semibold uppercase tracking-widest text-stone-500">Follow CasaVilla</div>
      <SocialLinks tone="light" className="mt-3 justify-center" />
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <a href={`tel:${CONTACT.phones[0].replace(/\s/g, "")}`} className="font-semibold text-brand-800">{CONTACT.phones[0]}</a>
        <span aria-hidden>·</span>
        <a href={`mailto:${CONTACT.email}`} className="hover:text-brand-800">{CONTACT.email}</a>
      </div>
      <div className="mt-1 text-[11px] text-stone-400">Rubaga Road, Kampala · © {new Date().getFullYear()} CasaVilla</div>
    </footer>
  );
}

export function PublicFooter() {
  return (
    <footer className="no-print web-only mt-14 hidden bg-brand-950 text-white/70 lg:block">
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-8 px-4 py-12 text-sm md:grid-cols-3">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs">Connect. Manage. Grow. Property management for landlords, tenants and trusted service providers across Kampala.</p>
          <div className="mt-5 text-xs font-semibold uppercase tracking-widest text-gold-300">Follow us</div>
          <SocialLinks className="mt-2.5" />
        </div>
        <div className="space-y-2.5">
          <div className="font-semibold text-gold-300">Contact</div>
          {CONTACT.phones.map((ph) => <a key={ph} href={`tel:${ph.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4" /> {ph}</a>)}
          <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4" /> {CONTACT.email}</a>
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {CONTACT.address}</div>
        </div>
        <div className="space-y-2.5">
          <div className="font-semibold text-gold-300">Explore</div>
          <div><Link href="/listings" className="hover:text-white">Homes for rent</Link></div>
          <div><Link href="/sale" className="hover:text-white">Land & property for sale</Link></div>
          <div><Link href="/services" className="hover:text-white">Find a service provider</Link></div>
          <div><Link href="/list" className="hover:text-white">List your property</Link></div>
          <div><Link href="/register?role=provider" className="hover:text-white">Become a provider</Link></div>
          <a href="https://wa.me/256776593482" className="flex items-center gap-2 hover:text-white"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp</a>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">© {new Date().getFullYear()} CasaVilla Property Management</div>
    </footer>
  );
}
