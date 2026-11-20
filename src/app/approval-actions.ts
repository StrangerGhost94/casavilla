"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { requireSuperAdmin, requireUser } from "@/lib/auth";
import { fail } from "@/lib/flash";
import { requireSignature } from "@/lib/signature";
import { decide, requestApproval } from "@/lib/approvals";
import { audit } from "@/lib/audit";
import { ugx } from "@/lib/format";
import { id, int, oneOf } from "@/lib/validate";

const done = (to = "/manager/approvals") => { revalidatePath("/", "layout"); redirect(`${to}${to.includes("?") ? "&" : "?"}ok=sent`); };

/** Ask for part or all of a charge to be waived. A different super admin approves it. */
export async function requestWaiver(fd: FormData) {
  const me = await requireUser("manager");
  const c = await db.charge.findUnique({ where: { id: id(fd, "chargeId") }, include: { lease: { include: { tenant: { select: { name: true } } } } } });
  if (!c) return fail("Charge not found");
  const open = c.amount - c.paid;
  if (open <= 0) return fail("Nothing left to waive on this charge");
  const amount = await int(fd, "amount", "the amount to waive", { min: 1, max: open, fallback: open });
  const reason = await requireSignature(fd, me);
  const r = await requestApproval(me, { kind: "waive", entity: "charge", entityId: c.id, summary: `Waive ${ugx(amount)} on ${c.description} for ${c.lease.tenant.name}`, payload: { chargeId: c.id, amount }, reason });
  if (!r.ok) return fail(r.error);
  done();
}

/** Ask for a move-out deposit refund to be marked paid. */
export async function requestRefund(fd: FormData) {
  const me = await requireUser("manager");
  const l = await db.lease.findUnique({ where: { id: id(fd) }, include: { tenant: { select: { name: true } } } });
  if (!l || l.status !== "ended" || !l.settlement || l.settlement <= 0) return fail("No refund is due on this lease");
  const method = await oneOf(fd, "method", ["cash", "bank", "mobile money"] as const, "refund method", "cash");
  const reason = await requireSignature(fd, me);
  const r = await requestApproval(me, { kind: "refund", entity: "lease", entityId: l.id, summary: `Refund ${ugx(l.settlement)} to ${l.tenant.name} (${method})`, payload: { leaseId: l.id, amount: l.settlement, method }, reason });
  if (!r.ok) return fail(r.error);
  done();
}

/** Ask for a cash or bank payment recorded by mistake to be reversed. */
export async function requestReversal(fd: FormData) {
  const me = await requireUser("manager");
  const p = await db.payment.findUnique({ where: { id: id(fd) }, include: { tenant: { select: { name: true } } } });
  if (!p || p.status !== "success") return fail("Payment not found");
  if (!["cash", "bank"].includes(p.method)) return fail("Mobile Money payments are refunded through Flutterwave, not reversed here");
  const reason = await requireSignature(fd, me);
  const r = await requestApproval(me, { kind: "reverse", entity: "payment", entityId: p.id, summary: `Reverse ${ugx(p.amount)} ${p.method} payment from ${p.tenant.name} (receipt ${p.receiptNo})`, payload: { paymentId: p.id }, reason });
  if (!r.ok) return fail(r.error);
  done();
}

/** A super admin approves or turns down someone else's request, signing with their password. */
export async function decideRequest(fd: FormData) {
  const me = await requireSuperAdmin();
  const approve = fd.get("decision") === "approve";
  const note = await requireSignature(fd, me);
  const err = await decide(id(fd), me, approve, note);
  if (err) return fail(err);
  done();
}

/** The person who asked can withdraw a request that hasn't been decided. */
export async function cancelRequest(fd: FormData) {
  const me = await requireUser("manager");
  const r = await db.approvalRequest.findUnique({ where: { id: id(fd) } });
  if (!r || r.requestedById !== me.id) return fail("Request not found");
  const n = await db.approvalRequest.updateMany({ where: { id: r.id, status: "pending" }, data: { status: "cancelled", decidedAt: new Date() } });
  if (!n.count) return fail("This request was already dealt with");
  await audit(me.id, "approval.cancelled", r.entity, r.entityId, r.summary);
  done();
}
