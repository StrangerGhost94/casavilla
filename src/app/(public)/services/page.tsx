import Link from "next/link";
import { BadgeCheck, MapPin, Search } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/db";
import { activeProviders } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { CategoryIcon, categoryLabel } from "@/lib/icons";
import { Avatar, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Services" };

export default async function Services({ searchParams }: { searchParams: Promise<{ category?: string; q?: string }> }) {
  const { category, q } = await searchParams;
  const all = await activeProviders(category);
  const needle = q?.trim().toLowerCase();
  const list = needle ? all.filter((p) => [p.name, p.area, p.bio, ...p.categories].some((s) => s?.toLowerCase().includes(needle))) : all;
  return (
    <main className="mx-auto max-w-6xl px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">Services</h1>
      <p className="muted mt-0.5">Trusted providers, vetted by CasaVilla</p>
      <form className="relative mt-4">
        {category && <input type="hidden" name="category" value={category} />}
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-stone-400" />
        <input name="q" defaultValue={q} className="input pl-11" placeholder="Search services near you" />
      </form>

      <div className="mt-4 grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-11">
        {SERVICE_CATEGORIES.map((c) => {
          const on = category === c;
          return (
            <Link key={c} href={on ? "/services" : `/services?category=${encodeURIComponent(c)}`}
              className={`flex flex-col items-center gap-2 rounded-2xl border px-1 py-3 text-center shadow-card transition ${on ? "border-brand-800 bg-brand-800 text-white" : "border-stone-200/70 bg-white hover:border-brand-200"}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${on ? "bg-white/10 text-gold-300" : "bg-brand-50 text-brand-700"}`}><CategoryIcon category={c} /></span>
              <span className={`text-[11px] font-medium leading-tight ${on ? "text-white" : "text-stone-700"}`}>{categoryLabel[c] ?? c}</span>
            </Link>
          );
        })}
      </div>

      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="h2">{category ? `${categoryLabel[category] ?? category}` : "Top providers"}</h2>
        {category && <Link href="/services" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="card flex min-w-0 items-center gap-3.5 p-4">
            <Avatar name={p.name} className="h-14 w-14 text-base" />
            <div className="min-w-0 flex-1">
              <Link href={`/services/${p.id}`} className="block truncate font-semibold text-brand-950 hover:underline">{p.name}</Link>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> {[...p.categories].join(" · ")}</div>
              <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-stone-500"><MapPin className="h-3.5 w-3.5 shrink-0" /> {p.area || "Kampala"}</div>
              {p.from != null && <div className="mt-1 text-xs font-semibold text-stone-700">From {ugx(p.from)}</div>}
            </div>
            <Link href={`/services/${p.id}`} className="btn-primary btn-sm px-4 py-2">Book</Link>
          </div>
        ))}
      </div>
      {list.length === 0 && <Empty title="No providers found">Try another category or search.</Empty>}
    </main>
  );
}
