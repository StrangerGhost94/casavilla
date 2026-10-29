import Link from "next/link";
import { after } from "next/server";
import { runHousekeeping } from "@/lib/housekeeping";
import { LogOut } from "lucide-react";
import { db, type User } from "@/db";
import { logout } from "@/app/actions";
import { menus, roleName, tabs } from "@/lib/nav";
import { homeFor } from "@/lib/auth";
import { Avatar, Logo } from "./ui";
import { BottomNav, MobileTitle, NavLinks } from "./NavLinks";
import { InstallPrompt } from "./InstallApp";
import { NotificationBell } from "./Notifications";
import { autoActive, efrisProblems, missingCount } from "@/lib/efris";

/** Sidebar badges: how many things wait behind each link. Kept to cheap counts, as this runs on every page. */
async function navCounts(user: User): Promise<Record<string, number>> {
  if (user.role === "manager") {
    const [people, apps, links, jobs, efris, stuck] = await Promise.all([
      db.user.count({ where: { status: "pending" } }),
      db.application.count({ where: { status: "pending" } }),
      db.tenantLink.count({ where: { status: "pending" } }),
      db.job.count({ where: { providerId: null, status: { notIn: ["done", "cancelled"] } } }),
      missingCount(),
      efrisProblems().then((r) => r.length),
    ]);
    const viewings = await db.viewing.count({ where: { status: "requested", at: { gt: new Date() } } });
    return { "/manager/people": people, "/manager/applications": apps + links, "/manager/jobs": jobs, "/manager/efris": efris + stuck, "/viewings": viewings };
  }
  if (user.role === "landlord") {
    // Automatic landlords have nothing to record by hand, so no badge for them.
    const [apps, efris] = await Promise.all([
      db.application.count({ where: { status: "pending", unit: { property: { landlordId: user.id } } } }),
      autoActive(user.id).then((auto) => (auto ? 0 : missingCount(user.id))),
    ]);
    const viewings = await db.viewing.count({ where: { hostId: user.id, status: "requested", at: { gt: new Date() } } });
    return { "/landlord/applications": apps, "/landlord/efris": efris, "/viewings": viewings };
  }
  return {};
}

export function greetingNow() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export async function PortalShell({ user, children }: { user: User; children: React.ReactNode }) {
  const items = menus[user.role];
  const counts = await navCounts(user).catch(() => ({}));
  // Keeps rent charges, late fees, reminders and escalations moving without anyone pressing a button.
  // Runs after the page is sent, at most once an hour across all users.
  after(() => runHousekeeping().catch((e) => console.error("housekeeping", e)));
  const display = user.businessName || user.name;
  const first = user.name.split(" ")[0];
  return (
    <div className="portal-shell min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print hidden bg-brand-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col">
        {/* The logo's red and green need a light ground to read on the dark sidebar. */}
        <Link href="/" className="mx-4 mb-3 mt-5 flex shrink-0 justify-center rounded-2xl bg-cream px-4 py-2.5 ring-1 ring-white/10 transition hover:bg-white"><Logo size="md" /></Link>
        <NavLinks items={items} counts={counts} />
        <div className="shrink-0 border-t border-white/10 p-4">
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

      <div className="min-w-0 flex-1 bg-cream">
        {/* Phone header */}
        <header className="no-print sticky top-0 z-30 bg-brand-900 px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1rem)] text-white lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <MobileTitle root={homeFor(user.role)} items={[...items, { href: "/profile", label: "Profile", icon: "user" }]} greeting={greetingNow()} name={first}
              avatar={<Avatar name={user.name} tone="bg-gold-400 text-brand-950" className="h-11 w-11 text-sm" />} />
            <NotificationBell user={user} tone="light" />
          </div>
        </header>
        {/* Desktop top bar */}
        <header className="no-print hidden items-center justify-end gap-3 px-8 pt-5 lg:flex">
          <span className="text-sm text-stone-500">{greetingNow()}, <span className="font-semibold text-brand-900">{first}</span></span>
          <NotificationBell user={user} tone="dark" />
        </header>
        <main className="min-h-[calc(100vh-5rem)] bg-cream px-4 pb-28 pt-5 lg:mx-auto lg:mt-0 lg:max-w-6xl lg:rounded-none lg:px-8 lg:pb-12 lg:pt-2">
          {children}
        </main>
      </div>
      <BottomNav tabs={tabs[user.role]} />
      <InstallPrompt />
    </div>
  );
}
