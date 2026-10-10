// Shared by server and client: labels and formatting for land & property for sale.

export const SALE_KINDS = ["land", "house", "apartment", "commercial", "farm"] as const;
export type SaleKind = (typeof SALE_KINDS)[number];
export const KIND: Record<SaleKind, { label: string; plural: string }> = {
  land: { label: "Land / plot", plural: "Land & plots" },
  house: { label: "House", plural: "Houses" },
  apartment: { label: "Apartment / condo", plural: "Apartments" },
  commercial: { label: "Commercial building", plural: "Commercial" },
  farm: { label: "Farm land", plural: "Farms" },
};

/** Uganda's land tenure systems (plus kibanja — occupancy on someone else's mailo land). */
export const TENURES = ["mailo", "freehold", "leasehold", "customary", "kibanja"] as const;
export const TENURE: Record<string, { label: string; hint: string }> = {
  mailo: { label: "Mailo", hint: "Owned outright with a mailo title (common in Buganda)" },
  freehold: { label: "Freehold", hint: "Owned outright, forever" },
  leasehold: { label: "Leasehold", hint: "Held for a fixed number of years from a landlord (e.g. 49 or 99 years)" },
  customary: { label: "Customary", hint: "Held under local custom; a certificate of customary ownership may exist" },
  kibanja: { label: "Kibanja", hint: "Occupancy on someone else's mailo land — the landlord's consent is needed to sell" },
};
export const TITLE_STATUSES = ["titled", "processing", "none"] as const;
export const TITLE: Record<string, string> = { titled: "Land title available", processing: "Title being processed", none: "No title" };

export const SIZE_UNITS = ["acres", "decimals", "hectares", "sqm"] as const;
export const SIZE_UNIT: Record<string, string> = { acres: "acres", decimals: "decimals", hectares: "hectares", sqm: "m²" };
/** 1 acre = 100 decimals = 4,046.86 m² = 0.404686 ha. */
export function toAcres(v: number, unit: string) {
  return unit === "acres" ? v : unit === "decimals" ? v / 100 : unit === "hectares" ? v / 0.404686 : unit === "sqm" ? v / 4046.86 : NaN;
}

export const SALE_FEATURES = [
  "Tarmac road access", "Murram road access", "Power (Umeme) on site", "Water (NWSC) on site", "Fenced / walled", "Gated estate",
  "Flat land", "Gentle slope", "Ready to build", "Approved building plans", "Near main road", "Near schools", "Near hospital",
  "Boys' quarters", "Parking", "Garden", "Swimming pool", "Furnished", "Solar", "Borehole",
] as const;

export const STATUS: Record<string, { label: string; tone: "green" | "gold" | "gray" | "red" | "blue" }> = {
  pending: { label: "Waiting for review", tone: "gold" }, active: { label: "Live", tone: "green" }, under_offer: { label: "Under offer", tone: "blue" },
  sold: { label: "Sold", tone: "gray" }, withdrawn: { label: "Withdrawn", tone: "gray" }, rejected: { label: "Needs changes", tone: "red" },
};
export const PUBLIC_STATUSES = ["active", "under_offer"] as const;

/** UGX 350,000,000 → "UGX 350M"; 1,250,000,000 → "UGX 1.25B" (cards); full figure on the listing page. */
export function shortUgx(n: number) {
  const f = (x: number) => (Math.round(x * 100) / 100).toString();
  if (n >= 1e9) return `UGX ${f(n / 1e9)}B`;
  if (n >= 1e6) return `UGX ${f(n / 1e6)}M`;
  if (n >= 1e3) return `UGX ${f(n / 1e3)}K`;
  return `UGX ${n}`;
}
export const fullUgx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-US")}`;

export function sizeText(l: { sizeValue: number | null; sizeUnit: string | null; plotDims: string | null }) {
  const parts: string[] = [];
  if (l.sizeValue && l.sizeUnit) parts.push(`${Number(l.sizeValue.toFixed(2)).toLocaleString("en-US")} ${SIZE_UNIT[l.sizeUnit] ?? l.sizeUnit}`);
  if (l.plotDims) parts.push(l.plotDims);
  return parts.join(" · ");
}

/** For land: price per acre, the way buyers compare plots. */
export function perAcre(l: { price: number; sizeValue: number | null; sizeUnit: string | null }) {
  if (!l.sizeValue || !l.sizeUnit) return null;
  const a = toAcres(l.sizeValue, l.sizeUnit);
  return a > 0 && Number.isFinite(a) ? Math.round(l.price / a) : null;
}

export const PRICE_STEPS = [50e6, 100e6, 250e6, 500e6, 1e9, 2e9] as const;
