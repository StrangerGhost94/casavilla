import { siFacebook, siInstagram, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import { SOCIAL, type Network } from "@/lib/social";

const NETWORKS: { key: Network; label: string; icon: { path: string } }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: siWhatsapp },
  { key: "facebook", label: "Facebook", icon: siFacebook },
  { key: "instagram", label: "Instagram", icon: siInstagram },
  { key: "tiktok", label: "TikTok", icon: siTiktok },
  { key: "x", label: "X", icon: siX },
  { key: "youtube", label: "YouTube", icon: siYoutube },
];

/**
 * One round icon per CasaVilla account in lib/social.ts. On hover each lifts and takes a gold ring.
 * Networks still marked `placeholder` (no CasaVilla page yet) are left out, so no icon leads nowhere.
 */
export function SocialLinks({ tone = "dark", size = "md", className = "" }: { tone?: "dark" | "light"; size?: "sm" | "md"; className?: string }) {
  const btn = tone === "dark"
    ? "bg-white/[0.07] text-white/85 ring-1 ring-white/10 hover:bg-gold-400 hover:text-brand-950 hover:ring-gold-400"
    : "bg-white text-brand-900 ring-1 ring-stone-200 hover:bg-brand-900 hover:text-white hover:ring-brand-900";
  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="CasaVilla on social media">
      {NETWORKS.filter((n) => !SOCIAL[n.key].placeholder).map((n) => (
        <li key={n.key}>
          <a href={SOCIAL[n.key].url} target="_blank" rel="noopener noreferrer" aria-label={`CasaVilla on ${n.label}`} title={n.label}
            className={`flex ${box} items-center justify-center rounded-full transition duration-200 hover:-translate-y-0.5 ${btn}`}>
            <svg viewBox="0 0 24 24" className="h-[17px] w-[17px] fill-current" aria-hidden><path d={n.icon.path} /></svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
