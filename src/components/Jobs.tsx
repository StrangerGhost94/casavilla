import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db, type User } from "@/db";
import { fmtDate, fmtDateTime, ugx } from "@/lib/format";
import { Badge, Empty, Photo } from "./ui";
import { Submit } from "./client";
import { addNote, assignProvider, providerRespond, cancelJob, reopenJob } from "@/app/job-actions";

const jobInclude = {
  requester: { select: { name: true, phone: true } },
  provider: { select: { name: true, businessName: true, phone: true } },
  property: { select: { name: true, location: true } },
  unit: { select: { label: true } },
  service: { select: { title: true } },
} satisfies Prisma.JobInclude;

export async function JobList({ where, base, empty = "No jobs yet" }: { where: Prisma.JobWhereInput; base: string; empty?: string }) {
  const rows = await db.job.findMany({ where, include: jobInclude, orderBy: { updatedAt: "desc" } });
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="card overflow-x-auto p-0">
      <table className="table">
        <thead><tr><th>Job</th><th>Where</th><th>Requested by</th><th>Provider</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>
          {rows.map((j) => (
            <tr key={j.id}>
              <td>
                <Link href={`${base}/${j.id}`} className="link">{j.title}</Link>
                <div className="text-xs text-stone-500">{j.category}{j.priority === "urgent" && <> · <span className="font-semibold text-maroon-600">Urgent</span></>}</div>
              </td>
              <td>{j.property ? `${j.property.name}${j.unit ? ` · ${j.unit.label}` : ""}` : "—"}</td>
              <td>{j.requester.name}</td>
              <td>{j.provider ? j.provider.businessName || j.provider.name : <span className="text-stone-400">Not assigned</span>}</td>
              <td><Badge>{j.status}</Badge></td>
              <td className="whitespace-nowrap text-stone-500">{fmtDate(j.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export async function JobDetail({ id, viewer, back }: { id: number; viewer: User; back: string }) {
  const j = await db.job.findUnique({ where: { id }, include: jobInclude });
  if (!j) notFound();
  const party = viewer.role === "manager" || [j.requesterId, j.landlordId, j.providerId].includes(viewer.id);
  if (!party) notFound();
  const r = {
    property: j.property?.name, location: j.property?.location, unit: j.unit?.label, service: j.service?.title,
    requester: j.requester.name, requesterPhone: j.requester.phone,
    provider: j.provider?.businessName, providerName: j.provider?.name, providerPhone: j.provider?.phone,
  };

  const notes = (await db.jobNote.findMany({ where: { jobId: j.id }, include: { author: { select: { name: true, businessName: true, role: true } } }, orderBy: { createdAt: "asc" } }))
    .map((n) => ({ n, author: n.author.name, business: n.author.businessName, role: n.author.role }));
  const canAssign = (viewer.role === "manager" || (viewer.role === "landlord" && j.landlordId === viewer.id)) && !["done", "cancelled"].includes(j.status);
  const providers = canAssign
    ? (await db.user.findMany({ where: { role: "provider", status: "active" }, include: { services: { where: { active: true } } } }))
        .flatMap((p) => p.services.map((s) => ({ id: p.id, name: p.name, business: p.businessName, category: s.category })))
    : [];
  const matching = providers.filter((p) => p.category === j.category);
  const others = providers.filter((p) => p.category !== j.category && !matching.some((m) => m.id === p.id));
  const uniq = <T extends { id: number }>(a: T[]) => a.filter((x, i) => a.findIndex((y) => y.id === x.id) === i);
  const canCancel = (viewer.role === "manager" || j.requesterId === viewer.id || j.landlordId === viewer.id);
  const hidden = <input type="hidden" name="jobId" value={j.id} />;

  return (
    <div>
      <Link href={back} className="link text-sm">← Back</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{j.title}</h1>
          <div className="muted mt-1">{j.category} · opened {fmtDate(j.createdAt)} by {r.requester}</div>
        </div>
        <div className="flex gap-2"><Badge>{j.priority}</Badge><Badge>{j.status}</Badge></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="h2">Details</div>
            <p className="mt-2 whitespace-pre-line text-stone-700">{j.description}</p>
            {j.photoId && <a href={`/api/files/${j.photoId}`} target="_blank"><Photo id={j.photoId} alt="Job photo" className="mt-4 max-h-80 rounded-lg" /></a>}
          </div>

          <div className="card">
            <div className="h2">Updates</div>
            <div className="mt-3 space-y-3">
              {notes.length === 0 && <div className="muted">No updates yet.</div>}
              {notes.map((n) => (
                <div key={n.n.id} className={`rounded-lg p-3 text-sm ${n.n.authorId === viewer.id ? "bg-brand-50" : "bg-stone-50"}`}>
                  <div className="text-xs font-semibold text-stone-500">{n.business || n.author} · <span className="capitalize">{n.role}</span> · {fmtDateTime(n.n.createdAt)}</div>
                  <div className="mt-1 whitespace-pre-line">{n.n.body}</div>
                </div>
              ))}
            </div>
            <form action={addNote} className="mt-4 flex gap-2">
              {hidden}
              <input name="body" className="input" placeholder="Write an update…" required />
              <Submit className="btn-primary">Send</Submit>
            </form>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3 text-sm">
            <div><div className="label">Location</div>{r.property ? <>{r.property}{r.unit && ` · ${r.unit}`}<div className="text-stone-500">{r.location}</div></> : "Not linked to a property"}</div>
            <div><div className="label">Requested by</div>{r.requester}<div className="text-stone-500">{r.requesterPhone}</div></div>
            <div><div className="label">Provider</div>{r.provider || r.providerName ? <>{r.provider || r.providerName}<div className="text-stone-500">{r.providerPhone}</div></> : <span className="text-stone-400">Not assigned yet</span>}</div>
            {r.service && <div><div className="label">Service booked</div>{r.service}</div>}
            {j.quote != null && <div><div className="label">Quote</div><span className="font-semibold">{ugx(j.quote)}</span></div>}
          </div>

          {canAssign && (
            <form action={assignProvider} className="card space-y-3">
              {hidden}
              <div className="h2">{j.providerId ? "Reassign provider" : "Assign a provider"}</div>
              <select name="providerId" className="input" required defaultValue="">
                <option value="" disabled>Choose provider…</option>
                {matching.length > 0 && <optgroup label={`${j.category} providers`}>{uniq(matching).map((p) => <option key={p.id} value={p.id}>{p.business || p.name}</option>)}</optgroup>}
                {others.length > 0 && <optgroup label="Other providers">{uniq(others).map((p) => <option key={p.id} value={p.id}>{p.business || p.name} ({p.category})</option>)}</optgroup>}
              </select>
              <Submit className="btn-primary w-full">Assign</Submit>
            </form>
          )}

          {viewer.role === "provider" && j.providerId === viewer.id && (
            <div className="card space-y-3">
              <div className="h2">Your response</div>
              {j.status === "assigned" && (
                <>
                  <form action={providerRespond} className="space-y-2">
                    {hidden}<input type="hidden" name="action" value="accept" />
                    <input name="quote" type="number" min={0} className="input" placeholder="Your quote in UGX (optional)" />
                    <Submit className="btn-primary w-full">Accept job</Submit>
                  </form>
                  <form action={providerRespond}>{hidden}<input type="hidden" name="action" value="decline" /><Submit className="btn-outline w-full">Decline</Submit></form>
                </>
              )}
              {j.status === "accepted" && <form action={providerRespond}>{hidden}<input type="hidden" name="action" value="start" /><Submit className="btn-primary w-full">Start work</Submit></form>}
              {j.status === "in_progress" && <form action={providerRespond}>{hidden}<input type="hidden" name="action" value="done" /><Submit className="btn-primary w-full">Mark as done</Submit></form>}
              {["done", "cancelled"].includes(j.status) && <div className="muted">This job is {j.status}.</div>}
            </div>
          )}

          {canCancel && !["done", "cancelled"].includes(j.status) && (
            <form action={cancelJob}>{hidden}<Submit className="btn-ghost w-full text-maroon-600">Cancel this request</Submit></form>
          )}
          {canCancel && ["done", "cancelled"].includes(j.status) && (
            <form action={reopenJob}>{hidden}<Submit className="btn-outline w-full">Reopen</Submit></form>
          )}
        </aside>
      </div>
    </div>
  );
}

export const jobsFor = {
  tenant: (u: User): Prisma.JobWhereInput => ({ requesterId: u.id }),
  landlord: (u: User): Prisma.JobWhereInput => ({ OR: [{ landlordId: u.id }, { requesterId: u.id }] }),
  provider: (u: User): Prisma.JobWhereInput => ({ providerId: u.id }),
};
