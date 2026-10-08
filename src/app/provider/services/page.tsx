import { db, SERVICE_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { ugx } from "@/lib/format";
import { PageHeader, Field, Badge } from "@/components/ui";
import { Submit } from "@/components/client";
import { saveService, toggleService } from "../actions";

export default async function ProviderServices() {
  const u = await requireUser("provider");
  const list = await db.service.findMany({ where: { providerId: u.id }, orderBy: { category: "asc" } });
  return (
    <>
      <PageHeader title="My services" subtitle="These appear in the CasaVilla directory and decide which repair jobs you're matched to." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {list.length === 0 && <div className="muted">No services yet.</div>}
          {list.map((s) => (
            <details key={s.id} className="card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{s.title}</div>
                  <div className="text-sm text-stone-500">{s.category}{s.priceFrom != null && ` · from ${ugx(s.priceFrom)}`}</div>
                </div>
                <Badge color={s.active ? "green" : "gray"}>{s.active ? "active" : "hidden"}</Badge>
              </summary>
              <form action={saveService} className="mt-4 space-y-3 border-t border-stone-100 pt-4">
                <input type="hidden" name="id" value={s.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <select name="category" defaultValue={s.category} className="input">{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                  <input name="priceFrom" type="number" defaultValue={s.priceFrom ?? ""} className="input" placeholder="Price from (UGX)" />
                </div>
                <input name="title" defaultValue={s.title} className="input" required />
                <textarea name="description" defaultValue={s.description ?? ""} rows={2} className="input" />
                <input type="hidden" name="active" value={s.active ? "on" : "off"} />
                <Submit className="btn-primary btn-sm">Save</Submit>
              </form>
              <form action={toggleService} className="mt-2"><input type="hidden" name="id" value={s.id} /><Submit className="btn-outline btn-sm">{s.active ? "Hide from directory" : "Show in directory"}</Submit></form>
            </details>
          ))}
        </div>
        <form id="add" action={saveService} className="card h-fit scroll-mt-24 space-y-3">
          <div className="h2">Add a service</div>
          <Field label="Category"><select name="category" className="input">{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Title"><input name="title" className="input" required placeholder="e.g. Deep house cleaning" /></Field>
          <Field label="Description"><textarea name="description" rows={3} className="input" /></Field>
          <Field label="Price from (UGX)"><input name="priceFrom" type="number" className="input" /></Field>
          <Submit>Add service</Submit>
        </form>
      </div>
    </>
  );
}
