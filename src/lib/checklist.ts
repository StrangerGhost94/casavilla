import "server-only";
import { fail } from "@/lib/flash";

/**
 * The steps each approval needs, written down once so every new staff member follows the same process.
 * The form shows them as tick boxes; the action refuses until every one is ticked and records them in the audit trail.
 */
export const CHECKLISTS = {
  landlord: [
    ["id", "Saw their national ID (or company registration)"],
    ["call", "Spoke to them on the phone"],
    ["agreement", "Management agreement signed, with the commission entered here"],
  ],
  provider: [
    ["id", "Saw their ID or business registration"],
    ["call", "Spoke to them and checked their work or references"],
  ],
  property: [
    ["visited", "I visited it and it matches the address"],
    ["owner", "I checked the landlord owns it or may let it"],
    ["photos", "The photos are of this property"],
  ],
  sale: [
    ["authority", "The seller owns it, or their written authority to sell is on file"],
    ["location", "Location confirmed (visited, or checked on the map with the seller)"],
    ["photos", "The photos are of this property"],
  ],
  cash: [
    ["counted", "I counted the cash and it matches the cash total"],
    ["bank", "Bank payments match the bank slips or statement"],
    ["safe", "The cash is banked or locked away"],
  ],
  access: [
    ["people", "Everyone listed still works at CasaVilla and needs their account"],
    ["levels", "Only the right people are super admins"],
    ["leavers", "Anyone who has left is suspended"],
  ],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;
export type ChecklistName = keyof typeof CHECKLISTS;

/** Every box must be ticked. Returns the ticked steps, in words, for the audit trail. */
export async function requireChecklist(fd: FormData, name: ChecklistName): Promise<string[]> {
  const items = CHECKLISTS[name];
  if (items.some(([k]) => fd.get(`check_${k}`) !== "on")) return fail("Tick every step of the checklist first");
  return items.map(([, label]) => label);
}
