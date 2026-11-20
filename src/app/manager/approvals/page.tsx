import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { KINDS, type Kind } from "@/lib/approvals";
import { Badge, PageHeader, SectionTitle } from "@/components/ui";
import { ConfirmSubmit, Submit } from "@/components/client";
import { Signature } from "@/components/Signature";
import { cancelRequest, decideRequest } from "@/app/approval-actions";

export const metadata = { title: "Approvals" };

const STATUS: Record<string, { label: string; color: "gold" | "green" | "red" | "gray" }> = {
  pending: { label: "Waiting", color: "gold" }, approved: { label: "Approved & done", color: "green" }, rejected: { label: "Turned down", color: "red" },
  cancelled: { label: "Withdrawn", color: "gray" }, failed: { label: "Approved, not done", color: "red" },
};

/** Waivers, refunds and reversals need a second person: anyone in the office asks, a different super admin decides. */
export default async function Approvals() {
  const me = await requireUser("manager");
  const include = { requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } } as const;
  const [waiting, mine, decided] = await Promise.all([
    me.superAdmin ? db.approvalRequest.findMany({ where: { status: "pending", requestedById: { not: me.id } }, orderBy: { createdAt: "asc" }, include }) : [],
    db.approvalRequest.findMany({ where: { requestedById: me.id }, orderBy: { createdAt: "desc" }, take: 30, include }),
    me.superAdmin ? db.approvalRequest.findMany({ where: { status: { not: "pending" }, requestedById: { not: me.id } }, orderBy: { decidedAt: "desc" }, take: 30, include }) : [],
  ]);
  const Row = ({ r, children }: { r: (typeof mine)[number]; children?: React.ReactNode }) => (
    <div className="px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-stone-800">{r.summary}</span>
        <Badge color={STATUS[r.status]?.color ?? "gray"}>{STATUS[r.status]?.label ?? r.status}</Badge>
      </div>
      <div className="text-xs text-stone-500">{KINDS[r.kind as Kind] ?? r.kind} · asked by {r.requestedBy.name}, {fmtDateTime(r.createdAt)}</div>
      <div className="text-xs text-stone-700">Reason: {r.reason}</div>
      {r.decidedBy && <div className="text-xs text-stone-500">{r.decidedBy.name}, {fmtDateTime(r.decidedAt)}{r.decisionNote ? `: ${r.decisionNote}` : ""}</div>}
      {children}
    </div>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <PageHeader title="Approvals" subtitle="Waivers, refunds and reversals need two people: one asks, a different super admin approves." />

      {me.superAdmin && (
        <section>
          <SectionTitle title={`Waiting for you${waiting.length ? ` · ${waiting.length}` : ""}`} />
          <div className="card divide-y divide-stone-100 p-0">
            {waiting.length === 0 && <div className="muted p-4">Nothing to approve.</div>}
            {waiting.map((r) => (
              <Row key={r.id} r={r}>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <form action={decideRequest} className="space-y-1.5 rounded-xl border border-brand-100 bg-brand-50/50 p-2.5">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" />
                    <Signature reasonHint="Why it's right, e.g. checked the receipt book" />
                    <Submit className="btn-primary btn-sm">Approve &amp; do it</Submit>
                  </form>
                  <form action={decideRequest} className="space-y-1.5 rounded-xl border border-stone-200 p-2.5">
                    <input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="reject" />
                    <Signature reasonHint="Why not?" />
                    <Submit className="btn-outline btn-sm">Turn down</Submit>
                  </form>
                </div>
              </Row>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Your requests" />
        <div className="card divide-y divide-stone-100 p-0">
          {mine.length === 0 && <div className="muted p-4">You haven&apos;t asked for anything. Ask from a tenant&apos;s charges (waive), a finished lease (refund) or a receipt (reverse).</div>}
          {mine.map((r) => (
            <Row key={r.id} r={r}>
              {r.status === "pending" && (
                <form action={cancelRequest} className="mt-1.5"><input type="hidden" name="id" value={r.id} />
                  <ConfirmSubmit message="Withdraw this request?" className="text-xs font-semibold text-maroon-600 hover:underline">Withdraw</ConfirmSubmit></form>
              )}
            </Row>
          ))}
        </div>
      </section>

      {me.superAdmin && decided.length > 0 && (
        <section>
          <SectionTitle title="Recently decided" />
          <div className="card divide-y divide-stone-100 p-0">{decided.map((r) => <Row key={r.id} r={r} />)}</div>
        </section>
      )}
    </div>
  );
}
