import Link from "next/link";
import { ChevronRight, MessageCircle, Phone } from "lucide-react";
import { CONTACT, tel } from "@/lib/social";
import { SearchBand } from "./ListingParts";

/** About / How it works / Contact / Privacy / Terms: the dark title band, then readable content. */
export function InfoPage({ title, intro, crumb, children }: { title: string; intro: string; crumb: string; children: React.ReactNode }) {
  return (
    <main>
      <SearchBand title={title} text={intro} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-stone-500"><Link href="/" className="hover:underline">Home</Link><ChevronRight className="h-3 w-3" /><span className="font-semibold text-stone-700">{crumb}</span></nav>
        <div className="mt-5">{children}</div>
      </div>
    </main>
  );
}

/** A titled block of plain text (used for the policy pages). */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-0">
      <h2 className="text-lg font-bold text-brand-950">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-stone-700 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    </section>
  );
}

export function TalkToUs({ text = "Questions? We're happy to help." }: { text?: string }) {
  return (
    <div className="mt-10 flex flex-col items-start gap-3 rounded-3xl bg-brand-900 p-5 text-white sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 font-semibold">{text}</div>
      <div className="flex gap-2">
        <a href={CONTACT.whatsapp} className="btn-gold btn-sm"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
        <a href={tel(CONTACT.phones[0])} className="btn-sm rounded-lg px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/30 hover:bg-white/10"><Phone className="mr-1 inline h-3.5 w-3.5" />Call</a>
      </div>
    </div>
  );
}
