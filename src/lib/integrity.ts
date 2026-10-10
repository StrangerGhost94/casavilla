import "server-only";
import { db } from "@/db";

export type Check = { id: string; title: string; why: string; count: number; samples: string[]; fixable: boolean };

type Row = { id: number; label: string };

/** Each check finds records that contradict each other. Fixes only ever re-derive data from its source of truth. */
const CHECKS: { id: string; title: string; why: string; sql: string; fix?: string }[] = [
  {
    id: "charge-paid",
    title: "Charges whose paid amount doesn't match the money allocated to them",
    why: "Every shilling on a charge must come from a recorded payment, credit or deposit.",
    sql: `SELECT c.id, c.description || ' (lease ' || c.lease_id || '): shows ' || c.paid || ', allocated ' || COALESCE(a.s,0) AS label
          FROM charges c LEFT JOIN (SELECT charge_id, SUM(amount) s FROM allocations GROUP BY charge_id) a ON a.charge_id = c.id
          WHERE c.paid <> COALESCE(a.s, 0)`,
    fix: `UPDATE charges c SET paid = LEAST(c.amount, COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.charge_id = c.id), 0))
          WHERE c.paid <> COALESCE((SELECT SUM(a.amount) FROM allocations a WHERE a.charge_id = c.id), 0)`,
  },
  {
    id: "charge-status",
    title: "Charges with the wrong paid / unpaid status",
    why: "Status must follow from the amount paid, or balances and reminders go wrong.",
    sql: `SELECT id, description || ' (lease ' || lease_id || ')' AS label FROM charges
          WHERE status <> CASE WHEN paid >= amount THEN 'paid' WHEN paid > 0 THEN 'partial' ELSE 'unpaid' END`,
    fix: `UPDATE charges SET status = CASE WHEN paid >= amount THEN 'paid' WHEN paid > 0 THEN 'partial' ELSE 'unpaid' END
          WHERE status <> CASE WHEN paid >= amount THEN 'paid' WHEN paid > 0 THEN 'partial' ELSE 'unpaid' END`,
  },
  {
    id: "unit-occupied-no-lease",
    title: "Units marked occupied with no active lease",
    why: "They are hidden from listings and earn no rent.",
    sql: `SELECT u.id, p.name || ' · ' || u.label AS label FROM units u JOIN properties p ON p.id = u.property_id
          WHERE u.status = 'occupied' AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active')`,
    fix: `UPDATE units u SET status = 'vacant' WHERE u.status = 'occupied' AND NOT EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active')`,
  },
  {
    id: "unit-vacant-with-lease",
    title: "Units marked vacant while a tenant has an active lease",
    why: "They could be let twice.",
    sql: `SELECT u.id, p.name || ' · ' || u.label AS label FROM units u JOIN properties p ON p.id = u.property_id
          WHERE (u.status = 'vacant' OR u.listed) AND EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active')`,
    fix: `UPDATE units u SET status = 'occupied', listed = false WHERE (u.status = 'vacant' OR u.listed) AND EXISTS (SELECT 1 FROM leases l WHERE l.unit_id = u.id AND l.status = 'active')`,
  },
  {
    id: "double-lease",
    title: "Units or tenants with more than one active lease",
    why: "One unit can only be let to one tenant at a time. Review and end the wrong lease.",
    sql: `SELECT MIN(id) AS id, 'unit ' || unit_id || ' has ' || COUNT(*) || ' active leases' AS label FROM leases WHERE status = 'active' GROUP BY unit_id HAVING COUNT(*) > 1
          UNION ALL SELECT MIN(id), 'tenant ' || tenant_id || ' has ' || COUNT(*) || ' active leases' FROM leases WHERE status = 'active' GROUP BY tenant_id HAVING COUNT(*) > 1`,
  },
  {
    id: "orphan-pending-apps",
    title: "Pending applications for units that are already let",
    why: "Applicants are left waiting for a unit they can't get.",
    sql: `SELECT a.id, 'application ' || a.id || ' for unit ' || a.unit_id AS label FROM applications a JOIN units u ON u.id = a.unit_id
          WHERE a.status = 'pending' AND u.status = 'occupied'`,
    fix: `UPDATE applications a SET status = 'rejected' FROM units u WHERE u.id = a.unit_id AND a.status = 'pending' AND u.status = 'occupied'`,
  },
  {
    id: "suspended-provider-jobs",
    title: "Open jobs assigned to suspended providers",
    why: "Nobody will do the work.",
    sql: `SELECT j.id, '"' || j.title || '" — ' || COALESCE(us.business_name, us.name) AS label FROM jobs j JOIN users us ON us.id = j.provider_id
          WHERE us.status <> 'active' AND j.status IN ('assigned','quoted','accepted','in_progress')`,
    fix: `UPDATE jobs j SET provider_id = NULL, status = 'open', quote = NULL FROM users us WHERE us.id = j.provider_id
          AND us.status <> 'active' AND j.status IN ('assigned','quoted','accepted','in_progress')`,
  },
  {
    id: "stale-payments",
    title: "Mobile-money requests stuck as pending for over an hour",
    why: "They make it look like money is on its way when it isn't.",
    sql: `SELECT id, reference || ' — UGX ' || amount AS label FROM payments WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour'`,
    fix: `UPDATE payments SET status = 'failed' WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 hour' AND method IN ('mtn','airtel')`,
  },
  {
    id: "receipt-missing",
    title: "Successful payments without a receipt number",
    why: "Tenants need a receipt for every payment.",
    sql: `SELECT id, reference AS label FROM payments WHERE status = 'success' AND receipt_no IS NULL`,
    fix: `UPDATE payments SET receipt_no = 'CV-' || to_char(COALESCE(paid_at, created_at), 'YYYY') || '-' || lpad(id::text, 6, '0'), paid_at = COALESCE(paid_at, created_at)
          WHERE status = 'success' AND receipt_no IS NULL`,
  },
  {
    id: "lease-landlord",
    title: "Leases whose landlord isn't the owner of the property",
    why: "Rent would show up for the wrong landlord.",
    sql: `SELECT l.id, 'lease ' || l.id || ' — ' || p.name AS label FROM leases l JOIN units u ON u.id = l.unit_id JOIN properties p ON p.id = u.property_id
          WHERE l.status = 'active' AND l.landlord_id <> p.landlord_id`,
    fix: `UPDATE leases l SET landlord_id = p.landlord_id FROM units u JOIN properties p ON p.id = u.property_id
          WHERE u.id = l.unit_id AND l.status = 'active' AND l.landlord_id <> p.landlord_id`,
  },
  {
    id: "link-already-housed",
    title: "Connect requests from tenants who already have a lease",
    why: "The tenant is already connected, so the request is stale.",
    sql: `SELECT t.id, 'request ' || t.id || ' (tenant ' || t.tenant_id || ')' AS label FROM tenant_links t
          WHERE t.status = 'pending' AND EXISTS (SELECT 1 FROM leases l WHERE l.tenant_id = t.tenant_id AND l.status = 'active')`,
    fix: `UPDATE tenant_links t SET status = 'cancelled', decided_at = NOW() WHERE t.status = 'pending'
          AND EXISTS (SELECT 1 FROM leases l WHERE l.tenant_id = t.tenant_id AND l.status = 'active')`,
  },
  {
    id: "link-landlord-joined",
    title: "Connect requests waiting for a landlord who has since joined",
    why: "The landlord is on CasaVilla now but hasn't been shown the request.",
    sql: `SELECT t.id, 'request ' || t.id || ' → ' || u.name AS label FROM tenant_links t JOIN users u ON u.phone = t.landlord_phone AND u.role = 'landlord'
          WHERE t.status = 'pending' AND t.landlord_id IS NULL`,
    fix: `UPDATE tenant_links t SET landlord_id = (SELECT MIN(u.id) FROM users u WHERE u.phone = t.landlord_phone AND u.role = 'landlord')
          WHERE t.status = 'pending' AND t.landlord_id IS NULL AND EXISTS (SELECT 1 FROM users u WHERE u.phone = t.landlord_phone AND u.role = 'landlord')`,
  },
  {
    id: "locations-loaded",
    title: "Uganda location list not loaded",
    why: "Location pickers, area search and reports need the official list. It loads automatically on start — check the deploy logs.",
    sql: `SELECT 0 AS id, 'locations table is empty' AS label WHERE NOT EXISTS (SELECT 1 FROM locations)`,
  },
  {
    id: "location-tree",
    title: "Locations whose path doesn't match their parent",
    why: "Area filters use the path; a wrong one would put places in the wrong district.",
    sql: `SELECT 0 AS id, c.id || ' under ' || COALESCE(c.parent_id, '-') AS label FROM locations c LEFT JOIN locations p ON p.id = c.parent_id
          WHERE (c.parent_id IS NULL AND c.path <> '/' || c.id || '/') OR (c.parent_id IS NOT NULL AND (p.id IS NULL OR c.path <> p.path || c.id || '/'))`,
  },
  {
    id: "property-unlocated",
    title: "Properties not yet placed on the location list",
    why: "They only have an old text address, so area search, reports and provider matching can't use them. Open the property and confirm its suggested location.",
    sql: `SELECT id, name || ' — "' || location || '"' AS label FROM properties WHERE location_id IS NULL`,
  },
  {
    id: "job-location-drift",
    title: "Open repair jobs whose location differs from their property's",
    why: "A job must travel with its property so providers go to the right place.",
    sql: `SELECT j.id, '"' || j.title || '" — ' || p.name AS label FROM jobs j JOIN properties p ON p.id = j.property_id
          WHERE j.status NOT IN ('done','cancelled') AND p.location_id IS NOT NULL AND j.location_id IS DISTINCT FROM p.location_id`,
    fix: `UPDATE jobs j SET location_id = p.location_id FROM properties p WHERE p.id = j.property_id
          AND j.status NOT IN ('done','cancelled') AND p.location_id IS NOT NULL AND j.location_id IS DISTINCT FROM p.location_id`,
  },
  {
    id: "provider-no-area",
    title: "Approved providers with no service area",
    why: "They can't be matched to jobs by location. Ask them to add their areas under Business profile.",
    sql: `SELECT u.id, COALESCE(u.business_name, u.name) AS label FROM users u WHERE u.role = 'provider' AND u.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM provider_areas a WHERE a.provider_id = u.id)`,
  },
  {
    id: "booking-overlap",
    title: "Short-stay bookings that overlap on the same unit",
    why: "Two guests would arrive for the same nights. Cancel one of them.",
    sql: `SELECT a.id, 'bookings ' || a.reference || ' and ' || b.reference AS label FROM bookings a JOIN bookings b ON a.unit_id = b.unit_id AND a.id < b.id
          AND a.check_in < b.check_out AND b.check_in < a.check_out
          WHERE a.status IN ('confirmed','blocked') AND b.status IN ('confirmed','blocked')`,
  },
  {
    id: "booking-stale-hold",
    title: "Short-stay holds still pending after the payment window",
    why: "They block nights nobody has paid for.",
    sql: `SELECT id, reference AS label FROM bookings WHERE status = 'pending' AND created_at < NOW() - INTERVAL '35 minutes'`,
    fix: `UPDATE bookings SET status = 'expired', note = 'Payment window ended' WHERE status = 'pending' AND created_at < NOW() - INTERVAL '35 minutes'`,
  },
  {
    id: "lease-deposit-cap",
    title: "Active leases with a deposit above one month's rent",
    why: "The Landlord and Tenant Act, 2022 (s.30) allows at most one month's rent as a security deposit. Refund the excess or record it as advance rent.",
    sql: `SELECT id, 'lease ' || id || ': deposit ' || deposit || ' vs rent ' || rent AS label FROM leases WHERE status = 'active' AND deposit > rent`,
  },
  {
    id: "email-failed",
    title: "Emails that could not be delivered",
    why: "Check the email address, or the RESEND_API_KEY / MAIL_FROM settings.",
    sql: `SELECT id, to_email || ' — ' || COALESCE(error, '') AS label FROM email_outbox WHERE status = 'failed'`,
  },
  {
    id: "negative-credit",
    title: "Leases with credit while charges are still open",
    why: "Credit should be used up against what the tenant owes.",
    sql: `SELECT l.id, 'lease ' || l.id || ': credit ' || l.credit AS label FROM leases l
          WHERE l.status = 'active' AND l.credit > 0 AND EXISTS (SELECT 1 FROM charges c WHERE c.lease_id = l.id AND c.status <> 'paid')`,
  },
  {
    id: "message-failed",
    title: "WhatsApp / SMS messages that could not be delivered (last 7 days)",
    why: "Check the phone number, the WhatsApp template names and approval, or the Africa's Talking balance. See WhatsApp & SMS.",
    sql: `SELECT id, to_phone || ' — ' || COALESCE(error, '') AS label FROM message_outbox WHERE status = 'failed' AND created_at > now() - interval '7 days'`,
  },
  {
    id: "inspection-charge",
    title: "Move-out deductions that don't match their damage charge",
    why: "The charge raised from a move-out inspection should equal the deductions (unless part was waived). Reopen and resubmit the report, or adjust the charge.",
    sql: `SELECT i.id, 'inspection ' || i.id || ': deductions ' || i.deductions || ' vs charge ' || (c.amount + c.waived) AS label
          FROM inspections i JOIN charges c ON c.id = i.charge_id WHERE c.amount + c.waived <> i.deductions`,
  },
  {
    id: "expense-pending",
    title: "Caretaker expenses waiting more than two weeks for approval",
    why: "They're left off the landlord's statement until approved or rejected.",
    sql: `SELECT id, description || ' — ' || amount AS label FROM expenses WHERE status = 'pending' AND created_at < now() - interval '14 days'`,
  },
  {
    id: "sale-review-waiting",
    title: "Listings for sale waiting more than 3 days for review",
    why: "Sellers are waiting. Open Manager → For sale → To review.",
    sql: `SELECT id, title AS label FROM sale_listings WHERE status = 'pending' AND updated_at < now() - interval '3 days'`,
  },
  {
    id: "sale-no-photo",
    title: "Live listings for sale with no photos",
    why: "Listings without photos get very few enquiries — ask the seller to add some.",
    sql: `SELECT s.id, s.title AS label FROM sale_listings s WHERE s.status IN ('active', 'under_offer') AND NOT EXISTS (SELECT 1 FROM sale_photos p WHERE p.listing_id = s.id)`,
  },
  {
    id: "caretaker-wrong-landlord",
    title: "Caretaker assignments that don't match the property's landlord",
    why: "A caretaker should only work for the landlord who owns the property (e.g. after a property changed hands).",
    sql: `SELECT a.id, 'assignment ' || a.id || ' (property ' || a.property_id || ')' AS label FROM caretaker_assignments a JOIN properties p ON p.id = a.property_id WHERE p.landlord_id <> a.landlord_id`,
    fix: `UPDATE caretaker_assignments a SET landlord_id = p.landlord_id FROM properties p WHERE p.id = a.property_id AND p.landlord_id <> a.landlord_id`,
  },
];

export async function runChecks(): Promise<Check[]> {
  const out: Check[] = [];
  for (const c of CHECKS) {
    const rows = await db.$queryRawUnsafe<Row[]>(c.sql);
    out.push({ id: c.id, title: c.title, why: c.why, count: rows.length, samples: rows.slice(0, 5).map((r) => r.label), fixable: !!c.fix });
  }
  return out;
}

export async function fixCheck(id: string) {
  const c = CHECKS.find((x) => x.id === id);
  if (!c?.fix) return 0;
  const n = await db.$executeRawUnsafe(c.fix);
  // Fixing paid amounts can change statuses, so re-derive those too.
  if (id === "charge-paid") await db.$executeRawUnsafe(CHECKS.find((x) => x.id === "charge-status")!.fix!);
  return n;
}

export const checkIds = CHECKS.map((c) => c.id);
