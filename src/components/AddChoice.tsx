import Link from "next/link";
import { KeyRound, Tag } from "lucide-react";

/** Top of "Add a property": rent it out (units, tenants) or sell it (land, house, building). */
export function AddChoice({ role, active }: { role: "landlord" | "manager"; active: "rent" | "sell" }) {
  const opts = [
    { id: "rent", href: `/${role}/properties/new`, icon: KeyRound, title: "Rent it out", body: "Units, tenants and monthly rent" },
    { id: "sell", href: `/${role}/sale/new`, icon: Tag, title: "Sell it", body: "Land, plots, houses or buildings" },
  ] as const;
  return (
    <div className="mb-5 grid grid-cols-2 gap-2">
      {opts.map((o) => (
        <Link key={o.id} href={o.href} aria-current={active === o.id ? "page" : undefined}
          className={`flex items-start gap-3 rounded-2xl border p-3 transition ${active === o.id ? "border-brand-700 bg-brand-50 ring-4 ring-brand-100" : "border-stone-200 bg-white hover:border-stone-300"}`}>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${active === o.id ? "bg-brand-800 text-gold-300" : "bg-stone-100 text-stone-500"}`}><o.icon className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0"><span className="block text-sm font-semibold text-brand-950">{o.title}</span><span className="block text-[11px] leading-snug text-stone-500">{o.body}</span></span>
        </Link>
      ))}
    </div>
  );
}
