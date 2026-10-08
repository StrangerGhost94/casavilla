import Link from "next/link";
import { db, type User } from "@/db";
import { logout, markAllRead } from "@/app/actions";
import { Logo } from "./ui";
import { fmtDateTime } from "@/lib/format";
import { NavLinks } from "./NavLinks";

export type NavItem = { href: string; label: string };

const roleName = { tenant: "Tenant", landlord: "Landlord", provider: "Service provider", manager: "CasaVilla manager" };

export async function PortalShell({ user, nav, children }: { user: User; nav: NavItem[]; children: React.ReactNode }) {
  const [notes, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print border-b border-stone-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link href="/"><Logo className="h-12" /></Link>
          <div className="text-right lg:mt-4 lg:text-left">
            <div className="text-sm font-semibold text-stone-900">{user.businessName || user.name}</div>
            <div className="text-xs text-stone-500">{roleName[user.role]}</div>
          </div>
        </div>
        <NavLinks items={nav} />
        <form action={logout} className="hidden px-3 pb-4 lg:block">
          <button className="btn-ghost w-full justify-start">Sign out</button>
        </form>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print flex items-center justify-end gap-2 border-b border-stone-200 bg-white/80 px-4 py-2 backdrop-blur lg:px-8">
          <details className="relative">
            <summary className="btn-ghost btn-sm cursor-pointer list-none">
              Notifications{unread > 0 && <span className="rounded-full bg-maroon-600 px-1.5 text-[10px] text-white">{unread}</span>}
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              {notes.length === 0 && <div className="p-3 text-sm text-stone-500">Nothing yet.</div>}
              {notes.map((n) => (
                <Link key={n.id} href={n.link || "#"} className={`block rounded-lg p-2 text-sm hover:bg-stone-50 ${n.read ? "text-stone-500" : "font-medium text-stone-800"}`}>
                  {n.message}
                  <div className="text-[11px] text-stone-400">{fmtDateTime(n.createdAt)}</div>
                </Link>
              ))}
              {unread > 0 && (
                <form action={markAllRead}><button className="btn-ghost btn-sm w-full">Mark all read</button></form>
              )}
            </div>
          </details>
          <form action={logout} className="lg:hidden"><button className="btn-ghost btn-sm">Sign out</button></form>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
