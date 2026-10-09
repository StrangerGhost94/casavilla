"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, Briefcase, Building2, ClipboardList, FileText, Home, Package, Plus, Search, ShoppingBag, Sparkles,
  CalendarDays, MapPinned, ShieldCheck, Store, User, Users, Wallet, Wrench, BarChart3, ClipboardCheck, Zap, UserCog, Receipt, MessageCircle, type LucideIcon,
} from "lucide-react";
import type { NavItem, Tabs } from "@/lib/nav";

const icons: Record<string, LucideIcon> = {
  home: Home, wallet: Wallet, wrench: Wrench, file: FileText, clipboard: ClipboardList, search: Search, sparkles: Sparkles,
  bag: ShoppingBag, building: Building2, users: Users, briefcase: Briefcase, package: Package, store: Store, user: User, plus: Plus, shield: ShieldCheck, map: MapPinned, calendar: CalendarDays,
  chart: BarChart3, clipboardCheck: ClipboardCheck, zap: Zap, userCog: UserCog, receipt: Receipt, message: MessageCircle,
};
export function NavIcon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const I = icons[name] ?? Home;
  return <I className={className} />;
}

function isActive(path: string, href: string, all: string[]) {
  if (path === href) return true;
  if (href.split("/").length <= 2) return false; // role roots and "/" only match exactly
  if (!path.startsWith(href + "/")) return false;
  // prefer the most specific matching item
  return !all.some((h) => h !== href && h.startsWith(href + "/") && (path === h || path.startsWith(h + "/")));
}

/** Desktop sidebar links (dark green background). */
export function NavLinks({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const hrefs = items.map((i) => i.href);
  return (
    <nav className="space-y-0.5 px-3">
      {items.map((i) => {
        const active = isActive(path, i.href, hrefs);
        return (
          <Link key={i.href} href={i.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white"}`}>
            <NavIcon name={i.icon} className={`h-[18px] w-[18px] ${active ? "text-gold-300" : ""}`} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone bottom tab bar with the raised green "+" button in the middle. */
export function BottomNav({ tabs }: { tabs: Tabs }) {
  const path = usePathname();
  const all = [...tabs.left, ...tabs.right].map((t) => t.href);
  const Tab = ({ t }: { t: NavItem }) => {
    const active = isActive(path, t.href, all);
    return (
      <Link href={t.href} className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium ${active ? "text-brand-800" : "text-stone-400"}`}>
        <NavIcon name={t.icon} className="h-[22px] w-[22px]" />
        {t.label}
      </Link>
    );
  };
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="mx-auto flex max-w-md items-end px-2">
        {tabs.left.map((t) => <Tab key={t.href} t={t} />)}
        <div className="flex flex-1 justify-center">
          <Link href={tabs.action.href} aria-label={tabs.action.label}
            className="-mt-6 mb-1.5 flex h-14 w-14 items-center justify-center rounded-full bg-brand-800 text-white shadow-float ring-4 ring-white transition hover:bg-brand-900">
            <Plus className="h-6 w-6" />
          </Link>
        </div>
        {tabs.right.map((t) => <Tab key={t.href} t={t} />)}
      </div>
    </nav>
  );
}

const titleOverrides: [RegExp, string][] = [
  [/^\/tenant\/pay\//, "Rent Payment"],
  [/^\/tenant\/requests\/new/, "Report Maintenance"],
  [/\/properties\/new$/, "Add Property"],
  [/^\/profile/, "Profile"],
];

/** Where the header back arrow leads from a given screen. */
export function parentOf(path: string, root: string) {
  if (path.startsWith("/tenant/pay/")) return "/tenant/rent";
  if (path === "/profile" || path.startsWith("/receipts/")) return root;
  const segs = path.split("/").filter(Boolean);
  return segs.length > 2 ? "/" + segs.slice(0, -1).join("/") : root;
}

/** Left side of the green phone header: greeting on the home screen, back arrow + title elsewhere. */
export function MobileTitle({ root, items, greeting, name, avatar }: { root: string; items: NavItem[]; greeting: string; name: string; avatar: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  if (path === root) {
    return (
      <Link href="/profile" aria-label="My profile" className="-m-1 flex min-w-0 items-center gap-3 rounded-full p-1 pr-3 active:bg-white/10">
        {avatar}
        <div className="min-w-0">
          <div className="text-xs text-white/70">{greeting},</div>
          <div className="truncate text-lg font-semibold leading-tight">{name}</div>
        </div>
      </Link>
    );
  }
  const hrefs = items.map((i) => i.href);
  const title = titleOverrides.find(([re]) => re.test(path))?.[1]
    ?? items.find((i) => isActive(path, i.href, hrefs))?.label
    ?? "CasaVilla";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" aria-label="Back" onClick={() => {
          // "New …" forms go back to wherever you came from; everything else goes to its parent screen,
          // so the arrow never returns you to a form you just sent.
          if (path.endsWith("/new") && window.history.length > 1) router.back();
          else router.push(parentOf(path, root));
        }}
        className="-ml-1.5 rounded-full p-1.5 hover:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="truncate text-lg font-semibold">{title}</div>
    </div>
  );
}
