import Link from "next/link";
import { InfoPage, TalkToUs } from "@/components/InfoPage";
import { JsonLd } from "@/components/JsonLd";

export const metadata = {
  title: "How CasaVilla Works — Renting, Letting, Buying Land & Building",
  description: "How renting, letting your property, booking short stays, buying land and building work with CasaVilla in Uganda — step by step, with rent and payments by Mobile Money.",
  alternates: { canonical: "/how-it-works" },
};

const JOURNEYS: { id: string; title: string; who: string; steps: [string, string][]; cta: [string, string] }[] = [
  {
    id: "renting", title: "Renting a home", who: "For tenants",
    steps: [
      ["Find", "Search by area, bedrooms and budget. Homes marked Verified were visited by our team."],
      ["View & apply", "Book a viewing, then apply in the app. The landlord or CasaVilla approves."],
      ["Move in", "Your lease is in the app, and a room-by-room move-in inspection records the condition."],
      ["Pay rent", "Pay by MTN or Airtel Mobile Money. You get reminders before rent is due and a receipt every time."],
      ["Repairs", "Report a problem with a photo; a vetted provider is assigned and you follow it until it's fixed."],
    ],
    cta: ["/listings", "Find a home"],
  },
  {
    id: "landlords", title: "Letting your property", who: "For landlords",
    steps: [
      ["List", "Add your property and units with photos. CasaVilla can visit to give it the Verified badge."],
      ["Tenants", "Approve applications, or invite your current tenants with a link so they join already connected to you."],
      ["Rent", "Tenants pay in the app. You see who has paid and who owes, with statements every month."],
      ["Payouts", "Rent collected by CasaVilla is paid out to your Mobile Money or bank account, with every deduction shown."],
      ["Upkeep", "Repairs, inspections, utilities and caretakers — all tracked in one place."],
    ],
    cta: ["/list", "List a property"],
  },
  {
    id: "stays", title: "Booking a short stay", who: "For guests",
    steps: [["Choose", "Pick a place and your dates."], ["Pay", "Pay for the stay by Mobile Money; your dates are held while you approve."], ["Stay", "Your booking and receipt are in the app."]],
    cta: ["/stays", "See short stays"],
  },
  {
    id: "buying", title: "Buying land or a house", who: "For buyers",
    steps: [
      ["Search", "Every listing is reviewed by CasaVilla before it goes live."],
      ["Enquire & view", "Ask a question or book a viewing — CasaVilla arranges it."],
      ["Check", "Before paying anything, do an official land search at the Ministry of Lands. CasaVilla can arrange it for you."],
    ],
    cta: ["/sale", "Land & property for sale"],
  },
  {
    id: "building", title: "Building with CasaVilla", who: "For builders",
    steps: [
      ["Talk to us", "Tell us what, where and your budget — or start from a ready-made house plan."],
      ["Design & quote", "Plans, approvals and a quote split into stages."],
      ["Build", "Follow progress with photos in the app and pay each stage by Mobile Money or bank."],
    ],
    cta: ["/build", "Build with CasaVilla"],
  },
];

const FAQS: [string, string][] = [
  ["Does it cost anything to use CasaVilla?", "Searching, booking viewings and creating an account are free. Landlords who have CasaVilla collect rent or manage their property agree the service terms with CasaVilla."],
  ["How do I pay rent?", "In the app, by MTN or Airtel Mobile Money. You approve the payment on your phone and get a receipt straight away."],
  ["What does the Verified badge mean?", "Someone from CasaVilla visited the property and checked that the landlord owns it."],
  ["I already rent — can I use the app?", "Yes. Sign up as a tenant, tick “I already rent a home” and enter your landlord's phone number. Your landlord confirms, and you're connected."],
  ["Is there an app?", "Yes — open the CasaVilla website on your phone and tap Install (on iPhone: Share, then Add to Home Screen). It opens full-screen like any other app."],
];

export default function HowItWorks() {
  return (
    <InfoPage title="How CasaVilla works" intro="Renting, letting, staying, buying and building — step by step." crumb="How it works">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <nav aria-label="Jump to" className="flex flex-wrap gap-2">
        {JOURNEYS.map((j) => <a key={j.id} href={`#${j.id}`} className="chip">{j.title}</a>)}
      </nav>
      {JOURNEYS.map((j) => (
        <section key={j.id} id={j.id} className="mt-6 scroll-mt-24 rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card">
          <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-700">{j.who}</div>
          <h2 className="text-lg font-bold text-brand-950">{j.title}</h2>
          <ol className="mt-3 space-y-3">
            {j.steps.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-bold text-gold-300">{i + 1}</span>
                <span className="text-sm text-stone-700"><b className="text-brand-950">{t}.</b> {d}</span>
              </li>
            ))}
          </ol>
          <Link href={j.cta[0]} className="btn-outline btn-sm mt-4">{j.cta[1]} →</Link>
        </section>
      ))}
      <h2 className="mt-10 text-lg font-bold text-brand-950">Common questions</h2>
      <div className="mt-3 divide-y divide-stone-100 rounded-2xl border border-stone-200/70 bg-white">
        {FAQS.map(([q, a]) => (
          <details key={q} className="px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-stone-800">{q}</summary>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">{a}</p>
          </details>
        ))}
      </div>
      <TalkToUs text="Still have a question? Ask us." />
    </InfoPage>
  );
}
