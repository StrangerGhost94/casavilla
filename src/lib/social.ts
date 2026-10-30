// CasaVilla's social media accounts — the footer shows one icon per entry, in this order.
//
// PLACEHOLDERS: Facebook, Instagram, TikTok, X and YouTube point at each network's home page until CasaVilla's
// own pages exist. To go live, replace `url` with the profile link and delete `placeholder: true`, e.g.
//   facebook: { url: "https://www.facebook.com/casavillaug" },
export type Network = "whatsapp" | "facebook" | "instagram" | "tiktok" | "x" | "youtube";

export const SOCIAL: Record<Network, { url: string; placeholder?: true }> = {
  whatsapp: { url: "https://wa.me/256776593482" },
  facebook: { url: "https://www.facebook.com/", placeholder: true },
  instagram: { url: "https://www.instagram.com/", placeholder: true },
  tiktok: { url: "https://www.tiktok.com/", placeholder: true },
  x: { url: "https://x.com/", placeholder: true },
  youtube: { url: "https://www.youtube.com/", placeholder: true },
};

export const CONTACT = {
  phones: ["+256 776 593 482", "+256 756 390 089"],
  whatsapp: "https://wa.me/256776593482",
  email: "info.casavilla026@gmail.com",
  address: "P.O. Box 214887, Rubaga Road, Kampala, Uganda",
  maps: "https://www.google.com/maps/search/?api=1&query=Rubaga+Road,+Kampala,+Uganda",
};

/** WhatsApp chat with CasaVilla, optionally with a message typed in for them. */
export const waLink = (text?: string) => `${CONTACT.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export const tel = (phone: string) => `tel:${phone.replace(/\s/g, "")}`;
