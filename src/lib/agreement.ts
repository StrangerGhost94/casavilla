import "server-only";
import { db } from "@/db";
import { brandFor } from "./brand";
import { fmtDate, kampalaToday, ugx, ymd } from "./format";
import { crumbText, trailFor } from "./geo";
import { CHARGE_KIND_LABEL, LATE_FEE_GRACE_DAYS } from "./rules";
import { PdfWriter, embedLogo } from "./pdf";

/** "1,200,000" → "One million two hundred thousand" (for the rent clause, as tenancy agreements usually show). */
export function ugxWords(n: number): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const under1000 = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const rest = r < 20 ? ones[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? `-${ones[r % 10]}` : ""}`;
    return [h ? `${ones[h]} hundred` : "", rest].filter(Boolean).join(h && rest ? " and " : "");
  };
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [v, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]] as const) {
    const q = Math.floor(n / v); n %= v;
    if (q) parts.push(`${under1000(q)}${name ? ` ${name}` : ""}`);
  }
  const s = parts.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * A residential tenancy agreement drafted from the lease record, following the Landlord and Tenant Act, 2022.
 * It is a draft for the parties to read, adjust and sign — not legal advice.
 */
export async function agreementPdf(leaseId: number) {
  const l = await db.lease.findUniqueOrThrow({
    where: { id: leaseId },
    include: { tenant: true, landlord: true, unit: { include: { property: true } }, charges: { where: { kind: { in: ["utility", "repair", "other"] } }, select: { kind: true }, take: 1 } },
  });
  const p = l.unit.property;
  const [brand, trail] = await Promise.all([brandFor(l.landlordId), trailFor(p.locationId)]);
  const fixedMonths = Math.max(1, Math.round((Date.parse(ymd(l.endDate)) - Date.parse(ymd(l.startDate))) / (30.44 * 86400000)));
  const w = await PdfWriter.create({ accent: brand.accentColor, title: `Tenancy agreement — ${p.name} ${l.unit.label}`, author: brand.displayName, footer: `Tenancy agreement · ${p.name} · ${l.unit.label} · Lease #${l.id}` });

  const logo = await embedLogo(w, brand.logoFileId);
  if (logo) { const top = w.y; w.image(logo, 120, 48); w.y = top; }
  w.text(brand.displayName, { size: 9, bold: true, align: "right" });
  if (brand.address) w.text(brand.address, { size: 8, align: "right" });
  w.y -= 26;
  w.text("RESIDENTIAL TENANCY AGREEMENT", { size: 17, bold: true, align: "center", color: w.accent });
  w.text("Made under the Landlord and Tenant Act, 2022 (Republic of Uganda)", { size: 9, align: "center", italic: true });
  w.text(`DRAFT prepared ${fmtDate(kampalaToday())} — read carefully before signing`, { size: 8, align: "center" });
  w.gap(6); w.rule(w.accent);

  let n = 0;
  const clause = (title: string, body: string[]) => { w.heading(`${++n}. ${title}`, 11); for (const b of body) { w.text(b, { size: 9.5, leading: 13.5 }); w.gap(3); } };

  clause("The parties", [
    `This agreement is made on ____________________ between:`,
    `THE LANDLORD: ${l.landlord.name}, telephone ${l.landlord.phone}${l.landlord.email ? `, email ${l.landlord.email}` : ""}${brand.custom ? `, trading as ${brand.displayName}` : ""}. National ID / registration no.: ____________________`,
    `THE TENANT: ${l.tenant.name}, telephone ${l.tenant.phone}${l.tenant.email ? `, email ${l.tenant.email}` : ""}. National ID (NIN) / passport no.: ____________________`,
    `As section 3(5) of the Act requires, the landlord has been shown the tenant's identification document before this tenancy is entered into.`,
  ]);
  const features = [`${l.unit.bedrooms} bedroom${l.unit.bedrooms === 1 ? "" : "s"}`, `${l.unit.bathrooms} bathroom${l.unit.bathrooms === 1 ? "" : "s"}`, l.unit.selfContained ? "self-contained" : null, l.unit.furnished ? "furnished" : "unfurnished"].filter(Boolean).join(", ");
  clause("The premises", [
    `The landlord lets to the tenant ${l.unit.label} at ${p.name}, ${p.location}${trail.length > 1 ? ` (${crumbText(trail, true)})` : ""}${p.plot ? `, Plot ${p.plot}` : ""}${p.landmark ? `. Landmark: ${p.landmark}` : ""}.`,
    `The premises are ${features}, to be used as a private residence only.${l.unit.amenities.length ? ` Included: ${l.unit.amenities.join(", ")}.` : ""}`,
  ]);
  clause("Term", [
    `The tenancy is for a fixed term of about ${fixedMonths} month${fixedMonths === 1 ? "" : "s"}, from ${fmtDate(l.startDate)} to ${fmtDate(l.endDate)}, and ends on that date unless renewed (section 37).`,
    `If the tenant stays on with the landlord's consent after the end date, the tenancy continues from month to month on the same terms and either party may end it by giving at least thirty (30) days' written notice (section 38(2)).`,
  ]);
  clause("Rent", [
    `The rent is ${ugx(l.rent)} (${ugxWords(l.rent)} Uganda shillings) per month, payable in Uganda shillings (section 22) on or before day ${l.dueDay} of each month.`,
    `Rent may be paid by MTN Mobile Money or Airtel Money through the CasaVilla app, or in cash or by bank transfer to the landlord. A receipt stating the amount and the period covered will be issued for every payment (section 25); CasaVilla issues these electronically.`,
    `The landlord will not demand more than three (3) months' rent in advance unless both parties agree otherwise (section 24). Money paid ahead is credited to the following months.`,
    ...(l.nextRent && l.nextRentFrom ? [`The parties have agreed that the rent becomes ${ugx(l.nextRent)} per month from ${fmtDate(l.nextRentFrom)}.`] : []),
  ]);
  clause("Late payment", [
    l.lateFeePct ? `If rent is not paid within ${LATE_FEE_GRACE_DAYS} days of the due date, a late fee of ${l.lateFeePct}% of that month's rent is added once for that month.` : `No late fee is charged, but rent must be paid on time.`,
    `Where rent remains unpaid for more than thirty (30) days, the landlord may recover it through court, or re-enter the premises only in the presence of an area local council official and the police, as section 29 provides. The landlord will not evict the tenant in any other way (section 45).`,
  ]);
  clause("Rent review", [
    `The rent will not be increased during the fixed term unless both parties agree in writing (section 26(3)).`,
    `Any later increase requires at least sixty (60) days' written notice, may not be made more than once in twelve months, and may not exceed ten percent (10%) a year unless the parties agree otherwise (section 26).`,
  ]);
  clause("Security deposit", [
    l.deposit ? `The tenant pays a security deposit of ${ugx(l.deposit)}, which does not exceed one month's rent (section 30(2)). The landlord will issue a written receipt for it (section 30(5)).` : `No security deposit is payable under this agreement.`,
    `At the end of the tenancy the landlord may keep from the deposit only: (a) rent or bills still unpaid, and (b) the reasonable cost of repairing damage caused by the tenant beyond fair wear and tear (sections 30(3) and 30(4)). The balance is refunded to the tenant, with a written statement of any deductions. The deposit may not be used as the last month's rent unless the landlord agrees.`,
  ]);
  clause("Utilities and charges", [
    `The tenant pays for separately metered electricity (e.g. Yaka/UMEME), water and gas used in the premises (section 12)${l.charges.length ? `, and any other agreed bills (${l.charges.map((c) => CHARGE_KIND_LABEL[c.kind].toLowerCase()).join(", ")}) recorded on the tenant's CasaVilla account` : ""}.`,
    `The landlord pays the property's taxes and rates (section 10) and the cost of utility connections (section 13).`,
  ]);
  clause("The landlord's obligations", [
    `The landlord will hand over the premises fit for human habitation and keep the exterior and common areas fit and in good repair (sections 6 and 7); carry out repairs reported by the tenant within a reasonable time; allow the tenant quiet enjoyment of the premises (section 19); reduce the rent proportionately if an agreed service is withdrawn (section 28); and reimburse the tenant within fourteen days of a written request for any cost the landlord is liable for under the Act (section 47).`,
  ]);
  clause("The tenant's obligations", [
    `The tenant will pay rent and bills on time; use the premises lawfully and not cause a nuisance to neighbours (sections 14 and 15); take reasonable care of the premises and report damage promptly — repairs can be reported in the CasaVilla app (section 16); keep the premises reasonably clean (section 17); and not make alterations or fix fixtures without the landlord's written consent, restoring the premises at the end of the tenancy, fair wear and tear excepted (section 18).`,
  ]);
  clause("Entry by the landlord", [
    `The landlord may enter the premises at reasonable times to inspect, repair or show them, after giving the tenant at least twenty-four (24) hours' written notice, except in an emergency (sections 6(4) and 48).`,
  ]);
  clause("Assignment and subletting", [
    `The tenant may not assign the tenancy or sublet all or part of the premises without the landlord's written consent, which will not be unreasonably withheld. An assignment or sublease without consent is invalid (sections 31 to 33).`,
  ]);
  clause("Ending the tenancy", [
    `The tenancy ends on the end date, or earlier by written agreement stating the date the tenant will move out (sections 35 and 37). The tenant will hand back the premises and keys in the condition received, fair wear and tear excepted.`,
    `If the tenant is absent for thirty (30) consecutive days without notice and rent is unpaid, the premises may be treated as abandoned, after the landlord has given fourteen (14) days' notice (section 39).`,
  ]);
  clause("Disputes", [
    `The parties will first try to settle any dispute amicably, with CasaVilla's help if needed. Either party may then go to court, including the local council courts (sections 2 and 41). The tenant continues to pay rent while a dispute about a termination is being decided (section 41(3)).`,
  ]);
  clause("Notices and copies", [
    `Notices under this agreement must be in writing and may be delivered by hand, by email, or through the CasaVilla app to the contacts above. The landlord will give the tenant a signed copy of this agreement immediately after it is signed (section 5).`,
  ]);
  if (l.specialTerms?.trim()) clause("Special terms agreed by the parties", l.specialTerms.split(/\n+/).filter(Boolean));
  clause("Whole agreement", [`This document, together with the Landlord and Tenant Act, 2022, is the whole agreement between the parties. Where a term conflicts with the Act, the Act prevails.`]);

  w.gap(6);
  w.signature([{ label: "Landlord", name: l.landlord.name }, { label: "Tenant", name: l.tenant.name }]);
  w.signature([{ label: "Witness for the landlord" }, { label: "Witness for the tenant" }]);
  w.gap(10);
  w.text("This draft was prepared automatically by CasaVilla from the lease details and the Landlord and Tenant Act, 2022. It is not legal advice — the parties should read it carefully and may have it reviewed by a lawyer before signing.", { size: 7.5, italic: true });
  return { bytes: await w.bytes(), filename: `Tenancy-agreement-${p.name}-${l.unit.label}.pdf` };
}

/** Keeps a dated copy of the drafted agreement with the lease's documents (on creation and renewal). */
export async function saveAgreementSnapshot(leaseId: number, actorId: number, why: string) {
  try {
    const { bytes, filename } = await agreementPdf(leaseId);
    const file = await db.file.create({ data: { ownerId: actorId, name: filename, mimeType: "application/pdf", size: bytes.length, data: Buffer.from(bytes), isPublic: false }, select: { id: true } });
    await db.document.create({ data: { fileId: file.id, leaseId, uploadedById: actorId, kind: "agreement", title: `Tenancy agreement — draft (${why}, ${fmtDate(kampalaToday())})` } });
  } catch (e) {
    console.error("agreement snapshot failed", e);
  }
}
