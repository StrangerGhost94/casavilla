import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MessageCircle, Phone, Plus } from "lucide-react";
import { db } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { BUILD_KINDS, SITE_STATUS, SITE_STATUS_KEYS, STAGE_TEMPLATE, type BuildKind } from "@/lib/build";
import { siteSummary } from "@/lib/build-sites";
import { Badge, Empty, Field, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { SalePhotos } from "./SalePhotos";
import { BuildTabs } from "./BuildAdmin";
import { MoneyCards, PaymentList, StageList, UpdateFeed } from "./BuildSiteView";
import {
  createBuildSite, deleteBuildStage, deleteBuildUpdate, deleteUpdatePhoto, linkBuildClient, postBuildUpdate, recordBuildPayment, saveBuildSite, saveBuildStage,
  setBuildStageStatus, setUpdateCover, uploadUpdatePhoto,
} from "@/app/build-site-actions";

const BASE = "/manager/build/sites";
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function SiteList() {
  const sites = await db.buildSite.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { stages: { select: { status: true } }, client: { select: { name: true } } } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Build & construction" subtitle="Agreed builds: stages, progress photos for the client, and their payments."
        actions={<Link href={`${BASE}/new`} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New build</Link>} />
      <BuildTabs active="sites" />
      {sites.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {sites.map((s) => {
            const done = s.stages.filter((x) => x.status === "done").length;
            return (
              <Link key={s.id} href={`${BASE}/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-stone-900">{s.title}</div>
                  <div className="truncate text-xs text-stone-500">{s.clientName} · {s.location} · {ugx(s.contractSum)}</div>
                  <div className="text-[11px] text-stone-500">{done} of {s.stages.length} stages done{!s.clientId && <span className="font-semibold text-gold-700"> · client account not linked</span>}</div>
                </div>
                <Badge color={SITE_STATUS[s.status]?.tone}>{SITE_STATUS[s.status]?.label}</Badge>
              </Link>
            );
          })}
        </div>
      ) : <Empty title="No builds yet">When a client agrees, open their request and press “Start the build” — or add one here.</Empty>}
    </div>
  );
}

/** New build, filled in from the agreed request when there is one. */
export async function SiteForm({ requestId }: { requestId?: number }) {
  const r = requestId ? await db.buildRequest.findUnique({ where: { id: requestId }, include: { plan: { select: { title: true } }, site: { select: { id: true } } } }) : null;
  const title = r ? (r.plan ? r.plan.title : `${BUILD_KINDS[r.kind as BuildKind]?.short ?? "Build"} for ${r.name}`) : "";
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={r ? `/manager/build/${r.id}` : BASE} className="link text-sm">← {r ? `Request from ${r.name}` : "Builds"}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold text-brand-950">Start a build</h1>
      {r?.site ? <div className="card text-sm">This request already has a build. <Link href={`${BASE}/${r.site.id}`} className="link">Open it →</Link></div> : (
        <form action={createBuildSite} className="card space-y-3">
          {r && <input type="hidden" name="requestId" value={r.id} />}
          <Field label="Project name"><input name="title" required maxLength={120} defaultValue={title} className="input" placeholder="e.g. 4-bedroom home, Kira" /></Field>
          <Field label="Where"><input name="location" required maxLength={160} defaultValue={r?.location ?? ""} className="input" placeholder="e.g. Kira, Wakiso" /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Client's name"><input name="clientName" required maxLength={80} defaultValue={r?.name ?? ""} className="input" /></Field>
            <Field label="Client's phone" hint="They see the project when they sign in with this number"><input name="clientPhone" required inputMode="tel" defaultValue={r?.phone.replace("+256", "0") ?? ""} className="input" /></Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Contract sum (UGX)"><input name="contractSum" required inputMode="numeric" defaultValue={r?.quote ?? ""} className="input" placeholder="e.g. 185000000" /></Field>
            <Field label="Start date"><input name="startDate" type="date" defaultValue={kampalaToday()} className="input" /></Field>
            <Field label="Handover by"><input name="targetDate" type="date" className="input" /></Field>
          </div>
          <label className="flex items-start gap-2 rounded-xl bg-stone-50 p-3 text-sm">
            <input type="checkbox" name="template" defaultChecked className="mt-1" />
            <span><b>Add the standard stages</b>, split from the contract sum: {STAGE_TEMPLATE.map(([n, p]) => `${n} ${p}%`).join(" · ")}. You can rename them and change the amounts after.</span>
          </label>
          <Submit className="btn-primary">Start the build</Submit>
        </form>
      )}
    </div>
  );
}

export async function SiteManage({ id, update }: { id: number; update?: number }) {
  const sum = await siteSummary(id);
  if (!sum) notFound();
  const s = sum.site;
  const first = s.clientName.split(" ")[0];
  const wa = `https://wa.me/${s.clientPhone.replace("+", "")}?text=${encodeURIComponent(`Hello ${first}, this is CasaVilla about your build “${s.title}”.`)}`;
  const gap = sum.scheduled - s.contractSum;
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href={BASE} className="link text-sm">← Builds</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{s.title}</h1>
          <div className="muted">{s.location} · {sum.progress}% complete{s.targetDate ? ` · handover by ${fmtDate(s.targetDate)}` : ""}</div>
        </div>
        <Badge color={SITE_STATUS[s.status]?.tone}>{SITE_STATUS[s.status]?.label}</Badge>
      </div>

      <div className="card flex flex-wrap items-center gap-2">
        <span className="mr-auto text-sm"><b>{s.clientName}</b> · {s.clientPhone}{s.client ? <span className="text-brand-700"> · account linked</span> : <span className="text-gold-700"> · no account linked</span>}</span>
        <a href={`tel:${s.clientPhone}`} className="btn-outline btn-sm"><Phone className="h-3.5 w-3.5" /> Call</a>
        <a href={wa} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
        <Link href={`/build/my/${s.id}`} className="btn-ghost btn-sm">Client&apos;s view <ExternalLink className="h-3 w-3" /></Link>
      </div>

      <MoneyCards sum={sum} />
      {Math.abs(gap) >= 1 && <div className="card border-gold-200 bg-gold-50/60 text-sm text-gold-700">The stages add up to {ugx(sum.scheduled)}, which is {ugx(Math.abs(gap))} {gap > 0 ? "more" : "less"} than the contract sum. Adjust a stage or the contract sum.</div>}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <section>
            <h2 className="h2 mb-3">Stages</h2>
            <StageList sum={sum} controls={(st) => (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {st.status !== "in_progress" && st.status !== "done" && <StageBtn id={st.id} to="in_progress" label="Start" />}
                {st.status !== "done" && <StageBtn id={st.id} to="done" label="Mark done" primary />}
                {st.status !== "upcoming" && <StageBtn id={st.id} to={st.status === "done" ? "in_progress" : "upcoming"} label="Undo" ghost />}
                <details className="w-full">
                  <summary className="cursor-pointer text-xs font-semibold text-stone-500">Edit</summary>
                  <form action={saveBuildStage} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="siteId" value={s.id} /><input type="hidden" name="stageId" value={st.id} />
                    <input name="name" required maxLength={80} defaultValue={st.name} className="input min-w-0 flex-1 py-2" />
                    <input name="amount" required inputMode="numeric" defaultValue={st.amount} className="input w-36 py-2" />
                    <Submit className="btn-outline btn-sm">Save</Submit>
                  </form>
                  {st.paid === 0 && <form action={deleteBuildStage} className="mt-1"><input type="hidden" name="id" value={st.id} /><ConfirmSubmit message={`Remove the stage “${st.name}”?`} className="text-xs font-semibold text-maroon-600 hover:underline">Remove stage</ConfirmSubmit></form>}
                </details>
              </div>
            )} />
            <form action={saveBuildStage} className="card mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="siteId" value={s.id} />
              <label className="min-w-0 flex-1"><span className="label">Add a stage</span><input name="name" required maxLength={80} className="input py-2" placeholder="e.g. Boys' quarter" /></label>
              <label className="w-36"><span className="label">Amount (UGX)</span><input name="amount" required inputMode="numeric" className="input py-2" /></label>
              <Submit className="btn-outline btn-sm">Add</Submit>
            </form>
          </section>

          <section>
            <h2 className="h2 mb-3">Progress updates</h2>
            <form action={postBuildUpdate} className="card mb-3 space-y-2">
              <input type="hidden" name="siteId" value={s.id} />
              <textarea name="note" required rows={3} maxLength={2000} className="input" placeholder="What happened on site? e.g. Foundation slab cast today; curing for 7 days." />
              <div className="flex flex-wrap items-center gap-2">
                <select name="stageId" className="input w-auto py-2" defaultValue={sum.stages.find((x) => x.status === "in_progress")?.id ?? ""}>
                  <option value="">No stage</option>
                  {sum.stages.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <Submit className="btn-primary btn-sm">Post & add photos</Submit>
              </div>
              <p className="text-[11px] text-stone-500">The client is notified on their phone.</p>
            </form>
            <UpdateFeed sum={sum} extra={(u) => (
              <div className="mt-3 space-y-2">
                {u.id === update && (
                  <SalePhotos listingId={`update:${u.id}`} photos={u.photos.map((p) => ({ id: p.id, fileId: p.fileId, isCover: p.isCover }))} highlight
                    actions={{ upload: uploadUpdatePhoto, cover: setUpdateCover, remove: deleteUpdatePhoto }}
                    words={{ empty: "Add photos from the site", hint: "Show the work done: wide shots first, then details.", tips: "Tip: take the same spot each visit so the client sees it grow." }} />
                )}
                <div className="flex items-center gap-3">
                  {u.id !== update && <Link href={`${BASE}/${s.id}?update=${u.id}#update-${u.id}`} className="text-xs font-semibold text-brand-700 hover:underline">{u.photos.length ? "Manage photos" : "Add photos"}</Link>}
                  <form action={deleteBuildUpdate} className="ml-auto"><input type="hidden" name="id" value={u.id} /><ConfirmSubmit message="Delete this update and its photos?" className="text-xs font-semibold text-maroon-600 hover:underline">Delete</ConfirmSubmit></form>
                </div>
              </div>
            )} />
          </section>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <section className="card space-y-3">
            <div className="font-semibold text-brand-950">Record a payment</div>
            <p className="text-xs text-stone-500">Cash, bank transfer, or Mobile Money paid outside the app. The client gets a receipt.</p>
            <form action={recordBuildPayment} className="space-y-2">
              <input type="hidden" name="siteId" value={s.id} />
              <div className="grid grid-cols-2 gap-2">
                <input name="amount" required inputMode="numeric" className="input py-2" placeholder="Amount (UGX)" />
                <select name="method" className="input py-2" defaultValue="bank"><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="mtn">MTN MoMo</option><option value="airtel">Airtel Money</option></select>
              </div>
              <select name="stageId" className="input py-2" defaultValue={sum.next?.id ?? ""}>
                <option value="">No particular stage</option>
                {sum.stages.map((x) => <option key={x.id} value={x.id}>{x.name} — {ugx(x.balance)} left</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="reference" maxLength={80} className="input py-2" placeholder="Bank / slip reference" />
                <input name="paidOn" type="date" defaultValue={kampalaToday()} className="input py-2" />
              </div>
              <Submit className="btn-primary btn-sm w-full">Record payment</Submit>
            </form>
          </section>

          <section><h2 className="h2 mb-3">Payments</h2><PaymentList sum={sum} /></section>

          <section className="card space-y-2">
            <div className="font-semibold text-brand-950">Client account</div>
            <p className="text-xs text-stone-500">{s.client ? `Linked to ${s.client.name} (${s.client.phone}).` : `Not linked yet. It links automatically when ${first} signs in with ${s.clientPhone} (verified), or link an account here.`}</p>
            <form action={linkBuildClient} className="flex gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input name="who" className="input py-2" placeholder="Phone or email of their account" defaultValue={s.client?.email ?? ""} />
              <Submit className="btn-outline btn-sm shrink-0">{s.client ? "Change" : "Link"}</Submit>
            </form>
          </section>

          <details className="card">
            <summary className="cursor-pointer font-semibold text-brand-950">Project details & status</summary>
            <form action={saveBuildSite} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={s.id} />
              <Field label="Name"><input name="title" required maxLength={120} defaultValue={s.title} className="input" /></Field>
              <Field label="Where"><input name="location" required maxLength={160} defaultValue={s.location} className="input" /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Contract sum (UGX)"><input name="contractSum" required inputMode="numeric" defaultValue={s.contractSum} className="input" /></Field>
                <Field label="Status"><select name="status" defaultValue={s.status} className="input">{SITE_STATUS_KEYS.map((k) => <option key={k} value={k}>{SITE_STATUS[k].label}</option>)}</select></Field>
                <Field label="Start date"><input name="startDate" type="date" defaultValue={ymd(s.startDate)} className="input" /></Field>
                <Field label="Handover by"><input name="targetDate" type="date" defaultValue={ymd(s.targetDate)} className="input" /></Field>
              </div>
              <Submit className="btn-primary btn-sm">Save</Submit>
            </form>
            {s.request && <Link href={`/manager/build/${s.request.id}`} className="mt-3 block text-xs font-semibold text-brand-700 hover:underline">Original request →</Link>}
          </details>
        </div>
      </div>
    </div>
  );
}

function StageBtn({ id, to, label, primary, ghost }: { id: number; to: string; label: string; primary?: boolean; ghost?: boolean }) {
  return (
    <form action={setBuildStageStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value={to} />
      <Submit className={primary ? "btn-primary btn-sm" : ghost ? "btn-ghost btn-sm" : "btn-outline btn-sm"}>{label}</Submit></form>
  );
}
