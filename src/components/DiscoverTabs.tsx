import Link from "next/link";

/** Discover's three ways to look: monthly rentals, nightly stays, and land & property for sale. */
export function DiscoverTabs({ active }: { active: "rent" | "stays" | "sale" }) {
  const tabs = [
    { id: "rent", href: "/listings", label: "To rent" },
    { id: "stays", href: "/stays", label: "Short stays" },
    { id: "sale", href: "/sale", label: "For sale" },
  ] as const;
  return (
    <nav aria-label="Discover" className="grid grid-cols-3 rounded-2xl bg-stone-100 p-1 text-center text-sm font-semibold">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined}
          className={`rounded-xl py-2 transition ${active === t.id ? "bg-white text-brand-950 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
