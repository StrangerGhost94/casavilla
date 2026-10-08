import Link from "next/link";
import { getUser, homeFor } from "@/lib/auth";
import { Logo } from "./ui";

export async function PublicHeader() {
  const u = await getUser();
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2">
        <Link href="/"><Logo className="h-12" /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/listings" className="btn-ghost">Homes for rent</Link>
          <Link href="/services" className="btn-ghost">Service providers</Link>
          <Link href="/shop" className="btn-ghost">Shop</Link>
        </nav>
        <div className="flex items-center gap-2">
          {u ? (
            <Link href={homeFor(u.role)} className="btn-primary">My dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/register" className="btn-primary">Join</Link>
            </>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        <Link href="/listings" className="btn-ghost btn-sm">Homes</Link>
        <Link href="/services" className="btn-ghost btn-sm">Providers</Link>
        <Link href="/shop" className="btn-ghost btn-sm">Shop</Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-stone-600 md:grid-cols-3">
        <div>
          <Logo className="h-14" />
          <p className="mt-3">Property management for landlords, tenants and trusted service providers across Kampala.</p>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-stone-900">Contact</div>
          <div><a href="tel:+256776593482" className="hover:underline">+256 776 593 482</a></div>
          <div><a href="tel:+256756390089" className="hover:underline">+256 756 390 089</a></div>
          <div><a href="mailto:info.casavilla026@gmail.com" className="hover:underline">info.casavilla026@gmail.com</a></div>
          <div>P.O. Box 214887, Rubaga Road, Kampala, Uganda</div>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-stone-900">Explore</div>
          <div><Link href="/listings" className="hover:underline">Homes for rent</Link></div>
          <div><Link href="/services" className="hover:underline">Find a service provider</Link></div>
          <div><Link href="/register?role=landlord" className="hover:underline">List your property</Link></div>
          <div><Link href="/register?role=provider" className="hover:underline">Become a provider</Link></div>
          <div><a href="https://wa.me/256776593482" className="hover:underline">Chat on WhatsApp</a></div>
        </div>
      </div>
      <div className="border-t border-stone-100 py-4 text-center text-xs text-stone-400">© {new Date().getFullYear()} CasaVilla Property Management</div>
    </footer>
  );
}
