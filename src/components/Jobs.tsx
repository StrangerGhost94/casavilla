import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db, type User } from "@/db";
import { fmtDate, fmtDateTime, ugx } from "@/lib/format";
import { ChevronRight, Sparkles, Star } from "lucide-react";
import { CategoryIcon } from "@/lib/icons";
import { Badge, Empty, Photo } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { PhotoZoom } from "./FileButton";
import { addNote, assignProvider, providerRespond, cancelJob, reopenJob, decideQuote, rateJob } from "@/app/job-actions";
import { JOB_LABEL, payerOf } from "@/lib/rules";
import { providerStats, rankProviders } from "@/lib/insights";
import { coverage, crumbText, trailFor } from "@/lib/geo";

const jobInclude = {
  requester: { select: { name: true, phone: true } },
  provider: { select: { name: true, businessName: true, phone: true } },
  property: { select: { name: true, location: true, landmark: true, lat: true, lng: true } },
  unit: { select: { label: true } },
  service: { select: { title: true } },
} satisfies Prisma.JobInclude;

export async function JobList({ where, base, empty = "No jobs yet" }: { where: Prisma.JobWhereInput; base: string; empty?: string }) {
  const rows = await db.job.findMany({ where, include: jobInclude, orderBy: { updatedAt: "desc" } });
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="card divide-y divide-stone-100 p-0">
      {rows.map((j) => (
        <Link key={j.id} href={`${base}/${j.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-stone-50">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${j.priority === "urgent" ? "bg-maroon-50 text-maroon-600" : "bg-brand-50 text-brand-700"}`}>
            <CategoryIcon category={j.category} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-stone-800">{j.title}</div>
            <div className="truncate text-xs text-stone-500">
              {j.property ? `${j.property.name}${j.unit ? ` · ${j.unit.label}` : ""}` : j.category}
              {" · "}{j.provider ? j.provider.businessName || j.provider.name : "No provider yet"}
            </div>
            <div className="mt-0.5 text-[11px] text-stone-400">
              {j.requester.name} · {fmtDate(j.updatedAt)}{j.priority === "urgent" && <span className="font-semibold text-maroon-600"> · Urgent</span>}
            </div>
          </div>
          <Badge>{j.status === "in_progress" ? "in progress" : j.status}</Badge>
          <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
        </Link>
      ))}
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

  const trail = await trailFor(j.locationId);
  const cover = viewer.role === "provider" && j.providerId === viewer.id && trail.length ? await coverage(viewer.id, `/${trail.map((c) => c.id).join("/")}/`) : undefined;
  const notes = (await db.jobNote.findMany({ where: { jobId: j.id }, include: { author: { select: { name: true, businessName: true, role: true } } }, orderBy: { createdAt: "asc" } }))
    .map((n) => ({ n, author: n.author.name, business: n.author.businessName, role: n.author.role }));
  const canAssign = (viewer.role === "manager" || (viewer.role === "landlord" && j.landlordId === viewer.id)) && !["done", "cancelled"].includes(j.status);
  const ranked = canAssign ? (await rankProviders(j)).filter((p) => p.id !== j.providerId) : [];
  const top = ranked.filter((p) => p.category).slice(0, 3);
  const payer = payerOf(j);
  const canDecideQuote = j.status === "quoted" && (viewer.role === "manager" || viewer.id === payer || viewer.id === j.landlordId);
  const canRate = j.status === "done" && !!j.providerId && !j.rating && (viewer.id === j.requesterId || viewer.id === j.landlordId);
  const pstats = j.providerId ? (await providerStats([j.providerId])).get(j.providerId) : undefined;
  const canCancel = (viewer.role === "manager" || j.requesterId === viewer.id || j.landlordId === viewer.id);
  const hidden = <input type="hidden" name="jobId" value={j.id} />;

  return (
    <div>
      <Link href={back} className="link hidden text-sm lg:inline">← Back</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">{j.title}</h1>
          <div className="muted mt-1">{j.category} · opened {fmtDate(j.createdAt)} by {r.requester}</div>
          <div className="mt-1 text-sm font-medium text-brand-800">{JOB_LABEL[j.status]}</div>
        </div>
        <div className="flex gap-2"><Badge>{j.priority}</Badge><Badge>{j.status === "in_progress" ? "in progress" : j.status}</Badge></div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="h2">Details</div>
            <p className="mt-2 whitespace-pre-line text-stone-700">{j.description}</p>
            {j.photoId && <PhotoZoom src={`/api/files/${j.photoId}`} alt="Repair photo" className="block"><Photo id={j.photoId} alt="Job photo" className="mt-4 max-h-80 rounded-lg" /></PhotoZoom>}
          </div>

          <div className="card">
            <div className="h2">Updates</div>
            <div className="mt-3 space-y-3">
              {notes.length === 0 && <div className="muted">No updates yet.</div>}
              {notes.map((n) => n.n.system ? (
                <div key={n.n.id} className="flex items-start gap-2 px-1 text-xs text-stone-500">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span><span className="text-stone-700">{n.n.body}</span> · {fmtDateTime(n.n.createdAt)}</span>
                </div>
              ) : (
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
            <div>
              <div className="label">Location</div>
              {r.property ? <>{r.property}{r.unit && ` · ${r.unit}`}<div className="text-stone-500">{r.location}</div></> : trail.length ? null : "Not linked to a property"}
              {trail.length > 0 && <div className="mt-1 text-xs text-brand-800">{crumbText(trail, true)}</div>}
              {j.property?.landmark && <div className="mt-1 text-xs text-stone-500">Landmark: {j.property.landmark}</div>}
              {j.property?.lat != null && j.property?.lng != null && (
                <a className="link mt-1 inline-block text-xs" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${j.property.lat}&mlon=${j.property.lng}#map=18/${j.property.lat}/${j.property.lng}`}>Open exact spot on map ↗</a>
              )}
              {cover === null && <div className="mt-1 rounded-lg bg-gold-50 px-2 py-1 text-[11px] text-gold-700">Outside your listed service areas</div>}
            </div>
            <div><div className="label">Requested by</div>{r.requester}<div className="text-stone-500">{r.requesterPhone}</div></div>
            <div><div className="label">Provider</div>{r.provider || r.providerName ? <>{r.provider || r.providerName}<div className="text-stone-500">{r.providerPhone}</div></> : <span className="text-stone-400">Not assigned yet</span>}</div>
            {r.service && <div><div className="label">Service booked</div>{r.service}</div>}
            {j.quote != null && <div><div className="label">{j.status === "done" ? "Final cost" : j.status === "quoted" ? "Quote (awaiting approval)" : "Approved quote"}</div><span className="font-semibold">{ugx(j.quote)}</span></div>}
            {pstats?.rating && <div><div className="label">Provider rating</div><span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> {pstats.rating} from {pstats.ratings} job{pstats.ratings > 1 ? "s" : ""}</span></div>}
            {j.rating && <div><div className="label">Rating for this job</div><span className="text-gold-500">{"★".repeat(j.rating)}<span className="text-stone-300">{"★".repeat(5 - j.rating)}</span></span>{j.review && <div className="text-stone-500">“{j.review}”</div>}</div>}
          </div>

          {canDecideQuote && (
            <div className="card space-y-3 border-gold-200 bg-gold-50/40">
              <div className="h2">Approve the quote?</div>
              <p className="text-sm text-stone-600">{r.provider || r.providerName} will do this for <span className="font-semibold text-stone-900">{ugx(j.quote)}</span>. Work starts once you approve.</p>
              <div className="grid grid-cols-2 gap-2">
                <form action={decideQuote}>{hidden}<input type="hidden" name="decision" value="approve" /><Submit className="btn-primary w-full">Approve</Submit></form>
                <form action={decideQuote}>{hidden}<input type="hidden" name="decision" value="reject" /><Submit className="btn-outline w-full">Ask for a new quote</Submit></form>
              </div>
            </div>
          )}

          {canRate && (
            <form action={rateJob} className="card space-y-3">
              {hidden}
              <div className="h2">How did {r.provider || r.providerName} do?</div>
              <div className="flex flex-row-reverse justify-end gap-1 [&>label:has(:checked)~label_svg]:fill-gold-400 [&>label:has(:checked)~label_svg]:text-gold-400">
                {[5, 4, 3, 2, 1].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name="rating" value={n} required className="peer sr-only" aria-label={`${n} star${n > 1 ? "s" : ""}`} />
                    <Star className="h-8 w-8 text-stone-300 transition peer-checked:fill-gold-400 peer-checked:text-gold-400" />
                  </label>
                ))}
              </div>
              <p className="-mt-1 text-[11px] text-stone-400">Tap a star (5 = excellent)</p>
              <input name="review" className="input" placeholder="A few words (optional)" maxLength={500} />
              <Submit className="btn-primary w-full">Submit rating</Submit>
            </form>
          )}

          {canAssign && (
            <form action={assignProvider} className="card space-y-3">
              {hidden}
              <div className="h2">{j.providerId ? "Reassign provider" : "Assign a provider"}</div>
              {top.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800"><Sparkles className="h-3.5 w-3.5 text-gold-500" /> Best matches</div>
                  {top.map((p, i) => (
                    <label key={p.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 p-2.5 text-sm has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50">
                      <input type="radio" name="providerId" value={p.id} defaultChecked={i === 0} className="mt-1 accent-brand-700" />
                      <span className="min-w-0"><span className="font-semibold text-stone-800">{p.name}</span><span className="block text-xs text-stone-500">{p.reasons.join(" · ")}</span></span>
                    </label>
                  ))}
                </div>
              )}
              {ranked.length > top.length && (
                <select name="providerIdOther" className="input" defaultValue="" required={top.length === 0}>
                  <option value="">{top.length ? "Or choose someone else…" : "Choose provider…"}</option>
                  {ranked.filter((p) => !top.some((t) => t.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}{p.category ? "" : " (other trade)"}{p.rating ? ` ★${p.rating}` : ""}</option>)}
                </select>
              )}
              {ranked.length === 0 && <p className="muted">No approved providers yet.</p>}
              {ranked.length > 0 && <Submit className="btn-primary w-full">Assign</Submit>}
            </form>
          )}

          {viewer.role === "provider" && j.providerId === viewer.id && (
            <div className="card space-y-3">
              <div className="h2">Your response</div>
              {j.status === "assigned" && (
                <>
                  <form action={providerRespond} className="space-y-2">
                    {hidden}<input type="hidden" name="action" value="accept" />
                    <input name="quote" type="number" min={0} className="input" placeholder="Your quote in UGX (optional)" inputMode="numeric" />
                    <p className="text-[11px] text-stone-500">With a quote, the {j.serviceId ? "customer" : "landlord"} approves it before you start.</p>
                    <Submit className="btn-primary w-full">Accept / send quote</Submit>
                  </form>
                  <form action={providerRespond} className="space-y-2">{hidden}<input type="hidden" name="action" value="decline" /><input name="reason" className="input" placeholder="Reason for declining (optional)" /><Submit className="btn-outline w-full">Decline</Submit></form>
                </>
              )}
              {j.status === "accepted" && <form action={providerRespond}>{hidden}<input type="hidden" name="action" value="start" /><Submit className="btn-primary w-full">Start work</Submit></form>}
              {j.status === "quoted" && <div className="muted">Your quote of {ugx(j.quote)} is waiting for approval.</div>}
              {j.status === "in_progress" && (
                <form action={providerRespond} className="space-y-2">{hidden}<input type="hidden" name="action" value="done" />
                  <label className="block"><span className="label">Final cost (UGX)</span><input name="cost" type="number" min={0} className="input" defaultValue={j.quote ?? undefined} placeholder="Optional" inputMode="numeric" /></label>
                  <Submit className="btn-primary w-full">Mark as done</Submit>
                </form>
              )}
              {["done", "cancelled"].includes(j.status) && <div className="muted">This job is {j.status}.</div>}
            </div>
          )}

          {canCancel && !["done", "cancelled"].includes(j.status) && (
            <form action={cancelJob}>{hidden}<ConfirmSubmit message="Cancel this request?" className="btn-ghost w-full text-maroon-600">Cancel this request</ConfirmSubmit></form>
          )}
          {canCancel && ["done", "cancelled"].includes(j.status) && (
            <form action={reopenJob}>{hidden}<Submit className="btn-outline w-full">{j.status === "done" ? "Not fixed? Reopen" : "Reopen"}</Submit></form>
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
