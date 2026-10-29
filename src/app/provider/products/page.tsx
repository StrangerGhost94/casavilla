import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";
import { db, PRODUCT_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { PageHeader, Field, Photo } from "@/components/ui";
import { Submit, FileInput } from "@/components/client";
import { saveProduct, toggleProduct } from "../actions";

export default async function ProviderProducts() {
  const u = await requireUser("provider");
  const list = await db.product.findMany({ where: { providerId: u.id }, orderBy: { id: "desc" } });
  const listed = list.filter((p) => p.active).length;
  const low = list.filter((p) => p.active && p.stock <= 3).length;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Items for sale" subtitle="Sell materials and supplies: paint, fittings, cleaning products, pest treatments…"
        actions={<Link href={`/shop?seller=${u.id}`} className="btn-outline btn-sm"><ExternalLink className="h-4 w-4" /> See in shop</Link>} />

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><div className="text-xl font-bold text-brand-950">{list.length}</div><div className="text-xs text-stone-500">Items</div></div>
        <div className="card p-4"><div className="text-xl font-bold text-brand-700">{listed}</div><div className="text-xs text-stone-500">In the shop</div></div>
        <div className={`card p-4 ${low ? "border-gold-200 bg-gold-50/50" : ""}`}><div className={`text-xl font-bold ${low ? "text-gold-700" : "text-brand-950"}`}>{low}</div><div className="text-xs text-stone-500">Low on stock</div></div>
      </div>

      <details className="card mt-4 group" open={list.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold text-brand-950"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Plus className="h-4 w-4" /></span> Add an item</summary>
        <form action={saveProduct} className="mt-4 grid grid-cols-1 gap-3 border-t border-stone-100 pt-4 sm:grid-cols-2">
          <Field label="Name"><input name="name" className="input" required placeholder="e.g. Kitchen mixer tap" /></Field>
          <Field label="Shop section"><select name="category" className="input" defaultValue="Building materials">{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price (UGX)"><input name="price" type="number" className="input" required /></Field>
            <Field label="In stock"><input name="stock" type="number" className="input" defaultValue={1} /></Field>
          </div>
          <div className="sm:col-span-2"><Field label="Description"><textarea name="description" rows={2} className="input" placeholder="Size, brand, what it's for" /></Field></div>
          <Field label="Photo" hint="A clear photo on a plain background sells best."><FileInput name="photo" accept="image/*" /></Field>
          <div className="flex items-end"><Submit className="btn-primary w-full">Add item</Submit></div>
        </form>
      </details>

      <h2 className="h2 mb-2 mt-6">Your items</h2>
      {list.length === 0 ? <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-8 text-center text-sm text-stone-500">Nothing listed yet. Add your first item above.</div> : (
        <div className="card divide-y divide-stone-100 p-0">
          {list.map((p) => (
            <details key={p.id} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                <Photo id={p.photoId} alt={p.name} className="h-14 w-14 shrink-0 rounded-xl" sizes="56px" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-800">{p.name}</div>
                  <div className="text-xs text-stone-500">{p.category ? `${p.category} · ` : ""}{ugx(p.price)} · <span className={p.stock === 0 ? "font-semibold text-maroon-600" : p.stock <= 3 ? "font-semibold text-gold-700" : ""}>{p.stock === 0 ? "Sold out" : `${p.stock} in stock`}</span></div>
                </div>
                <span className={`pill shrink-0 ${p.active ? "bg-brand-50 text-brand-700" : "bg-stone-100 text-stone-500"}`}>{p.active ? "In shop" : "Hidden"}</span>
                <span className="shrink-0 text-xs font-semibold text-brand-700 group-open:hidden">Edit</span>
              </summary>
              <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-4">
                <form action={saveProduct} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <input type="hidden" name="id" value={p.id} />
                  <Field label="Name"><input name="name" defaultValue={p.name} className="input" required /></Field>
                  <Field label="Shop section"><select name="category" className="input" defaultValue={p.category ?? "Other"}>{PRODUCT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Price (UGX)"><input name="price" type="number" defaultValue={p.price} className="input" required /></Field>
                    <Field label="In stock"><input name="stock" type="number" defaultValue={p.stock} className="input" /></Field>
                  </div>
                  <div className="sm:col-span-2"><Field label="Description"><textarea name="description" defaultValue={p.description ?? ""} rows={2} className="input" /></Field></div>
                  <Field label="New photo (optional)"><FileInput name="photo" accept="image/*" /></Field>
                  <div className="flex items-end"><Submit className="btn-primary btn-sm w-full">Save changes</Submit></div>
                </form>
                <form action={toggleProduct} className="mt-3"><input type="hidden" name="id" value={p.id} /><Submit className="btn-ghost btn-sm">{p.active ? "Hide from shop" : "Put back in shop"}</Submit></form>
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
