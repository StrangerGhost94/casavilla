// Search engines: the site's address, readable listing links, and the area pages ("Houses for rent in Ntinda").
import { homeTitle } from "./listing-text";

/** The live site's address (set APP_URL in Railway to the custom domain when there is one). */
export const SITE = (process.env.APP_URL || "https://casavilla-production.up.railway.app").replace(/\/$/, "");
export const abs = (path: string) => (/^https?:/.test(path) ? path : `${SITE}${path.startsWith("/") ? "" : "/"}${path}`);

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "");
/** "8-2-bedroom-apartment-ntinda" → 8 (old links with just the number keep working). */
export const idFrom = (param: string) => Number.parseInt(param, 10) || 0;

/** The first part of an address, e.g. "Ntinda" from "Plot 4, Ntinda, Nakawa Division, Kampala". */
/** The area name to show / link, e.g. "Ntinda" from "Plot 4, Ntinda, Nakawa Division, Kampala". */
export const areaOf = (location: string) => location.split(",").map((x) => x.trim().replace(/\s+(road|rd|street|st|avenue|ave|close|lane|drive|hill)\.?$/i, "")).filter((x) => x && !/^plot\b/i.test(x) && !/\d/.test(x))[0] ?? "Kampala";
const place = (location: string) => location.split(",").map((x) => x.trim()).filter((x) => x && !/^plot\b/i.test(x) && !/\d/.test(x)).slice(0, 2).join(" ");

export const rentHref = (h: { id: number; bedrooms: number; type: string; location: string }) => `/listings/${h.id}-${slugify(`${homeTitle(h.bedrooms, h.type)} for rent ${place(h.location)}`)}`;
export const stayHref = (u: { id: number; label: string; property: { name: string; location: string } }) => `/stays/${u.id}-${slugify(`${u.property.name} ${place(u.property.location)}`)}`;
export const saleHref = (l: { id: number; title: string }) => `/sale/${l.id}-${slugify(l.title)}`;
export const providerHref = (p: { id: number; name: string }) => `/services/${p.id}-${slugify(p.name)}`;

// ---------------------------------------------------------------------------------------------------------------
// Area pages: /houses-for-rent/ntinda, /land-for-sale/mukono, /short-stays/entebbe, /houses-for-sale/kira

export const SEO_KINDS = {
  "houses-for-rent": { market: "rent", noun: "Houses & apartments for rent", short: "Houses for rent", saleKind: null },
  "short-stays": { market: "stays", noun: "Short stays & furnished apartments", short: "Short stays", saleKind: null },
  "land-for-sale": { market: "sale", noun: "Land & plots for sale", short: "Land for sale", saleKind: "land" },
  "houses-for-sale": { market: "sale", noun: "Houses for sale", short: "Houses for sale", saleKind: "house" },
} as const;
export type SeoKind = keyof typeof SEO_KINDS;

/** The neighbourhoods and towns people search for most (always linked; others appear once they have listings). */
export const POPULAR_AREAS = [
  "Kampala", "Ntinda", "Kira", "Najjera", "Kololo", "Bukoto", "Muyenga", "Naalya", "Kansanga", "Rubaga", "Munyonyo", "Bugolobi",
  "Nakawa", "Kyanja", "Kisaasi", "Namugongo", "Gayaza", "Seeta", "Mukono", "Wakiso", "Entebbe", "Kajjansi", "Nansana", "Kasangati",
];
export const areaSlug = (name: string) => slugify(name);
export const areaName = (slug: string) => POPULAR_AREAS.find((a) => slugify(a) === slug) ?? slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
export const areaHref = (kind: SeoKind, area: string) => `/${kind}/${areaSlug(area)}`;

// ---------------------------------------------------------------------------------------------------------------
// Structured data

export const ORG_ID = `${SITE}/#organization`;

