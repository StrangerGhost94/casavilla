import Link from "next/link";
import { Bell, LogOut } from "lucide-react";
import { db, type User } from "@/db";
import { logout, markAllRead } from "@/app/actions";
import { fmtDateTime } from "@/lib/format";
import { menus, roleName, tabs } from "@/lib/nav";
import { homeFor } from "@/lib/auth";
import { Avatar, Logo } from "./ui";
import { BottomNav, MobileTitle, NavLinks } from "./NavLinks";

export function greetingNow() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

async function Notifications({ user, tone }: { user: User; tone: "light" | "dark" }) {
  const [notes, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return (
    <details className="relative">
      <summary aria-label="Notifications"
        className={`relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full ${tone === "light" ? "text-white hover:bg-white/10" : "text-brand-900 hover:bg-stone-100"}`}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-maroon-500 px-1 text-[9px] font-bold text-white">{unread}</span>}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-stone-200 bg-white p-2 text-stone-800 shadow-float">
        <div className="px-2 py-1.5 text-xs font-semibold text-stone-500">Notifications</div>
        {notes.length === 0 && <div className="p-3 text-sm text-stone-500">Nothing yet.</div>}
        {notes.map((n) => (
          <Link key={n.id} href={n.link || "#"} className={`block rounded-xl p-2.5 text-sm hover:bg-stone-50 ${n.read ? "text-stone-500" : "font-medium text-stone-800"}`}>
            {n.message}
            <div className="mt-0.5 text-[11px] font-normal text-stone-400">{fmtDateTime(n.createdAt)}</div>
          </Link>
        ))}
        {unread > 0 && <form action={markAllRead}><button className="btn-ghost btn-sm w-full">Mark all read</button></form>}
      </div>
    </details>
  );
}

export async function PortalShell({ user, children }: { user: User; children: React.ReactNode }) {
  const items = menus[user.role];
  const display = user.businessName || user.name;
  const first = user.name.split(" ")[0];
  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print hidden bg-brand-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        <Link href="/" className="px-6 pb-6 pt-7"><Logo tone="light" /></Link>
        <NavLinks items={items} />
        <div className="mt-auto border-t border-white/10 p-4">
          <Link href="/profile" className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
            <Avatar name={user.name} className="h-9 w-9 text-xs ring-2 ring-gold-400/60" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{display}</div>
              <div className="text-xs text-white/60">{roleName[user.role]}</div>
            </div>
          </Link>
          <form action={logout}>
            <button className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/5 hover:text-white">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phone header */}
        <header className="no-print sticky top-0 z-30 bg-brand-900 px-4 pb-7 pt-[max(0.75rem,env(safe-area-inset-top))] text-white lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <MobileTitle root={homeFor(user.role)} items={[...items, { href: "/profile", label: "Profile", icon: "user" }]} greeting={greetingNow()} name={first}
              avatar={<Avatar name={user.name} className="h-11 w-11 text-sm ring-2 ring-gold-400/70" />} />
            <Notifications user={user} tone="light" />
          </div>
        </header>
        {/* Desktop top bar */}
        <header className="no-print hidden items-center justify-end gap-3 px-8 pt-5 lg:flex">
          <span className="text-sm text-stone-500">{greetingNow()}, <span className="font-semibold text-brand-900">{first}</span></span>
          <Notifications user={user} tone="dark" />
        </header>
        <main className="relative z-10 -mt-4 min-h-[60vh] rounded-t-3xl bg-cream px-4 pb-28 pt-5 lg:mx-auto lg:mt-0 lg:max-w-6xl lg:rounded-none lg:px-8 lg:pb-12 lg:pt-2">
          {children}
        </main>
      </div>
      <BottomNav tabs={tabs[user.role]} />
    </div>
  );
}
