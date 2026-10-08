import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/db";
import { activeProviders } from "@/lib/queries";
import { ugx } from "@/lib/format";
import { Badge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Service providers" };

export default async function Services({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const list = await activeProviders(category);
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="h1">Service providers</h1>
      <p className="muted mt-1">Vetted by CasaVilla. Book directly, or report a repair from your tenant or landlord dashboard.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/services" className={`rounded-full border px-3 py-1.5 text-sm ${!category ? "border-brand-500 bg-brand-50 text-brand-700" : "border-stone-200 bg-white"}`}>All</Link>
        {SERVICE_CATEGORIES.map((c) => (
          <Link key={c} href={`/services?category=${encodeURIComponent(c)}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${category === c ? "border-brand-500 bg-brand-50 text-brand-700" : "border-stone-200 bg-white"}`}>{c}</Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <Link key={p.id} href={`/services/${p.id}`} className="card hover:shadow-md">
            <div className="font-semibold text-stone-900">{p.name}</div>
            <div className="muted">{p.area || "Kampala"}</div>
            <div className="mt-2 flex flex-wrap gap-1">{[...p.categories].map((c) => <Badge key={c} color="green">{c}</Badge>)}</div>
            {p.bio && <p className="mt-2 line-clamp-2 text-sm text-stone-600">{p.bio}</p>}
            {p.from != null && <div className="mt-2 text-sm font-semibold text-brand-600">From {ugx(p.from)}</div>}
          </Link>
        ))}
      </div>
      {list.length === 0 && <div className="mt-6"><Empty title="No providers in this category yet" /></div>}
    </main>
  );
}