/** CasaVilla as a real-estate agent in Kampala (shown on the home page; other pages refer to it by id). */
export function organizationLd(contact: { phones: readonly string[]; email: string }, sameAs: string[]) {
  return {
    "@context": "https://schema.org",
    "@type": ["RealEstateAgent", "LocalBusiness"],
    "@id": ORG_ID,
    name: "CasaVilla Property Management",
    url: SITE,
    logo: abs("/logo.png"),
    image: abs("/launch.jpg"),
    description: "Houses and apartments for rent, short stays, land and property for sale, and property management in Kampala and across Uganda.",
    telephone: contact.phones[0].replace(/\s/g, ""),
    email: contact.email,
    address: { "@type": "PostalAddress", streetAddress: "Rubaga Road", postOfficeBoxNumber: "214887", addressLocality: "Kampala", addressCountry: "UG" },
    geo: { "@type": "GeoCoordinates", latitude: 0.3029, longitude: 32.5527 },
    areaServed: [{ "@type": "City", name: "Kampala" }, { "@type": "AdministrativeArea", name: "Wakiso" }, { "@type": "AdministrativeArea", name: "Mukono" }, { "@type": "Country", name: "Uganda" }],
    priceRange: "UGX",
    currenciesAccepted: "UGX",
    paymentAccepted: "MTN Mobile Money, Airtel Money, Cash, Bank transfer",
    contactPoint: contact.phones.map((t) => ({ "@type": "ContactPoint", telephone: t.replace(/\s/g, ""), contactType: "customer service", areaServed: "UG", availableLanguage: ["English", "Luganda"] })),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** The site search box Google can show under the result. */
export const websiteLd = () => ({
  "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE}/#website`, url: SITE, name: "CasaVilla", publisher: { "@id": ORG_ID },
  potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE}/listings?q={search_term_string}` }, "query-input": "required name=search_term_string" },
});

/** Breadcrumb trail, e.g. Home › Houses for rent › Ntinda › This home. */
export const breadcrumbLd = (items: [string, string][]) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
});


/** schema.org listing for a home or plot: what it is, where, and the price. */
export function listingLd(o: {
  path: string; name: string; description?: string | null; image?: string | null; type: "Apartment" | "House" | "Accommodation" | "Residence" | "Landform";
  price: number; per?: "MON" | "DAY" | null; rooms?: number | null; bathrooms?: number | null; sizeSqm?: number | null;
  address: string; lat?: number | null; lng?: number | null; amenities?: string[]; available?: boolean; datePosted?: Date | null;
}) {
  const offer = {
    "@type": "Offer", price: o.price, priceCurrency: "UGX", url: abs(o.path),
    availability: o.available === false ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    ...(o.per ? { priceSpecification: { "@type": "UnitPriceSpecification", price: o.price, priceCurrency: "UGX", unitCode: o.per, referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: o.per } } } : {}),
    seller: { "@id": ORG_ID },
  };
  return {
    "@context": "https://schema.org", "@type": "RealEstateListing", url: abs(o.path), name: o.name,
    ...(o.description ? { description: o.description.slice(0, 500) } : {}), ...(o.image ? { image: abs(o.image) } : {}),
    ...(o.datePosted ? { datePosted: o.datePosted.toISOString().slice(0, 10) } : {}),
    offers: offer,
    about: {
      "@type": o.type, name: o.name,
      address: { "@type": "PostalAddress", streetAddress: o.address, addressCountry: "UG" },
      ...(o.lat != null && o.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: o.lat, longitude: o.lng } } : {}),
      ...(o.rooms != null ? { numberOfRooms: o.rooms, numberOfBedrooms: o.rooms } : {}),
      ...(o.bathrooms != null ? { numberOfBathroomsTotal: o.bathrooms } : {}),
      ...(o.sizeSqm ? { floorSize: { "@type": "QuantitativeValue", value: o.sizeSqm, unitCode: "MTK" } } : {}),
      ...(o.amenities?.length ? { amenityFeature: o.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })) } : {}),
    },
  };
}
