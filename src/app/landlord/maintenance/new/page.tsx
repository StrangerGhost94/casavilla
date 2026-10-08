import { db, SERVICE_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Field, Empty } from "@/components/ui";
import { Submit } from "@/components/client";
import { landlordJob } from "../../actions";

export default async function NewJob() {
  const u = await requireUser("landlord");
  const props = await db.property.findMany({ where: { landlordId: u.id }, orderBy: { name: "asc" } });
  if (!props.length) return <Empty title="Add a property first" />;
  return (
    <div className="max-w-2xl">
      <PageHeader title="New maintenance job" />
      <form action={landlordJob} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Property"><select name="propertyId" className="input">{props.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
          <Field label="Category"><select name="category" className="input">{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Priority"><select name="priority" className="input" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="urgent">Urgent</option></select></Field>
        </div>
        <Field label="Title"><input name="title" className="input" required placeholder="e.g. Repaint block B corridors" /></Field>
        <Field label="Details"><textarea name="description" rows={4} className="input" required /></Field>
        <Field label="Photo (optional)"><input type="file" name="photo" accept="image/*" className="input py-1.5" /></Field>
        <Submit>Create job</Submit>
      </form>
    </div>
  );
}
