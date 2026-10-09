import Link from "next/link";
import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getUser, homeFor } from "@/lib/auth";
import { tabs } from "@/lib/nav";
import { Avatar, Logo } from "./ui";
import { BottomNav } from "./NavLinks";

export async function PublicHeader() {
  const u = await getUser();
  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-stone-200/70 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/"><Logo size="sm" /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[["/listings", "Discover homes"], ["/stays", "Short stays"], ["/services", "Services"], ["/shop", "Shop"]].map(([h, l]) => (
              <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 hover:text-brand-900">{l}</Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            {u ? (
              <Link href={homeFor(u.role)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-semibold text-brand-900 hover:bg-stone-100">
                <Avatar name={u.name} className="h-8 w-8 text-xs ring-2 ring-gold-400/70" /> <span className="hidden sm:inline">My dashboard</span>
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-brand-800 hover:bg-stone-100">Sign in</Link>
                <Link href="/register" className="btn-gold btn-sm hidden px-4 py-2 sm:inline-flex">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <BottomNav tabs={tabs[u?.role ?? "guest"]} />
    </>
  );
}

export function PublicFooter() {
  return (
    <footer className="no-print web-only mt-14 bg-brand-950 pb-28 text-white/70 lg:pb-0">
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-8 px-4 py-12 text-sm md:grid-cols-3">
        <div>
          <Logo tone="light" />
          <p className="mt-4 max-w-xs">Connect. Manage. Grow. Property management for landlords, tenants and trusted service providers across Kampala.</p>
        </div>
        <div className="space-y-2.5">
          <div className="font-semibold text-gold-300">Contact</div>
          <a href="tel:+256776593482" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4" /> +256 776 593 482</a>
          <a href="tel:+256756390089" className="flex items-center gap-2 hover:text-white"><Phone className="h-4 w-4" /> +256 756 390 089</a>
          <a href="mailto:info.casavilla026@gmail.com" className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4" /> info.casavilla026@gmail.com</a>
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /> P.O. Box 214887, Rubaga Road, Kampala, Uganda</div>
        </div>
        <div className="space-y-2.5">
          <div className="font-semibold text-gold-300">Explore</div>
          <div><Link href="/listings" className="hover:text-white">Homes for rent</Link></div>
          <div><Link href="/services" className="hover:text-white">Find a service provider</Link></div>
          <div><Link href="/register?role=landlord" className="hover:text-white">List your property</Link></div>
          <div><Link href="/register?role=provider" className="hover:text-white">Become a provider</Link></div>
          <a href="https://wa.me/256776593482" className="flex items-center gap-2 hover:text-white"><MessageCircle className="h-4 w-4" /> Chat on WhatsApp</a>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/40">© {new Date().getFullYear()} CasaVilla Property Management</div>
    </footer>
  );
}
