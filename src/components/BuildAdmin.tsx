import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, MessageCircle, Phone, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { BUILD_KINDS, PLAN_STYLES, PLAN_STYLE_KEYS, PLOT, PROJECT_KINDS, REQUEST_STATUS, REQUEST_STATUS_KEYS, TIMELINE, buildCost, planFacts, type BuildKind, type PlanStyle, type ProjectKind } from "@/lib/build";
import { fullUgx, shortUgx } from "@/lib/sales";
import { planHref, saleHref } from "@/lib/seo";
import { Badge, Empty, Field, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { SalePhotos, ScrollTop } from "./SalePhotos";
import {
  deleteBuildPhoto, deleteBuildProject, deleteHousePlan, saveBuildProject, saveHousePlan, setBuildCover, setPlanPublished, setProjectPublished,
  updateBuildRequest, uploadBuildPhoto,
} from "@/app/build-actions";

const BASE = "/manager/build";
const pill = (s: string) => <Badge color={REQUEST_STATUS[s]?.tone ?? "gray"}>{REQUEST_STATUS[s]?.label ?? s}</Badge>;
const photoActions = { upload: uploadBuildPhoto, cover: setBuildCover, remove: deleteBuildPhoto };

export function BuildTabs({ active, newCount }: { active: "requests" | "plans" | "projects"; newCount?: number }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {([["requests", BASE, `Requests${newCount ? ` (${newCount} new)` : ""}`], ["plans", `${BASE}/plans`, "House plans"], ["projects", `${BASE}/projects`, "Our work"]] as const).map(([k, href, label]) => (
        <Link key={k} href={href} className={active === k ? "chip-active" : "chip"}>{label}</Link>
      ))}
      <Link href="/build" className="ml-auto flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">Public page <ExternalLink className="h-3 w-3" /></Link>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Requests

const OPEN = ["new", "contacted", "site_visit", "quoted"];

export async function RequestList({ tab = "open" }: { tab?: string }) {
  const where: Prisma.BuildRequestWhereInput = tab === "won" ? { status: "won" } : tab === "lost" ? { status: "lost" } : tab === "all" ? {} : { status: { in: OPEN } };
  const [rows, counts] = await Promise.all([
    db.buildRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { plan: { select: { title: true } }, saleListing: { select: { title: true } } } }),
    db.buildRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const n = (s: string[]) => counts.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count._all, 0);
  const newCount = n(["new"]);
  const pipeline = await db.buildRequest.aggregate({ where: { status: "quoted" }, _sum: { quote: true } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Build & construction" subtitle="People asking CasaVilla to design or build — call them back, visit the site, quote, and win the job." />
      <BuildTabs active="requests" newCount={newCount} />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["New", n(["new"])], ["In progress", n(["contacted", "site_visit", "quoted"])], ["Quotes out", pipeline._sum.quote ? shortUgx(pipeline._sum.quote) : "—"], ["Agreed", n(["won"])]].map(([k, v]) => (
          <div key={k} className="card py-3"><div className="text-xs text-stone-500">{k}</div><div className="text-lg font-bold text-brand-950">{v}</div></div>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {[["open", "Open"], ["won", "Agreed"], ["lost", "Not going ahead"], ["all", "All"]].map(([k, label]) => (
          <Link key={k} href={`${BASE}?tab=${k}`} className={tab === k ? "chip-active" : "chip"}>{label}</Link>
        ))}
      </div>
      {rows.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {rows.map((r) => (
            <Link key={r.id} href={`${BASE}/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{r.name} <span className="font-normal text-stone-500">· {BUILD_KINDS[r.kind as BuildKind]?.short ?? r.kind}</span></div>
                <div className="truncate text-xs text-stone-500">
                  {[r.location, r.budget ? `budget ${shortUgx(r.budget)}` : null, r.plan ? `plan: ${r.plan.title}` : null, r.saleListing ? `plot: ${r.saleListing.title}` : null].filter(Boolean).join(" · ") || r.phone}
                </div>
                <div className="text-[11px] text-stone-400">{fmtDateTime(r.createdAt)}</div>
              </div>
              {pill(r.status)}
            </Link>
          ))}
        </div>
      ) : <Empty title={tab === "open" ? "No open requests" : "Nothing here"}>Requests from the Build page, house plans and “Build on this plot” appear here.</Empty>}
    </div>
  );
}

export async function RequestDetail({ id }: { id: number }) {
  const r = await db.buildRequest.findUnique({ where: { id }, include: { plan: true, saleListing: true, user: { select: { id: true, role: true } } } });
  if (!r) notFound();
  const first = r.name.split(" ")[0];
  const wa = `https://wa.me/${r.phone.replace("+", "")}?text=${encodeURIComponent(`Hello ${first}, this is CasaVilla about your building request.`)}`;
  const rows: [string, React.ReactNode][] = [
    ["What", BUILD_KINDS[r.kind as BuildKind]?.label ?? r.kind],
    ["Where", r.location || "—"],
    ["Plot", r.plot ? PLOT[r.plot as keyof typeof PLOT] : "—"],
    ["Budget", r.budget ? fullUgx(r.budget) : "Not given"],
    ["When", r.timeline ? TIMELINE[r.timeline as keyof typeof TIMELINE] : "—"],
    ["Email", r.email ? <a href={`mailto:${r.email}`} className="link">{r.email}</a> : "—"],
    ["Account", r.user ? `Signed in (${r.user.role})` : "No account"],
    ["Received", fmtDateTime(r.createdAt)],
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={BASE} className="link text-sm">← Build requests</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{r.name}</h1>
          <div className="muted">{BUILD_KINDS[r.kind as BuildKind]?.label}{r.location ? ` · ${r.location}` : ""}</div>
        </div>
        {pill(r.status)}
      </div>
      <div className="card flex flex-wrap gap-2">
        <a href={`tel:${r.phone}`} className="btn-primary btn-sm"><Phone className="h-3.5 w-3.5" /> Call {r.phone}</a>
        <a href={wa} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
      </div>
      {(r.plan || r.saleListing) && (
        <div className="card space-y-1 text-sm">
          {r.plan && <div>House plan: <Link href={planHref(r.plan)} className="link">{r.plan.title}</Link> <span className="text-stone-500">· {shortUgx(r.plan.price)}{buildCost(r.plan) ? ` · build ${buildCost(r.plan)}` : ""}</span></div>}
          {r.saleListing && <div>Plot for sale: <Link href={saleHref(r.saleListing)} className="link">{r.saleListing.title}</Link> <span className="text-stone-500">· {shortUgx(r.saleListing.price)} · {r.saleListing.status}</span></div>}
        </div>
      )}
      <div className="card space-y-1 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-0.5"><span className="text-stone-500">{k}</span><span className="text-right text-stone-800">{v}</span></div>)}
        {r.message && <p className="mt-2 whitespace-pre-line break-words rounded-xl bg-stone-50 p-3 text-stone-700">{r.message}</p>}
      </div>
      <form action={updateBuildRequest} className="card space-y-3">
        <input type="hidden" name="id" value={r.id} />
        <div className="font-semibold text-brand-950">Follow-up</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Stage"><select name="status" defaultValue={r.status} className="input">{REQUEST_STATUS_KEYS.map((s) => <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>)}</select></Field>
          <Field label="Quote sent (UGX)" hint="Fill in when you send the quote"><input name="quote" inputMode="numeric" defaultValue={r.quote ?? ""} className="input" placeholder="e.g. 185000000" /></Field>
        </div>
        <Field label="Notes for the team"><textarea name="staffNote" rows={4} maxLength={3000} defaultValue={r.staffNote ?? ""} className="input" placeholder="Called on…, site visit booked for…, soil is…" /></Field>
        <Submit className="btn-primary btn-sm">Save</Submit>
        <p className="text-[11px] text-stone-500">Last updated {fmtDateTime(r.updatedAt)}</p>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// House plans

export async function PlanList() {
  const plans = await db.housePlan.findMany({ orderBy: [{ published: "desc" }, { sort: "asc" }, { id: "desc" }], include: { _count: { select: { photos: true, requests: true } } } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Build & construction" subtitle="CasaVilla's ready-made house plans. Published plans appear on the Build page and in the plan catalogue."
        actions={<Link href={`${BASE}/plans/new`} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New plan</Link>} />
      <BuildTabs active="plans" />
      {plans.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {plans.map((p) => (
            <Link key={p.id} href={`${BASE}/plans/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{p.title}</div>
                <div className="truncate text-xs text-stone-500">{PLAN_STYLES[p.style as PlanStyle]?.label} · {planFacts(p) || "—"} · {shortUgx(p.price)}</div>
                <div className="text-[11px] text-stone-500">{p._count.photos ? `${p._count.photos} picture${p._count.photos === 1 ? "" : "s"}` : <span className="font-semibold text-gold-700">No pictures yet</span>}{p._count.requests ? ` · ${p._count.requests} request${p._count.requests === 1 ? "" : "s"}` : ""}</div>
              </div>
              <Badge color={p.published ? "green" : "gray"}>{p.published ? "Published" : "Draft"}</Badge>
            </Link>
          ))}
        </div>
      ) : <Empty title="No plans yet">Add CasaVilla&apos;s house plans with their drawings, price and estimated build cost.</Empty>}
    </div>
  );
}

export function PlanForm({ p }: { p?: Prisma.HousePlanGetPayload<object> }) {
  return (
    <form action={saveHousePlan} className="card space-y-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Name of the plan"><input name="title" required maxLength={100} defaultValue={p?.title} className="input" placeholder="e.g. 3-bedroom bungalow with boys' quarter" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Type"><select name="style" defaultValue={p?.style ?? "bungalow"} className="input">{PLAN_STYLE_KEYS.map((s) => <option key={s} value={s}>{PLAN_STYLES[s].label}</option>)}</select></Field>
        <Field label="Bedrooms"><input name="bedrooms" inputMode="numeric" defaultValue={p?.bedrooms ?? ""} className="input" /></Field>
        <Field label="Bathrooms"><input name="bathrooms" inputMode="numeric" defaultValue={p?.bathrooms ?? ""} className="input" /></Field>
        <Field label="Floors"><input name="floors" inputMode="numeric" defaultValue={p?.floors ?? 1} className="input" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Floor area (m²)"><input name="areaSqm" inputMode="numeric" defaultValue={p?.areaSqm ?? ""} className="input" /></Field>
        <Field label="Fits a plot of"><input name="plotSize" maxLength={40} defaultValue={p?.plotSize ?? ""} className="input" placeholder="e.g. 50 × 100 ft" /></Field>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Price of the plans (UGX)" hint="0 = free when CasaVilla builds it"><input name="price" required inputMode="numeric" defaultValue={p?.price ?? ""} className="input" placeholder="e.g. 1500000" /></Field>
        <Field label="Build cost from (UGX)"><input name="buildFrom" inputMode="numeric" defaultValue={p?.buildFrom ?? ""} className="input" placeholder="e.g. 120000000" /></Field>
        <Field label="Build cost to (UGX)"><input name="buildTo" inputMode="numeric" defaultValue={p?.buildTo ?? ""} className="input" placeholder="e.g. 150000000" /></Field>
      </div>
      <Field label="One-line summary" hint="Shown under the title"><input name="summary" maxLength={200} defaultValue={p?.summary ?? ""} className="input" placeholder="e.g. Open-plan living, en-suite master, wide veranda" /></Field>
      <Field label="Description"><textarea name="description" rows={5} maxLength={5000} defaultValue={p?.description ?? ""} className="input" /></Field>
      <Field label="Features" hint="One per line"><textarea name="features" rows={4} defaultValue={p?.features.join("\n") ?? ""} className="input" placeholder={"En-suite master bedroom\nOpen-plan kitchen\nBoys' quarter\nCovered parking"} /></Field>
      <Submit className="btn-primary">{p ? "Save changes" : "Save and add drawings"}</Submit>
    </form>
  );
}

export async function PlanManage({ id, fresh }: { id: number; fresh?: boolean }) {
  const p = await db.housePlan.findUnique({ where: { id }, include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] }, _count: { select: { requests: true } } } });
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {fresh && <ScrollTop />}
      <Link href={`${BASE}/plans`} className="link text-sm">← House plans</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="h1">{p.title}</h1><div className="muted">{PLAN_STYLES[p.style as PlanStyle]?.label} · {planFacts(p) || "—"} · {shortUgx(p.price)}{buildCost(p) ? ` · build ${buildCost(p)}` : ""}</div></div>
        <Badge color={p.published ? "green" : "gray"}>{p.published ? "Published" : "Draft"}</Badge>
      </div>
      <SalePhotos listingId={`plan:${p.id}`} photos={p.photos.map((x) => ({ id: x.id, fileId: x.fileId, isCover: x.isCover }))} highlight={!!fresh || !p.photos.length}
        actions={photoActions} words={{ empty: "Add the drawings and pictures", hint: "Floor plans, elevations and a 3D view or photo of a finished house. The first is the cover.", tips: "Tip: export drawings as JPG or PNG. A 3D render or a photo of one you built makes the best cover." }} />
      <div className="card flex flex-wrap items-center gap-2">
        {p.published && <Link href={planHref(p)} className="btn-ghost btn-sm">View public page</Link>}
        <form action={setPlanPublished}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.published ? "0" : "1"} /><Submit className={p.published ? "btn-outline btn-sm" : "btn-primary btn-sm"}>{p.published ? "Unpublish" : "Publish"}</Submit></form>
        <form action={deleteHousePlan} className="ml-auto"><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Delete this plan for good? Requests that mention it are kept." className="text-xs font-semibold text-maroon-600 hover:underline">Delete</ConfirmSubmit></form>
      </div>
      {p._count.requests > 0 && <div className="card text-sm text-brand-900"><b>{p._count.requests}</b> request{p._count.requests === 1 ? "" : "s"} mention this plan — see <Link href={BASE} className="link">Requests</Link>.</div>}
      <div className="font-semibold text-brand-950">Details</div>
      <PlanForm p={p} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Our work (past projects)

export async function ProjectList() {
  const rows = await db.buildProject.findMany({ orderBy: [{ published: "desc" }, { year: "desc" }, { id: "desc" }], include: { _count: { select: { photos: true } } } });
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Build & construction" subtitle="Projects CasaVilla has designed or built. Shown ones appear under “Our work” on the Build page — photos build trust."
        actions={<Link href={`${BASE}/projects/new`} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New project</Link>} />
      <BuildTabs active="projects" />
      {rows.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {rows.map((p) => (
            <Link key={p.id} href={`${BASE}/projects/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{p.title}</div>
                <div className="truncate text-xs text-stone-500">{PROJECT_KINDS[p.kind as ProjectKind]} · {p.location}{p.year ? ` · ${p.year}` : ""} · {p._count.photos} photo{p._count.photos === 1 ? "" : "s"}</div>
              </div>
              <Badge color={p.published ? "green" : "gray"}>{p.published ? "Shown" : "Hidden"}</Badge>
            </Link>
          ))}
        </div>
      ) : <Empty title="No projects yet">Add houses and buildings CasaVilla has built, with a few good photos of each.</Empty>}
    </div>
  );
}

export function ProjectForm({ p }: { p?: Prisma.BuildProjectGetPayload<object> }) {
  return (
    <form action={saveBuildProject} className="card space-y-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <Field label="Name"><input name="title" required maxLength={100} defaultValue={p?.title} className="input" placeholder="e.g. 4-bedroom family home" /></Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Type"><select name="kind" defaultValue={p?.kind ?? "house"} className="input">{Object.entries(PROJECT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Where"><input name="location" required maxLength={120} defaultValue={p?.location} className="input" placeholder="e.g. Kira, Wakiso" /></Field>
        <Field label="Year finished"><input name="year" inputMode="numeric" defaultValue={p?.year ?? ""} className="input" placeholder={String(new Date().getFullYear())} /></Field>
      </div>
      <Field label="Short description"><textarea name="summary" rows={3} maxLength={600} defaultValue={p?.summary ?? ""} className="input" placeholder="What was built, in how long, anything special" /></Field>
      <Submit className="btn-primary">{p ? "Save changes" : "Save and add photos"}</Submit>
    </form>
  );
}

export async function ProjectManage({ id, fresh }: { id: number; fresh?: boolean }) {
  const p = await db.buildProject.findUnique({ where: { id }, include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] } } });
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {fresh && <ScrollTop />}
      <Link href={`${BASE}/projects`} className="link text-sm">← Our work</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h1 className="h1">{p.title}</h1><div className="muted">{PROJECT_KINDS[p.kind as ProjectKind]} · {p.location}{p.year ? ` · ${p.year}` : ""}</div></div>
        <Badge color={p.published ? "green" : "gray"}>{p.published ? "Shown" : "Hidden"}</Badge>
      </div>
      <SalePhotos listingId={`project:${p.id}`} photos={p.photos.map((x) => ({ id: x.id, fileId: x.fileId, isCover: x.isCover }))} highlight={!!fresh || !p.photos.length}
        actions={photoActions} words={{ empty: "Add photos of the finished building", hint: "The finished outside first, then rooms and a few progress shots.", tips: "Tip: shoot in daylight from the gate or the road, so people see the whole building." }} />
      <div className="card flex flex-wrap items-center gap-2">
        <form action={setProjectPublished}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.published ? "0" : "1"} /><Submit className={p.published ? "btn-outline btn-sm" : "btn-primary btn-sm"}>{p.published ? "Hide from the Build page" : "Show on the Build page"}</Submit></form>
        <span className="text-xs text-stone-500">Added {fmtDate(p.createdAt)}</span>
        <form action={deleteBuildProject} className="ml-auto"><input type="hidden" name="id" value={p.id} /><ConfirmSubmit message="Delete this project and its photos?" className="text-xs font-semibold text-maroon-600 hover:underline">Delete</ConfirmSubmit></form>
      </div>
      <div className="font-semibold text-brand-950">Details</div>
      <ProjectForm p={p} />
    </div>
  );
}
