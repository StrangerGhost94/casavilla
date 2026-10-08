import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { PageHeader, Field, Badge, Photo } from "@/components/ui";
import { Submit, FileInput } from "@/components/client";
import { saveProduct, toggleProduct } from "../actions";

export default async function ProviderProducts() {
  const u = await requireUser("provider");
  const list = await db.product.findMany({ where: { providerId: u.id }, orderBy: { id: "desc" } });
  return (
    <>
      <PageHeader title="Items for sale" subtitle="Sell materials and supplies — paint, fittings, cleaning products, pest treatments…" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {list.length === 0 && <div className="muted">Nothing listed yet.</div>}
          {list.map((p) => (
            <div key={p.id} className="card h-fit overflow-hidden p-0">
              <Photo id={p.photoId} alt={p.name} className="h-32 w-full" />
              <div className="space-y-2 p-4">
                <div className="flex items-center justify-between"><div className="font-semibold">{p.name}</div><Badge color={p.active ? "green" : "gray"}>{p.active ? "listed" : "hidden"}</Badge></div>
                <div className="text-sm">{ugx(p.price)} · {p.stock} in stock</div>
                <details>
                  <summary className="btn-outline btn-sm cursor-pointer list-none">Edit</summary>
                  <form action={saveProduct} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" defaultValue={p.name} className="input" required />
                    <div className="grid grid-cols-2 gap-2">
                      <input name="price" type="number" defaultValue={p.price} className="input" required />
                      <input name="stock" type="number" defaultValue={p.stock} className="input" />
                    </div>
                    <textarea name="description" defaultValue={p.description ?? ""} rows={2} className="input" />
                    <FileInput name="photo" accept="image/*" />
                    <Submit className="btn-primary btn-sm">Save</Submit>
                  </form>
                </details>
                <form action={toggleProduct}><input type="hidden" name="id" value={p.id} /><Submit className="btn-outline btn-sm">{p.active ? "Hide from shop" : "List in shop"}</Submit></form>
              </div>
            </div>
          ))}
        </div>
        <form action={saveProduct} className="card h-fit space-y-3">
          <div className="h2">Add an item</div>
          <Field label="Name"><input name="name" className="input" required /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price (UGX)"><input name="price" type="number" className="input" required /></Field>
            <Field label="Stock"><input name="stock" type="number" className="input" defaultValue={1} /></Field>
          </div>
          <Field label="Description"><textarea name="description" rows={2} className="input" /></Field>
          <Field label="Photo"><FileInput name="photo" accept="image/*" /></Field>
          <Submit>Add item</Submit>
        </form>
      </div>
    </>
  );
}
