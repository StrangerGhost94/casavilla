import Link from "next/link";
import { Heart } from "lucide-react";
import { getUser, homeFor } from "@/lib/auth";
import { tabs } from "@/lib/nav";
import { Avatar, Logo } from "./ui";
import { BottomNav } from "./NavLinks";
import { NotificationBell } from "./Notifications";

export async function PublicHeader() {
  const u = await getUser();
  return (
    <>
      {/* Dark like the hero and the status bar, so the iPhone clock/battery stay readable and there is no white band.
          The extra top space (×1.45, zero on computers) keeps the white logo tile below the soft blur newer iPhones draw under the clock. */}
      <header className="no-print sticky top-0 z-30 bg-brand-950 pt-[calc(env(safe-area-inset-top)*1.45)] text-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:h-16">
          <Link href="/" aria-label="CasaVilla home" className="flex items-center"><Logo tile size="sm" className="[&_img]:h-8 md:[&_img]:h-10" /></Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[["/listings", "To rent"], ["/stays", "Short stays"], ["/sale", "For sale"], ["/build", "Build"], ["/services", "Services"], ["/shop", "Shop"]].map(([h, l]) => (
              <Link key={h} href={h} className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white">{l}</Link>
            ))}
          </nav>
          {u && <div className="flex items-center md:hidden"><Link href="/saved" aria-label="Saved homes" className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"><Heart className="h-5 w-5" /></Link><NotificationBell user={u} tone="light" /></div>}
          <div className="hidden items-center gap-2 md:flex">
            {u && <Link href="/saved" aria-label="Saved homes" className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10"><Heart className="h-5 w-5" /></Link>}
            {u && <NotificationBell user={u} tone="light" />}
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
