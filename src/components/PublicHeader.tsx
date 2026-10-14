import Link from "next/link";
import { getUser, homeFor } from "@/lib/auth";
import { tabs } from "@/lib/nav";
import { Avatar, Logo } from "./ui";
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
