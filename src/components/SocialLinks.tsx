import { siFacebook, siInstagram, siTiktok, siWhatsapp, siX, siYoutube } from "simple-icons";
import { SOCIAL } from "@/lib/social";

const NETWORKS = [
  { key: "whatsapp", label: "WhatsApp", icon: siWhatsapp },
  { key: "facebook", label: "Facebook", icon: siFacebook },
  { key: "instagram", label: "Instagram", icon: siInstagram },
  { key: "tiktok", label: "TikTok", icon: siTiktok },
  { key: "x", label: "X (Twitter)", icon: siX },
  { key: "youtube", label: "YouTube", icon: siYoutube },
] as const;

/** Round icon buttons for each CasaVilla account that has a link set in lib/social.ts. */
export function SocialLinks({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const list = NETWORKS.filter((n) => SOCIAL[n.key]);
  if (!list.length) return null;
  const btn = tone === "dark"
    ? "bg-white/10 text-white hover:bg-white/20"
    : "border border-stone-200 bg-white text-brand-900 hover:border-brand-300";
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {list.map((n) => (
        <a key={n.key} href={SOCIAL[n.key]} target="_blank" rel="noopener noreferrer" aria-label={`CasaVilla on ${n.label}`} title={n.label}
          className={`flex h-10 w-10 items-center justify-center rounded-full transition ${btn}`}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] fill-current" aria-hidden><path d={n.icon.path} /></svg>
        </a>
      ))}
    </div>
  );
}
