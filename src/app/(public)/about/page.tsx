import Link from "next/link";
import { BadgeCheck, BedDouble, Building2, HardHat, KeyRound, Smartphone, Trees, Wrench } from "lucide-react";
import { CONTACT } from "@/lib/social";
import { InfoPage, TalkToUs } from "@/components/InfoPage";

export const metadata = {
  title: "About CasaVilla Property Management, Kampala",
  description: "CasaVilla is a Kampala property management company and marketplace: homes to rent, short stays, land and property for sale, building, and rent collected by Mobile Money for landlords.",
  alternates: { canonical: "/about" },
};

const WHAT = [
  [KeyRound, "Homes to rent", "Houses and apartments across Kampala and nearby, many visited and verified by our team.", "/listings"],
  [BedDouble, "Short stays", "Furnished places by the night, booked and paid for with Mobile Money.", "/stays"],
  [Trees, "Land & property for sale", "Plots, farms, houses and buildings, reviewed before they go live — titles checked on request.", "/sale"],
  [HardHat, "Build with CasaVilla", "House plans, approvals and construction, from the first drawing to the keys.", "/build"],
  [Building2, "Property management", "We find tenants, collect rent, keep the records and look after repairs for landlords.", "/list"],
  [Wrench, "Services & shop", "Vetted plumbers, electricians, cleaners and more, plus building materials and fittings.", "/services"],
] as const;

export default function About() {
  return (
    <InfoPage title="About CasaVilla" intro="Connect. Manage. Grow. — homes, land and everything after you move in." crumb="About us">
      <p className="text-base leading-relaxed text-stone-700">
        CasaVilla Property Management is based on Rubaga Road, Kampala. We bring renting, buying, building and looking after property into one place —
        on the web and in the CasaVilla app — so tenants, landlords, buyers and builders deal with one team they can reach.
      </p>

      <h2 className="mt-8 text-lg font-bold text-brand-950">What we do</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {WHAT.map(([I, t, d, href]) => (
          <Link key={t} href={href} className="flex gap-3 rounded-3xl border border-stone-200/70 bg-white p-4 shadow-card hover:border-brand-200">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><I className="h-5 w-5" /></span>
            <span><span className="block font-semibold text-brand-950">{t}</span><span className="mt-0.5 block text-sm text-stone-600">{d}</span></span>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 text-lg font-bold text-brand-950">How we work</h2>
      <ul className="mt-3 space-y-3">
        {[
          [BadgeCheck, "Verified listings", "Homes marked Verified have been visited by the CasaVilla team, who checked the property and that the landlord owns it."],
          [Smartphone, "Mobile Money, with receipts", "Rent, stays and building stages are paid by MTN or Airtel Mobile Money in the app, and every payment gets a receipt."],
          [Wrench, "Repairs that get done", "Tenants report a problem in the app; a vetted provider is assigned and everyone can follow it to the end."],
        ].map(([I, t, d]) => {
          const Icon = I as typeof BadgeCheck;
          return <li key={t as string} className="flex gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" /><span className="text-sm text-stone-700"><b className="text-brand-950">{t as string}.</b> {d as string}</span></li>;
        })}
      </ul>

      <h2 className="mt-8 text-lg font-bold text-brand-950">Find us</h2>
      <p className="mt-2 text-sm text-stone-700">{CONTACT.address} · {CONTACT.phones.join(" · ")} · {CONTACT.email}. <Link href="/contact" className="link">All the ways to reach us →</Link></p>
      <TalkToUs />
    </InfoPage>
  );
}
