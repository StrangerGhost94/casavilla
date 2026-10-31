import Link from "next/link";
import { ChevronRight, KeyRound, Trees, Wrench } from "lucide-react";
import { getUser } from "@/lib/auth";
import { CONTACT, tel, waLink } from "@/lib/social";
import { roleName } from "@/lib/nav";

export const metadata = {
  title: "List Your Property for Rent or Sale in Uganda",
  description: "Landlords and owners: list houses, apartments, short stays and land with CasaVilla. Collect rent by Mobile Money, get tenants faster, and manage everything in one app.",
  alternates: { canonical: "/list" },
};
export const dynamic = "force-dynamic";

/** The one place owners and providers start: rent out, sell, or offer a service. */
export default async function List() {
  const u = await getUser();
  const owner = u && (u.role === "landlord" || u.role === "manager");
  // Signed in with another kind of account (tenant, provider, caretaker): listing needs a landlord account,
  // so CasaVilla sets it up — sign-up would only send them back to their own home.
  const other = !!u && !owner;
  const ask = (what: string) => waLink(`Hello CasaVilla, I'd like to ${what}. My CasaVilla account is ${u?.name} (${u?.phone}).`);
  const to = (path: string, role = "landlord") => (owner ? `/${u!.role}${path}` : other ? ask(path.startsWith("/sale") ? "sell land or a property" : "rent out a property") : `/register?role=${role}&next=${encodeURIComponent(`/landlord${path}`)}`);
  const options = [
    { href: to("/properties/new"), icon: KeyRound, tone: "bg-gold-400 text-brand-950", title: "Rent out a property", body: "List houses, apartments or rooms. Collect rent on Mobile Money, track tenants and repairs." },
    { href: to("/sale/new"), icon: Trees, tone: "bg-brand-800 text-gold-300", title: "Sell land or a property", body: "Plots, farms, houses or buildings. Reviewed by CasaVilla, with title verification for buyers." },
    { href: u?.role === "provider" ? "/provider/services" : other ? ask("offer my services") : "/register?role=provider", icon: Wrench, tone: "bg-brand-50 text-brand-700", title: "Offer a service", body: "Plumbing, cleaning, painting, security… get hired by landlords and tenants." },
  ];
  return (
    <main className="mx-auto max-w-xl px-4 pb-10 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">List with CasaVilla</h1>
      <p className="muted mt-1">Free to list. Tell us what you&apos;d like to do.</p>
      {other && <p className="mt-3 rounded-xl bg-gold-50 p-3 text-sm text-gold-700">You&apos;re signed in as a {roleName[u!.role].toLowerCase()}. Pick an option and CasaVilla will set up listing for you on WhatsApp.</p>}
      <div className="mt-5 space-y-3">
        {options.map((o) => (
          <Link key={o.title} href={o.href} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-brand-200">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${o.tone}`}><o.icon className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">{o.title}</span><span className="block text-xs leading-snug text-stone-500">{o.body}</span></span>
            <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
          </Link>
        ))}
      </div>
      <div className="mt-8 rounded-2xl bg-brand-900 p-5 text-white">
        <div className="font-semibold">Want CasaVilla to manage it for you?</div>
        <p className="mt-1 text-sm text-white/70">We find tenants, collect rent and handle repairs — from our office on Rubaga Road.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={CONTACT.whatsapp} className="btn-gold btn-sm">WhatsApp us</a>
          <a href={tel(CONTACT.phones[0])} className="btn btn-sm border border-white/30 text-white">Call +256 776 593 482</a>
        </div>
      </div>
    </main>
  );
}
