import { MessageCircle, UserPlus } from "lucide-react";
import { SITE } from "@/lib/seo";
import { CopyLink } from "./InviteCopy";

/** Landlords: send existing tenants a link that signs them up already connected to this landlord. */
export function InviteTenants({ landlord, compact = false }: { landlord: { name: string; phone: string }; compact?: boolean }) {
  const local = landlord.phone.replace("+256", "0");
  const link = `${SITE}/register?landlord=${encodeURIComponent(local)}`;
  const text = `Hello, this is ${landlord.name}. I now manage rent through CasaVilla — you can pay by Mobile Money, get receipts and report repairs from your phone. Join here (my number is already filled in): ${link}`;
  return (
    <section id="invite" className={`card scroll-mt-24 ${compact ? "" : "mb-4"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><UserPlus className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-brand-950">Invite your tenants</div>
          <p className="text-sm text-stone-600">Send them this link. They sign up with your number already filled in, and you confirm which unit they rent — then they can pay rent and report repairs in the app.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-primary btn-sm"><MessageCircle className="h-4 w-4" /> Send on WhatsApp</a>
            <CopyLink text={link} />
          </div>
        </div>
      </div>
    </section>
  );
}
