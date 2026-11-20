import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Eye, MessageCircle, Phone, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db, type User } from "@/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { KIND, STATUS, TENURE, TITLE, fullUgx, shortUgx, sizeText, type SaleKind } from "@/lib/sales";
import { Badge, Empty, PageHeader } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { Steps } from "./NewPropertyFlow";
import { PlaceFields } from "./PlaceFields";
import { SaleBasics, SaleDetails } from "./SaleFields";
import { SalePhotos, ScrollTop } from "./SalePhotos";
import { AddChoice } from "./AddChoice";
import { Checklist } from "./Checklist";
import { closeListingReport, deleteSaleListing, markEnquiry, recordAgentSale, renewSaleListing, reviewSale, saveSaleListing, setSaleStatus, uploadMandate, verifySaleTitle } from "@/app/sale-actions";

const pill = (s: string) => <Badge color={STATUS[s]?.tone ?? "gray"}>{STATUS[s]?.label ?? s}</Badge>;

/** An agent: their own listings. The office: everything, with the review queue first. */
export async function SaleList({ viewer, tab }: { viewer: User; tab?: string }) {
  const manager = viewer.role === "manager";
  const where: Prisma.SaleListingWhereInput = manager
    ? tab === "review" || !tab ? { status: "pending" } : tab === "live" ? { status: { in: ["active", "under_offer"] } } : tab === "reported" ? { reports: { some: { status: "new" } } } : {}
    : { ownerId: viewer.id };
  const [rows, pending, newEnq, reported] = await Promise.all([
    db.saleListing.findMany({
      where, orderBy: [{ updatedAt: "desc" }], take: 100,
      include: { owner: { select: { name: true } }, _count: { select: { enquiries: { where: { status: "new" } }, photos: true } } },
    }),
    manager ? db.saleListing.count({ where: { status: "pending" } }) : 0,
    db.saleEnquiry.count({ where: { status: "new", ...(manager ? {} : { listing: { ownerId: viewer.id } }) } }),
    manager ? db.saleListing.count({ where: { reports: { some: { status: "new" } } } }) : 0,
  ]);
  const base = `/${viewer.role}/sale`;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="For sale" subtitle={manager ? "Land and property listed for sale — review new listings, verify titles, follow up buyers." : "Land and property you're selling. CasaVilla reviews each listing before it goes public."}
        actions={<Link href={`${base}/new`} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New listing</Link>} />
      {manager && (
        <div className="mb-4 flex gap-2">
          {[["review", `To review${pending ? ` (${pending})` : ""}`], ["reported", `Reported${reported ? ` (${reported})` : ""}`], ["live", "Live"], ["all", "All"]].map(([k, label]) => (
            <Link key={k} href={`${base}?tab=${k}`} className={(tab ?? "review") === k ? "chip-active" : "chip"}>{label}</Link>
          ))}
        </div>
      )}
      {newEnq > 0 && viewer.role !== "agent" && <div className="card mb-4 border-brand-100 bg-brand-50/60 text-sm text-brand-900"><b>{newEnq} new buyer enquir{newEnq === 1 ? "y" : "ies"}</b> — open the listing to call them back.</div>}
      {rows.length ? (
        <div className="card divide-y divide-stone-100 p-0">
          {rows.map((l) => (
            <Link key={l.id} href={`${base}/${l.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-stone-900">{l.title}</div>
                <div className="truncate text-xs text-stone-500">{KIND[l.kind as SaleKind]?.label} · {shortUgx(l.price)} · {l.location}{manager ? ` · ${l.owner.name}` : ""}</div>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-stone-500">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {l.views}</span>
                  {l._count.photos ? <span>{l._count.photos} photo{l._count.photos === 1 ? "" : "s"}</span> : <span className="font-semibold text-gold-700">No photos yet — tap to add</span>}
                  {l._count.enquiries > 0 && <span className="font-semibold text-brand-700">{l._count.enquiries} new enquir{l._count.enquiries === 1 ? "y" : "ies"}</span>}
                </div>
              </div>
              {pill(l.status)}
            </Link>
          ))}
        </div>
      ) : <Empty title={manager ? "Nothing here" : "No listings yet"}>{manager ? "New listings from landlords appear here for review." : "List land, a house or a building for sale — it takes three short steps."}</Empty>}
    </div>
  );
}

/** Three steps: what & price → size, ownership & features → where. Photos come right after. */
export async function SaleForm({ viewer, id }: { viewer: User; id?: number }) {
  const l = id ? await db.saleListing.findUnique({ where: { id } }) : null;
  if (id && (!l || (viewer.role !== "manager" && l.ownerId !== viewer.id))) notFound();
  const d = l ?? {};
  return (
    <div className="mx-auto max-w-2xl">
      <Link href={l ? `/${viewer.role}/sale/${l.id}` : `/${viewer.role}/sale`} className="link text-sm">← {l ? l.title : "For sale"}</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold text-brand-950">{l ? "Edit listing" : "List land or a property for sale"}</h1>
      {!l && (viewer.role === "landlord" || viewer.role === "manager") && <AddChoice role={viewer.role} active="sell" />}
      <form action={saveSaleListing}>
        {l && <input type="hidden" name="id" value={l.id} />}
        <Steps titles={["What & price", "Details", "Location"]} submitLabel={l ? "Save changes" : viewer.role === "manager" ? "Publish" : "Send for review"}>
          <div><SaleBasics d={d} /></div>
          <div><SaleDetails d={d} /></div>
          <div><PlaceFields p={l ?? undefined} /></div>
        </Steps>
      </form>
    </div>
  );
}

/** One listing for its owner or CasaVilla: status, review, photos, buyers' enquiries. */
export async function SaleManage({ viewer, id, fresh }: { viewer: User; id: number; fresh?: boolean }) {
  const l = await db.saleListing.findUnique({
    where: { id },
    include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] }, enquiries: { orderBy: { createdAt: "desc" } }, owner: { select: { id: true, name: true, phone: true, role: true, status: true, salesCommissionPct: true } }, reports: { orderBy: { createdAt: "desc" } } },
  });
  if (!l || (viewer.role !== "manager" && l.ownerId !== viewer.id)) notFound();
  const manager = viewer.role === "manager";
  const agentListing = l.owner.role === "agent";
  const base = `/${viewer.role}/sale`;
  const live = ["active", "under_offer", "sold"].includes(l.status);
  // Office: other listings that may be the same plot or house (same area and kind, and the same estate/plot or a close price).
  const dupes = manager ? await db.saleListing.findMany({
    where: { id: { not: l.id }, kind: l.kind, status: { in: ["pending", "active", "under_offer"] }, ...(l.locationId ? { locationId: l.locationId } : { location: l.location }),
      OR: [...(l.plot ? [{ plot: { equals: l.plot, mode: "insensitive" as const } }] : []), ...(l.estate ? [{ estate: { equals: l.estate, mode: "insensitive" as const } }] : []), { price: { gte: l.price * 0.9, lte: l.price * 1.1 } }] },
    select: { id: true, title: true, price: true, owner: { select: { name: true } } }, take: 5,
  }) : [];
  const expiresSoon = !!l.expiresAt && ["active", "under_offer"].includes(l.status) && l.expiresAt.getTime() - Date.now() < 30 * 86400000;
  // Straight after saving (or while there are none), photos are the next step — shown first and highlighted.
  const photosFirst = !!fresh || l.photos.length === 0;
  const photosCard = (
    <SalePhotos listingId={l.id} photos={l.photos.map((p) => ({ id: p.id, fileId: p.fileId, isCover: p.isCover }))} highlight={photosFirst}
      doneHref={fresh ? `/${viewer.role}/sale/${l.id}` : undefined} reviewNote={!manager && l.status === "pending"} />
  );
  const statusBtn = (to: string, label: string, cls = "btn-outline btn-sm", confirm?: string) => (
    <form action={setSaleStatus}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value={to} />
      {confirm ? <ConfirmSubmit message={confirm} className={cls}>{label}</ConfirmSubmit> : <Submit className={cls}>{label}</Submit>}</form>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href={base} className="link text-sm">← For sale</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="h1">{l.title}</h1>
          <div className="muted">{KIND[l.kind as SaleKind]?.label} · {fullUgx(l.price)}{l.negotiable ? " (negotiable)" : ""} · {l.location}</div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-500">
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {l.views} views</span>
            <span>{l.enquiries.length} enquir{l.enquiries.length === 1 ? "y" : "ies"}</span>
            {manager && <span>{agentListing ? "Agent" : "Owner"}: <Link href={`/manager/people/${l.owner.id}`} className="link">{l.owner.name}</Link> · <a href={`tel:${l.owner.phone}`} className="link">{l.owner.phone}</a></span>}
            {l.expiresAt && ["active", "under_offer"].includes(l.status) && <span className={expiresSoon ? "font-semibold text-gold-700" : ""}>Expires {fmtDate(l.expiresAt)}</span>}
          </div>
        </div>
        {pill(l.status)}
      </div>

      {fresh && <ScrollTop />}
      {photosFirst && photosCard}
      {l.status === "rejected" && l.reviewNote && <div className="card border-maroon-100 bg-maroon-50/50 text-sm"><b className="text-maroon-700">CasaVilla asked for changes:</b> {l.reviewNote}<div className="mt-1 text-xs text-stone-500">Edit the listing and save — it goes back for review.</div></div>}

      {agentListing && (
        <div className="card space-y-2 text-sm">
          <div className="font-semibold text-brand-950">Owner&apos;s authority to sell</div>
          {l.mandateFileId
            ? <div className="flex flex-wrap items-center gap-2"><span className="flex items-center gap-1 font-semibold text-brand-700"><BadgeCheck className="h-4 w-4" /> On file</span><a href={`/api/files/${l.mandateFileId}`} target="_blank" rel="noreferrer" className="link text-xs">Open</a></div>
            : <p className="text-stone-600">{manager ? "Not uploaded yet. The listing can't be published without it." : "Upload the owner's signed letter allowing you to sell. CasaVilla won't publish the listing without it."}</p>}
          <form action={uploadMandate} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={l.id} />
            <input type="file" name="mandate" accept="application/pdf,image/*" required className="input max-w-xs py-1.5 text-xs" />
            <Submit className="btn-outline btn-sm">{l.mandateFileId ? "Replace" : "Upload"}</Submit>
          </form>
        </div>
      )}
      {(l.status === "expired" || (expiresSoon && l.expiresAt)) && (
        <form action={renewSaleListing} className="card flex flex-wrap items-center gap-3 border-gold-200 bg-gold-50/60 text-sm">
          <input type="hidden" name="id" value={l.id} />
          <span className="mr-auto">{l.status === "expired" ? "This listing expired and is no longer public. Still for sale? Renew it (CasaVilla checks it again)." : `Comes down on ${fmtDate(l.expiresAt!)}. Still for sale? Renew it for another 90 days.`}</span>
          <Submit className="btn-primary btn-sm">Renew</Submit>
        </form>
      )}
      {manager && l.reports.some((r) => r.status === "new") && (
        <div className="card space-y-2 border-maroon-100 bg-maroon-50/40 text-sm">
          <div className="font-semibold text-maroon-700">Reported by the public</div>
          {l.reports.filter((r) => r.status === "new").map((r) => (
            <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-maroon-100 pt-2">
              <div className="min-w-0"><b>{r.reason}</b>{r.details && <div className="break-words text-stone-700">{r.details}</div>}<div className="text-xs text-stone-500">{fmtDateTime(r.createdAt)}{r.contact ? ` · ${r.contact}` : ""}</div></div>
              <form action={closeListingReport}><input type="hidden" name="id" value={r.id} /><Submit className="btn-ghost btn-sm">Checked — close</Submit></form>
            </div>
          ))}
        </div>
      )}
      {manager && dupes.length > 0 && (
        <div className="card text-sm">
          <div className="font-semibold text-gold-700">Possible duplicates — check it isn&apos;t the same plot or house</div>
          {dupes.map((d) => <Link key={d.id} href={`/manager/sale/${d.id}`} className="link block">{d.title} · {shortUgx(d.price)} · {d.owner.name}</Link>)}
        </div>
      )}
      {manager && (
        <div className="card space-y-3">
          <div className="font-semibold text-brand-950">CasaVilla review</div>
          {l.status === "pending" && (
            <div className="space-y-2">
              <form action={reviewSale} className="space-y-2"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="approve" />
                <Checklist name="sale" title="Before you publish" />
                <Submit className="btn-primary btn-sm">Approve & publish</Submit></form>
              <form action={reviewSale} className="flex gap-2"><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="reject" />
                <input name="note" required maxLength={500} className="input py-2" placeholder="What needs changing? e.g. clearer photos, the plot size" />
                <Submit className="btn-outline btn-sm shrink-0">Send back</Submit></form>
            </div>
          )}
          <form action={verifySaleTitle} className="flex flex-wrap items-center gap-2 text-sm">
            <input type="hidden" name="id" value={l.id} /><input type="hidden" name="on" value={l.titleVerified ? "0" : "1"} />
            {l.titleVerified ? <span className="flex items-center gap-1 font-semibold text-brand-700"><BadgeCheck className="h-4 w-4" /> Title verified</span> : <span className="text-stone-600">{TITLE[l.titleStatus]}{l.tenure ? ` · ${TENURE[l.tenure].label}` : ""}</span>}
            {(l.titleVerified || l.titleStatus === "titled") && <Submit className="btn-ghost btn-sm">{l.titleVerified ? "Remove badge" : "I've seen the title & done a land search — verify"}</Submit>}
          </form>
        </div>
      )}

      {agentListing && l.status === "sold" && l.soldPrice != null && (
        <div className="card text-sm">Sold for <b>{fullUgx(l.soldPrice)}</b>{l.saleCommission != null && <> · CasaVilla commission <b>{fullUgx(l.saleCommission)}</b></>}{l.soldAt && ` · ${fmtDate(l.soldAt)}`}</div>
      )}
      {manager && agentListing && ["active", "under_offer"].includes(l.status) && (
        <form action={recordAgentSale} className="card flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="id" value={l.id} />
          <label className="min-w-0"><span className="label">Sold for (UGX)</span><input name="soldPrice" type="number" min={100000} required className="input w-44 py-2" defaultValue={l.price} /></label>
          <span className="pb-2 text-xs text-stone-500">CasaVilla&apos;s {l.owner.salesCommissionPct}% is worked out from this.</span>
          <ConfirmSubmit message="Record this listing as sold at this price?" className="btn-primary btn-sm">Record the sale</ConfirmSubmit>
        </form>
      )}
      {viewer.role === "agent" && ["active", "under_offer"].includes(l.status) && <p className="text-xs text-stone-500">Sold? Tell the CasaVilla office; they record the price and close the listing.</p>}
      <div className="card flex flex-wrap items-center gap-2">
        {live && <Link href={`/sale/${l.id}`} className="btn-ghost btn-sm">View public page</Link>}
        {!live && <Link href={`/sale/${l.id}`} className="btn-ghost btn-sm">Preview</Link>}
        <Link href={`${base}/${l.id}/edit`} className="btn-outline btn-sm">Edit details</Link>
        {l.status === "active" && statusBtn("under_offer", "Mark under offer")}
        {l.status === "under_offer" && statusBtn("active", "Back on the market")}
        {["active", "under_offer"].includes(l.status) && !agentListing && statusBtn("sold", "Mark as sold", "btn-primary btn-sm", "Mark this as sold? It stays visible as “Sold” and stops taking enquiries.")}
        {["active", "under_offer", "pending", "rejected"].includes(l.status) && statusBtn("withdrawn", "Withdraw", "btn-ghost btn-sm text-maroon-600", "Take this listing down?")}
        {["withdrawn", "sold"].includes(l.status) && statusBtn("active", manager ? "Publish again" : "Relist (sends for review)")}
        {l.status === "expired" && statusBtn("withdrawn", "Withdraw", "btn-ghost btn-sm text-maroon-600", "Take this listing down for good?")}
        {l.enquiries.length === 0 && (
          <form action={deleteSaleListing} className="ml-auto"><input type="hidden" name="id" value={l.id} /><ConfirmSubmit message="Delete this listing for good?" className="text-xs font-semibold text-maroon-600 hover:underline">Delete</ConfirmSubmit></form>
        )}
      </div>

      {!photosFirst && photosCard}

      <div className="card space-y-1 text-sm">
        <div className="mb-1 font-semibold text-brand-950">Details</div>
        <Row k="Size" v={sizeText(l) || "—"} />
        {l.bedrooms != null && <Row k="Bedrooms / bathrooms" v={`${l.bedrooms} / ${l.bathrooms ?? "—"}`} />}
        <Row k="Tenure" v={l.tenure ? TENURE[l.tenure].label : "Not given"} />
        <Row k="Title" v={`${TITLE[l.titleStatus]}${l.titleVerified ? " · verified by CasaVilla" : ""}`} />
        <Row k="Features" v={l.features.join(", ") || "—"} />
        <Row k="Listed" v={l.publishedAt ? fmtDate(l.publishedAt) : "Not yet published"} />
      </div>

      {viewer.role === "agent" ? (
        <div className="card text-sm">
          <div className="font-semibold text-brand-950">Buyer enquiries</div>
          <p className="mt-1 text-stone-600">{l.enquiries.length ? `${l.enquiries.length} enquir${l.enquiries.length === 1 ? "y" : "ies"} so far (${l.enquiries.filter((e) => e.wantsViewing).length} asking to view).` : "No enquiries yet."} Buyers deal with the CasaVilla office, which passes serious buyers on to you.</p>
        </div>
      ) : (
      <div className="card p-0">
        <div className="px-4 pb-2 pt-4 font-semibold text-brand-950">Buyer enquiries</div>
        {l.enquiries.length ? (
          <div className="divide-y divide-stone-100 border-t border-stone-100">
            {l.enquiries.map((e) => (
              <div key={e.id} className="space-y-1.5 px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium">{e.name} {e.wantsViewing && <span className="pill ml-1 bg-brand-50 text-brand-700">Viewing{e.viewingDate ? ` · ${fmtDate(e.viewingDate)}` : ""}</span>}</div>
                    <div className="text-xs text-stone-500">{e.phone} · {fmtDateTime(e.createdAt)}</div>
                  </div>
                  <Badge color={e.status === "new" ? "blue" : e.status === "contacted" ? "green" : "gray"}>{e.status}</Badge>
                </div>
                {e.message && <p className="break-words text-stone-700">{e.message}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${e.phone}`} className="btn-outline btn-sm"><Phone className="h-3.5 w-3.5" /> Call</a>
                  <a href={`https://wa.me/${e.phone.replace("+", "")}?text=${encodeURIComponent(`Hello ${e.name.split(" ")[0]}, this is about "${l.title}" on CasaVilla.`)}`} className="btn-outline btn-sm"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a>
                  {e.status !== "contacted" && <form action={markEnquiry}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="contacted" /><Submit className="btn-ghost btn-sm">Mark contacted</Submit></form>}
                  {e.status !== "closed" && <form action={markEnquiry}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="closed" /><Submit className="btn-ghost btn-sm">Close</Submit></form>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="px-4 pb-4 text-sm text-stone-500">No enquiries yet{live ? " — share the public page to reach buyers." : "."}</p>}
      </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 py-0.5"><span className="text-stone-500">{k}</span><span className="text-right text-stone-800">{v}</span></div>;
}
