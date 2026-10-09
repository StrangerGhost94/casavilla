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
    id: "negative-credit",
    title: "Leases with credit while charges are still open",
    why: "Credit should be used up against what the tenant owes.",
    sql: `SELECT l.id, 'lease ' || l.id || ': credit ' || l.credit AS label FROM leases l
          WHERE l.status = 'active' AND l.credit > 0 AND EXISTS (SELECT 1 FROM charges c WHERE c.lease_id = l.id AND c.status <> 'paid')`,
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
