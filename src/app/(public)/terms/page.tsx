import Link from "next/link";
import { CONTACT } from "@/lib/social";
import { LEGAL_APPROVED, LEGAL_UPDATED } from "@/lib/legal";
import { InfoPage, Section } from "@/components/InfoPage";

export const metadata = {
  title: "Terms of Use",
  description: "The terms for using CasaVilla: accounts, listings, payments, short stays, land for sale, services and building.",
  alternates: { canonical: "/terms" },
  ...(LEGAL_APPROVED ? {} : { robots: { index: false, follow: true } }),
};

export default function Terms() {
  return (
    <InfoPage title="Terms of use" intro={`The rules for using CasaVilla · updated ${LEGAL_UPDATED}`} crumb="Terms">
      <Section title="About these terms">
        <p>These terms apply when you use the CasaVilla website or app, run by CasaVilla Property Management, {CONTACT.address}. By creating an account or using the service you agree to them. See also our <Link href="/privacy" className="link">privacy policy</Link>.</p>
      </Section>
      <Section title="Your account">
        <ul>
          <li>Give your real name and a phone number you use. Keep your password to yourself; you are responsible for what is done with your account.</li>
          <li>We may suspend an account that breaks these terms or is used for fraud.</li>
        </ul>
      </Section>
      <Section title="Listings">
        <ul>
          <li>Only list a property, plot or unit you own or are allowed to let or sell, and describe it honestly, with real photos and prices.</li>
          <li>CasaVilla reviews listings and may change, hide or remove any listing.</li>
          <li>“Verified” means someone from CasaVilla visited the property and checked that the landlord owns it. It is not a survey or a guarantee of condition.</li>
        </ul>
      </Section>
      <Section title="Rent and payments">
        <ul>
          <li>Payments in the app are made by Mobile Money and confirmed with a receipt. A payment counts once it is confirmed.</li>
          <li>Rent, deposits and other charges follow the tenancy agreed between tenant and landlord.</li>
          <li>Where CasaVilla collects rent for a landlord, it pays it out less the fees and taxes in the landlord&apos;s agreement with CasaVilla, with every deduction shown.</li>
        </ul>
      </Section>
      <Section title="Short stays">
        <p>A stay is booked once it is paid for. The house rules and cancellation terms shown when you book apply.</p>
      </Section>
      <Section title="Land and property for sale">
        <p>Do your own official land search at the Ministry of Lands and visit before paying anything. CasaVilla can arrange the search and viewings, but the sale is between buyer and seller unless CasaVilla agrees otherwise in writing.</p>
      </Section>
      <Section title="Service providers and the shop">
        <p>Providers and sellers are independent businesses. CasaVilla vets them, but each is responsible for its own work and goods.</p>
      </Section>
      <Section title="Building with CasaVilla">
        <p>Design and building work is governed by the quote and agreement for your project. The project page in the app shows its stages and payments.</p>
      </Section>
      <Section title="Fair use">
        <p>Don&apos;t post anything false, unlawful or offensive, don&apos;t try to get around payments or into other people&apos;s accounts, and don&apos;t copy listings or data in bulk.</p>
      </Section>
      <Section title="Our responsibility">
        <p>We work to keep CasaVilla accurate and available, but we can&apos;t promise it will always be free of errors or interruptions. Nothing here limits rights you have under Ugandan law.</p>
      </Section>
      <Section title="Changes and contact">
        <p>We may update these terms; the date at the top shows the latest version. These terms are governed by the laws of Uganda. Questions: <a href={`mailto:${CONTACT.email}`} className="link">{CONTACT.email}</a> or {CONTACT.phones[0]}.</p>
      </Section>
    </InfoPage>
  );
}
