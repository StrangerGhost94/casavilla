"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-4">
      {items.map((i) => {
        const active = path === i.href || (i.href.split("/").length > 2 && path.startsWith(i.href));
        return (
          <Link key={i.href} href={i.href}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-stone-600 hover:bg-stone-100"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
