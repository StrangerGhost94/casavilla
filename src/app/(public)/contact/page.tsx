import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { CONTACT, tel } from "@/lib/social";
import { InfoPage } from "@/components/InfoPage";
import { SocialLinks } from "@/components/SocialLinks";

export const metadata = {
  title: "Contact CasaVilla — Phone, WhatsApp & Office in Kampala",
  description: `Call or WhatsApp CasaVilla Property Management on ${CONTACT.phones[0]}, email ${CONTACT.email}, or visit us on Rubaga Road, Kampala.`,
  alternates: { canonical: "/contact" },
};

export default function Contact() {
  const card = "flex items-start gap-3 rounded-3xl border border-stone-200/70 bg-white p-5 shadow-card hover:border-brand-200";
  const icon = "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-700";
  return (
    <InfoPage title="Contact us" intro="Call, WhatsApp, email or visit — whichever suits you." crumb="Contact">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a href={CONTACT.whatsapp} className={card}><span className={icon}><MessageCircle className="h-5 w-5" /></span><span><span className="block font-semibold text-brand-950">WhatsApp</span><span className="block text-sm text-stone-600">The quickest way to reach us — {CONTACT.phones[0]}</span></span></a>
        <div className={card}><span className={icon}><Phone className="h-5 w-5" /></span><span><span className="block font-semibold text-brand-950">Call</span>{CONTACT.phones.map((p) => <a key={p} href={tel(p)} className="block text-sm text-brand-700 hover:underline">{p}</a>)}</span></div>
        <a href={`mailto:${CONTACT.email}`} className={card}><span className={icon}><Mail className="h-5 w-5" /></span><span className="min-w-0"><span className="block font-semibold text-brand-950">Email</span><span className="block break-all text-sm text-stone-600">{CONTACT.email}</span></span></a>
        <a href={CONTACT.maps} target="_blank" rel="noopener noreferrer" className={card}><span className={icon}><MapPin className="h-5 w-5" /></span><span><span className="block font-semibold text-brand-950">Office</span><span className="block text-sm text-stone-600">{CONTACT.address}</span><span className="mt-1 inline-flex items-center gap-0.5 text-xs font-semibold text-brand-700">Open in Maps <ArrowUpRight className="h-3 w-3" /></span></span></a>
      </div>

      <h2 className="mt-8 text-lg font-bold text-brand-950">Already a CasaVilla customer?</h2>
      <ul className="mt-2 space-y-1.5 text-sm text-stone-700">
        <li>Tenants: report a repair or pay rent from <Link href="/tenant" className="link">My home</Link> in the app.</li>
        <li>Landlords: tenants, rent and statements are on your <Link href="/landlord" className="link">dashboard</Link>.</li>
        <li>Building with us: follow your project under <Link href="/build/my" className="link">My building project</Link>.</li>
      </ul>
      <SocialLinks tone="light" className="mt-8" />
    </InfoPage>
  );
}
