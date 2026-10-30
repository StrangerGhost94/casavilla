import Link from "next/link";
import { CONTACT } from "@/lib/social";
import { LEGAL_APPROVED, LEGAL_UPDATED } from "@/lib/legal";
import { InfoPage, Section } from "@/components/InfoPage";

export const metadata = {
  title: "Privacy Policy",
  description: "How CasaVilla Property Management collects, uses and protects your personal information.",
  alternates: { canonical: "/privacy" },
  ...(LEGAL_APPROVED ? {} : { robots: { index: false, follow: true } }),
};

export default function Privacy() {
  return (
    <InfoPage title="Privacy policy" intro={`How we look after your information · updated ${LEGAL_UPDATED}`} crumb="Privacy">
      <p className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">In short: we collect what we need to run your account, your tenancy, your payments and your listings. We share it only with the people involved and the companies that help us run CasaVilla. We never sell it.</p>
      <div className="mt-6">
        <Section title="Who we are">
          <p>CasaVilla Property Management (“CasaVilla”, “we”), {CONTACT.address}. For anything about your information, email <a href={`mailto:${CONTACT.email}`} className="link">{CONTACT.email}</a> or call {CONTACT.phones[0]}.</p>
        </Section>
        <Section title="What we collect">
          <ul>
            <li><b>Your account:</b> name, phone number, email address and password (stored scrambled, never readable by us).</li>
            <li><b>What you add:</b> properties, units, photos, documents, leases, applications, repair requests, viewing requests, enquiries and messages.</li>
            <li><b>Payments:</b> amounts, dates, the Mobile Money number used and payment references. Your Mobile Money PIN is entered on your phone and never reaches us.</li>
            <li><b>Landlords and providers:</b> payout details (Mobile Money number or bank account), and a TIN where needed for URA EFRIS receipts.</li>
            <li><b>Location:</b> the area or map pin you choose for a property, plot or your account.</li>
            <li><b>Your device:</b> if you turn on notifications, a code that lets us send them to that phone; and basic technical records that keep the service secure.</li>
          </ul>
        </Section>
        <Section title="How we use it">
          <ul>
            <li>To run your account, tenancy, bookings, building project and listings.</li>
            <li>To take payments, issue receipts and pay landlords.</li>
            <li>To send reminders and updates by app notification, SMS, WhatsApp or email — you can turn reminders off in your <Link href="/profile" className="link">profile</Link>.</li>
            <li>To check listings, prevent fraud and keep CasaVilla safe.</li>
            <li>To meet our legal duties, for example tax records and URA EFRIS receipts.</li>
          </ul>
        </Section>
        <Section title="Who can see it">
          <ul>
            <li><b>The people involved:</b> a tenant and their landlord (and the landlord's caretaker) see the tenancy, payments and repairs; a provider sees the jobs they take; a client sees their building project.</li>
            <li><b>The public:</b> only what you publish in a listing — its details, photos, area and, if you add one, its map pin. Your phone number and email are not shown on listings.</li>
            <li><b>CasaVilla staff</b> who need it to help you.</li>
            <li><b>Companies that help us run CasaVilla:</b> hosting, the Mobile Money payment provider, SMS/WhatsApp and email senders, and map services — only for that purpose.</li>
            <li><b>Authorities</b> where the law requires it, for example URA for EFRIS receipts.</li>
          </ul>
          <p>We do not sell your information.</p>
        </Section>
        <Section title="How long we keep it">
          <p>While your account is open, and afterwards for as long as the law requires us to keep financial and tax records. Listings and photos you remove are taken down.</p>
        </Section>
        <Section title="Your rights">
          <p>Under Uganda&apos;s Data Protection and Privacy Act, 2019 you can ask to see the information we hold about you, have it corrected, or have it deleted where we no longer need it, and you can object to how it is used. Email <a href={`mailto:${CONTACT.email}`} className="link">{CONTACT.email}</a> and we will respond.</p>
        </Section>
        <Section title="Keeping it safe">
          <p>Passwords are stored scrambled, private documents and photos are shown only to the people involved, and access by staff is limited to what they need.</p>
        </Section>
        <Section title="Changes">
          <p>If we change this policy we will update this page and the date at the top, and tell you in the app if the change is important.</p>
        </Section>
      </div>
    </InfoPage>
  );
}
