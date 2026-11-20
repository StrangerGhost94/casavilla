import "server-only";
import { Prisma } from "@prisma/client";
import { db, type User } from "@/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { reversePayment, waiveCharge } from "@/lib/billing";
import { ugx } from "@/lib/format";

/**
 * Four eyes: waivers, refunds and reversals are asked for by one person and only happen when a different super
 * admin approves. Both sign with their password, and both steps are in the audit trail.
 */
export const KINDS = {
  waive: "Waive a charge",
  refund: "Mark a deposit refund paid",
  reverse: "Reverse a cash or bank payment",
} as const;
export type Kind = keyof typeof KINDS;

type Payload = { chargeId?: number; amount?: number; leaseId?: number; method?: string; paymentId?: number };

export async function superAdminIds(except?: number) {
  return (await db.user.findMany({ where: { role: "manager", superAdmin: true, status: "active", ...(except ? { id: { not: except } } : {}) }, select: { id: true } })).map((u) => u.id);
}

/** Creates the request (one open request per thing). Returns an error message, or null when it was sent. */
export async function requestApproval(me: User, o: { kind: Kind; entity: string; entityId: number; summary: string; payload: Payload; reason: string }) {
  try {
    const r = await db.approvalRequest.create({ data: { kind: o.kind, entity: o.entity, entityId: o.entityId, summary: o.summary, payload: o.payload, reason: o.reason, requestedById: me.id } });
    await audit(me.id, `approval.requested`, o.entity, o.entityId, `${KINDS[o.kind]}: ${o.summary}`, db, { reason: o.reason, signed: true });
    for (const id of await superAdminIds(me.id)) await notify(id, `${me.name} asks you to approve: ${o.summary}`, `/manager/approvals`);
    return { ok: true as const, id: r.id };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false as const, error: "There is already a request waiting for this. See Approvals." };
    throw e;
  }
}

/** Carries out an approved request. Throws a plain-language reason if it can no longer be done. */
async function carryOut(kind: Kind, p: Payload, approver: User, reason: string) {
  if (kind === "waive") {
    const c = await db.charge.findUnique({ where: { id: p.chargeId ?? 0 }, include: { lease: { select: { tenantId: true } } } });
    if (!c) throw new Error("The charge no longer exists");
    const w = await waiveCharge(c.id, p.amount ?? 0, approver.id, reason, true);
    if (!w) throw new Error("Nothing is left to waive on this charge (it may have been paid)");
    await notify(c.lease.tenantId, `${ugx(w)} was waived on ${c.description}.`, "/tenant/rent");
    return;
  }
  if (kind === "refund") {
    const l = await db.lease.findUnique({ where: { id: p.leaseId ?? 0 } });
    if (!l || l.status !== "ended" || !l.settlement || l.settlement <= 0) throw new Error("No refund is due on this lease any more");
    if (l.settlement !== p.amount) throw new Error(`The refund due changed to ${ugx(l.settlement)} since the request. Ask again`);
    const done = await db.lease.updateMany({ where: { id: l.id, settlement: l.settlement }, data: { settlement: 0 } });
    if (!done.count) throw new Error("This lease was just updated. Try again");
    await notify(l.tenantId, `Your deposit refund of ${ugx(l.settlement)} has been paid (${p.method}). Your account is fully settled.`, "/tenant/lease");
    await audit(approver.id, "lease.refund_paid", "lease", l.id, `${ugx(l.settlement)} via ${p.method}`, db, { reason, signed: true });
    return;
  }
  if (kind === "reverse") {
    const pay = await reversePayment(p.paymentId ?? 0, approver.id, reason);
    await notify(pay.tenantId, `Your payment of ${ugx(pay.amount)} (receipt ${pay.receiptNo}) was cancelled because it was recorded by mistake. Contact CasaVilla if you have questions.`, "/tenant/rent");
  }
}

/** A super admin decides. They can't decide their own request. Returns an error message, or null. */
export async function decide(requestId: number, approver: User, approve: boolean, note: string): Promise<string | null> {
  const r = await db.approvalRequest.findUnique({ where: { id: requestId }, include: { requestedBy: { select: { name: true } } } });
  if (!r || r.status !== "pending") return "This request was already dealt with";
  if (r.requestedById === approver.id) return "You can't approve your own request. Another super admin must";
  const claimed = await db.approvalRequest.updateMany({ where: { id: r.id, status: "pending" }, data: { status: approve ? "approved" : "rejected", decidedById: approver.id, decidedAt: new Date(), decisionNote: note } });
  if (!claimed.count) return "This request was already dealt with";
  const why = `Requested by ${r.requestedBy.name}: ${r.reason}. Approved: ${note}`;
  if (approve) {
    try {
      await carryOut(r.kind as Kind, r.payload as Payload, approver, why.slice(0, 300));
    } catch (e) {
      // Reasons we give are plain sentences; anything else is unexpected and is logged, not shown.
      const unexpected = !(e instanceof Error) || e.constructor.name.startsWith("PrismaClient");
      if (unexpected) console.error("approval carry out", r.id, e);
      const msg = unexpected ? "something went wrong, so nothing was changed. Tell Eliherd Engineers" : (e as Error).message;
      await db.approvalRequest.update({ where: { id: r.id }, data: { status: "failed", decisionNote: `${note} — not done: ${msg}` } });
      await audit(approver.id, "approval.failed", r.entity, r.entityId, `${KINDS[r.kind as Kind]}: ${r.summary} — ${msg}`, db, { reason: note, signed: true });
      return `Approved, but it couldn't be done: ${msg}`;
    }
  }
  await audit(approver.id, approve ? "approval.approved" : "approval.rejected", r.entity, r.entityId, `${KINDS[r.kind as Kind]}: ${r.summary} (asked by ${r.requestedBy.name})`, db, { reason: note, signed: true });
  await notify(r.requestedById, `${approver.name} ${approve ? "approved" : "turned down"} your request: ${r.summary}`, "/manager/approvals");
  return null;
}
