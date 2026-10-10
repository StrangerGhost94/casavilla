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
import { deleteSaleListing, markEnquiry, reviewSale, saveSaleListing, setSaleStatus, verifySaleTitle } from "@/app/sale-actions";

const pill = (s: string) => <Badge color={STATUS[s]?.tone ?? "gray"}>{STATUS[s]?.label ?? s}</Badge>;

/** Landlord: their listings. Manager: everything, with the review queue first. */
export async function SaleList({ viewer, tab }: { viewer: User; tab?: string }) {
  const manager = viewer.role === "manager";
  const where: Prisma.SaleListingWhereInput = manager
    ? tab === "review" || !tab ? { status: "pending" } : tab === "live" ? { status: { in: ["active", "under_offer"] } } : {}
    : { ownerId: viewer.id };
  const [rows, pending, newEnq] = await Promise.all([
    db.saleListing.findMany({
      where, orderBy: [{ updatedAt: "desc" }], take: 100,
      include: { owner: { select: { name: true } }, _count: { select: { enquiries: { where: { status: "new" } }, photos: true } } },
    }),
    manager ? db.saleListing.count({ where: { status: "pending" } }) : 0,
    db.saleEnquiry.count({ where: { status: "new", ...(manager ? {} : { listing: { ownerId: viewer.id } }) } }),
  ]);
  const base = `/${viewer.role}/sale`;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="For sale" subtitle={manager ? "Land and property listed for sale — review new listings, verify titles, follow up buyers." : "Land and property you're selling. CasaVilla reviews each listing before it goes public."}
        actions={<Link href={`${base}/new`} className="btn-primary btn-sm"><Plus className="h-4 w-4" /> New listing</Link>} />
      {manager && (
        <div className="mb-4 flex gap-2">
          {[["review", `To review${pending ? ` (${pending})` : ""}`], ["live", "Live"], ["all", "All"]].map(([k, label]) => (
            <Link key={k} href={`${base}?tab=${k}`} className={(tab ?? "review") === k ? "chip-active" : "chip"}>{label}</Link>
          ))}
        </div>
      )}
      {newEnq > 0 && <div className="card mb-4 border-brand-100 bg-brand-50/60 text-sm text-brand-900"><b>{newEnq} new buyer enquir{newEnq === 1 ? "y" : "ies"}</b> — open the listing to call them back.</div>}
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
    include: { photos: { orderBy: [{ isCover: "desc" }, { sort: "asc" }] }, enquiries: { orderBy: { createdAt: "desc" } }, owner: { select: { name: true, phone: true } } },
  });
  if (!l || (viewer.role !== "manager" && l.ownerId !== viewer.id)) notFound();
  const manager = viewer.role === "manager";
  const base = `/${viewer.role}/sale`;
  const live = ["active", "under_offer", "sold"].includes(l.status);
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
            {manager && <span>Owner: {l.owner.name} · <a href={`tel:${l.owner.phone}`} className="link">{l.owner.phone}</a></span>}
          </div>
        </div>
        {pill(l.status)}
      </div>

      {fresh && <ScrollTop />}
      {photosFirst && photosCard}
      {l.status === "rejected" && l.reviewNote && <div className="card border-maroon-100 bg-maroon-50/50 text-sm"><b className="text-maroon-700">CasaVilla asked for changes:</b> {l.reviewNote}<div className="mt-1 text-xs text-stone-500">Edit the listing and save — it goes back for review.</div></div>}

      {manager && (
        <div className="card space-y-3">
          <div className="font-semibold text-brand-950">CasaVilla review</div>
          {l.status === "pending" && (
            <div className="space-y-2">
              <form action={reviewSale}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="decision" value="approve" /><Submit className="btn-primary btn-sm">Approve & publish</Submit></form>
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

      <div className="card flex flex-wrap items-center gap-2">
        {live && <Link href={`/sale/${l.id}`} className="btn-ghost btn-sm">View public page</Link>}
        {!live && <Link href={`/sale/${l.id}`} className="btn-ghost btn-sm">Preview</Link>}
        <Link href={`${base}/${l.id}/edit`} className="btn-outline btn-sm">Edit details</Link>
        {l.status === "active" && statusBtn("under_offer", "Mark under offer")}
        {l.status === "under_offer" && statusBtn("active", "Back on the market")}
        {["active", "under_offer"].includes(l.status) && statusBtn("sold", "Mark as sold", "btn-primary btn-sm", "Mark this as sold? It stays visible as “Sold” and stops taking enquiries.")}
        {["active", "under_offer", "pending", "rejected"].includes(l.status) && statusBtn("withdrawn", "Withdraw", "btn-ghost btn-sm text-maroon-600", "Take this listing down?")}
        {["withdrawn", "sold"].includes(l.status) && statusBtn("active", manager ? "Publish again" : "Relist (sends for review)")}
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
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 py-0.5"><span className="text-stone-500">{k}</span><span className="text-right text-stone-800">{v}</span></div>;
}
