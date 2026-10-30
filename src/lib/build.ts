// Build with CasaVilla: CasaVilla's own design & build service (plans, approvals, construction, renovation).
import { shortUgx } from "./sales";

export const PLAN_STYLES = {
  bungalow: { label: "Bungalow", plural: "Bungalows" },
  storeyed: { label: "Storeyed house", plural: "Storeyed houses" },
  apartments: { label: "Apartment block", plural: "Apartment blocks" },
  commercial: { label: "Commercial building", plural: "Commercial buildings" },
} as const;
export type PlanStyle = keyof typeof PLAN_STYLES;
export const PLAN_STYLE_KEYS = Object.keys(PLAN_STYLES) as PlanStyle[];

/** What someone can ask CasaVilla to do. */
export const BUILD_KINDS = {
  house: { label: "Build a house", short: "House", hint: "A family home: bungalow or storeyed" },
  apartments: { label: "Build apartments or rentals", short: "Apartments", hint: "Rental units, apartment blocks, row houses" },
  commercial: { label: "Build commercial", short: "Commercial", hint: "Shops, offices, a hotel or a school" },
  renovation: { label: "Renovate or extend", short: "Renovation", hint: "Add rooms, a floor, new finishes" },
  plans: { label: "Plans & approvals only", short: "Plans only", hint: "Architectural drawings and council approval" },
} as const;
export type BuildKind = keyof typeof BUILD_KINDS;
export const BUILD_KIND_KEYS = Object.keys(BUILD_KINDS) as BuildKind[];

export const PROJECT_KINDS = { house: "House", apartments: "Apartments", commercial: "Commercial", renovation: "Renovation" } as const;
export type ProjectKind = keyof typeof PROJECT_KINDS;

export const PLOT = { yes: "I have a plot", buying: "I'm buying one", no: "Not yet" } as const;
export const TIMELINE = { asap: "As soon as possible", "3m": "Within 3 months", "6m": "Within 6 months", later: "Later / just planning" } as const;

export const REQUEST_STATUS: Record<string, { label: string; tone: "green" | "gold" | "gray" | "red" | "blue" }> = {
  new: { label: "New", tone: "blue" },
  contacted: { label: "Contacted", tone: "gold" },
  site_visit: { label: "Site visit", tone: "gold" },
  quoted: { label: "Quote sent", tone: "gold" },
  won: { label: "Agreed", tone: "green" },
  lost: { label: "Not going ahead", tone: "gray" },
};
export const REQUEST_STATUS_KEYS = ["new", "contacted", "site_visit", "quoted", "won", "lost"] as const;

/** What CasaVilla does, in the order shown on the Build page. */
export const BUILD_SERVICES = [
  { icon: "plans", title: "Architectural plans", text: "House plans drawn for your plot, your budget and the way you live — or pick a ready-made plan." },
  { icon: "approval", title: "Approvals & permits", text: "Structural drawings and building approval from KCCA or your municipality, handled for you." },
  { icon: "costing", title: "Costing & bill of quantities", text: "A clear bill of quantities and a fixed quote by stage, so you know the cost before a brick is laid." },
  { icon: "build", title: "Construction", text: "Family homes, apartment blocks and commercial buildings, built and supervised by CasaVilla." },
  { icon: "renovate", title: "Renovation & extensions", text: "Add rooms or a floor, re-roof, re-plaster, new kitchens, bathrooms and finishes." },
  { icon: "supervise", title: "Supervision & handover", text: "Regular site supervision, photo updates at every stage, and a snag list cleared before handover." },
] as const;

/** From the first call to the keys. */
export const BUILD_STEPS = [
  ["Talk to us", "Tell us what you want to build, where and your budget. It's free."],
  ["Site visit", "We visit the plot, check access, soil and boundaries, and listen."],
  ["Design", "Plans drawn and refined with you, then structural drawings."],
  ["Quote", "A bill of quantities and a fixed price, paid stage by stage."],
  ["Approvals", "We submit the plans and get your building permit."],
  ["Build", "Foundation, walls, roof, finishes — with photo updates at each stage."],
  ["Handover", "A final walk-through, snags fixed, keys in your hand."],
] as const;

export const buildCost = (p: { buildFrom: number | null; buildTo: number | null }) =>
  p.buildFrom && p.buildTo ? `${shortUgx(p.buildFrom)} – ${shortUgx(p.buildTo).replace("UGX ", "")}` : p.buildFrom ? `from ${shortUgx(p.buildFrom)}` : null;

/** "3-bedroom bungalow · 120 m² · 1 floor" */
export function planFacts(p: { style: string; bedrooms: number | null; bathrooms: number | null; floors: number; areaSqm: number | null }) {
  return [
    p.bedrooms != null ? `${p.bedrooms} bed` : null,
    p.bathrooms != null ? `${p.bathrooms} bath` : null,
    p.floors > 1 ? `${p.floors} floors` : null,
    p.areaSqm ? `${p.areaSqm} m²` : null,
  ].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------------------------------------------
// Building sites (agreed jobs)

export const SITE_STATUS: Record<string, { label: string; tone: "green" | "gold" | "gray" | "red" | "blue" }> = {
  active: { label: "Under way", tone: "green" }, on_hold: { label: "On hold", tone: "gold" },
  handed_over: { label: "Handed over", tone: "blue" }, cancelled: { label: "Cancelled", tone: "gray" },
};
export const SITE_STATUS_KEYS = ["active", "on_hold", "handed_over", "cancelled"] as const;

export const STAGE_STATUS: Record<string, { label: string; tone: "green" | "gold" | "gray" | "red" | "blue" }> = {
  upcoming: { label: "Coming up", tone: "gray" }, in_progress: { label: "In progress", tone: "gold" }, done: { label: "Done", tone: "green" },
};
export const STAGE_STATUS_KEYS = ["upcoming", "in_progress", "done"] as const;

/** A starting split of the contract sum (staff change names and amounts per job). Percentages add up to 100. */
export const STAGE_TEMPLATE: [string, number][] = [
  ["Deposit & mobilisation", 20], ["Foundation", 15], ["Walls to ring beam", 20], ["Roofing", 15],
  ["Plastering, plumbing & wiring", 15], ["Finishes & handover", 15],
];

export const PAY_METHOD: Record<string, string> = { mtn: "MTN Mobile Money", airtel: "Airtel Money", cash: "Cash", bank: "Bank transfer" };
