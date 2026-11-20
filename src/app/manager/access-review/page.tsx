import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { requireSuperAdmin } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { accessReviewThisMonth } from "@/lib/controls";
import { Badge, PageHeader } from "@/components/ui";
import { Submit } from "@/components/client";
import { Checklist } from "@/components/Checklist";
import { Signature } from "@/components/Signature";
import { completeAccessReview } from "@/app/control-actions";

export const metadata = { title: "Access review" };

/** Once a month a super admin confirms that only the right people have office accounts, at the right level. */
export default async function AccessReview() {
  await requireSuperAdmin();
  const [staff, done, last] = await Promise.all([
    db.user.findMany({ where: { role: "manager" }, orderBy: [{ status: "asc" }, { superAdmin: "desc" }, { name: "asc" }] }),
    accessReviewThisMonth(),
    db.auditLog.findFirst({ where: { action: "access.reviewed" }, orderBy: { seq: "desc" } }),
  ]);
  const stale = (d: Date | null) => !d || Date.now() - d.getTime() > 30 * 86400000;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Monthly access review" subtitle="Check who has an office account and at what level. Suspend anyone who has left." />
      <div className="card overflow-x-auto p-0">
        <table className="table table-stack">
          <thead><tr><th>Name</th><th>Level</th><th>Status</th><th>Last sign-in</th><th>Set up</th><th></th></tr></thead>
          <tbody>
            {staff.map((u) => (
              <tr key={u.id}>
                <td data-label="" className="font-medium">{u.name}<div className="text-xs font-normal text-stone-500">{u.email}</div></td>
                <td data-label="Level">{u.superAdmin ? "Super admin" : "Office staff"}</td>
                <td data-label="Status"><Badge>{u.status}</Badge></td>
                <td data-label="Last sign-in" className={u.status === "active" && stale(u.lastLoginAt) ? "font-semibold text-maroon-600" : ""}>{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "Not since this was added"}</td>
                <td data-label="Set up" className="text-xs">{u.mustChangePassword ? "Temporary password" : u.rulesAcceptedAt ? `Rules accepted ${fmtDate(u.rulesAcceptedAt)}` : "Rules not accepted yet"}</td>
                <td data-label=""><Link href={`/manager/people/${u.id}`} className="btn-ghost btn-sm">Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">Red: no sign-in for over 30 days. Ask whether they still need the account.</p>
      {done ? (
        <div className="card flex items-start gap-3 border-brand-100 bg-brand-50/60 text-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" />
          <div><div className="font-semibold text-brand-950">Done this month by {done.actorName}, {fmtDateTime(done.createdAt)}</div>{done.reason && <div className="text-xs text-stone-600">{done.reason}</div>}</div>
        </div>
      ) : (
        <form action={completeAccessReview} className="card space-y-2.5 text-sm">
          <div className="font-semibold text-brand-950">Sign off this month&apos;s review</div>
          {last && <div className="text-xs text-stone-500">Last done {fmtDateTime(last.createdAt)} by {last.actorName}.</div>}
          <Checklist name="access" title="I have checked" />
          <Signature reasonHint="Note, e.g. suspended Peter (left in October)" />
          <Submit className="btn-primary btn-sm">Review done</Submit>
        </form>
      )}
    </div>
  );
}
