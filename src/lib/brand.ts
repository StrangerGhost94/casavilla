import "server-only";
import { db } from "@/db";

export type Brand = {
  displayName: string; address: string | null; phone: string | null; email: string | null; tin: string | null;
  accentColor: string; footerNote: string | null; signatory: string | null; signatoryTitle: string | null;
  showCasaVilla: boolean; logoFileId: number | null; custom: boolean;
};

export const CASAVILLA: Brand = {
  displayName: "CasaVilla Property Management", address: "P.O. Box 214887, Rubaga Road, Kampala, Uganda",
  phone: "+256 776 593 482 · +256 756 390 089", email: "info.casavilla026@gmail.com", tin: null,
  accentColor: "#124331", footerNote: "Thank you for paying on time.", signatory: null, signatoryTitle: "For CasaVilla Property Management",
  showCasaVilla: true, logoFileId: null, custom: false,
};

/**
 * The look of every document tenants receive: CasaVilla's saved profile, else built-in. Owners stay anonymous to
 * tenants, so a landlord's own branding is never used (`landlordId` is kept so callers don't change).
 */
export async function brandFor(_landlordId?: number | null): Promise<Brand> {
  const b = await db.brandProfile.findFirst({ where: { ownerId: null } });
  if (!b) return CASAVILLA;
  return {
    displayName: b.displayName, address: b.address, phone: b.phone, email: b.email, tin: b.tin, accentColor: b.accentColor,
    footerNote: b.footerNote, signatory: b.signatory, signatoryTitle: b.signatoryTitle, showCasaVilla: b.showCasaVilla,
    logoFileId: b.logoFileId, custom: false,
  };
}
