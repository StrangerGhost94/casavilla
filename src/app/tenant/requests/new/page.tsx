import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Field, Empty } from "@/components/ui";
import { Submit } from "@/components/client";
import { createRequest } from "../../actions";
import { activeLease } from "../../lib";

export default async function NewRequest() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  if (!lease) return <Empty title="No active lease">You can still <Link href="/services" className="link">book a provider directly</Link>.</Empty>;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Report a repair" subtitle={`${lease.property} · ${lease.unit}`} />
      <form action={createRequest} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type of problem">
            <select name="category" className="input" required>{SERVICE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="How urgent?">
            <select name="priority" className="input" defaultValue="normal">
              <option value="low">Low — when convenient</option>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent — safety / no water / no power</option>
            </select>
          </Field>
        </div>
        <Field label="Short title"><input name="title" className="input" placeholder="e.g. Kitchen sink is leaking" required /></Field>
        <Field label="Describe the problem"><textarea name="description" rows={4} className="input" required placeholder="What's wrong, where, since when…" /></Field>
        <Field label="Photo (optional)" hint="JPG or PNG, up to 5 MB"><input type="file" name="photo" accept="image/*" className="input py-1.5" /></Field>
        <Submit className="btn-maroon">Send request</Submit>
      </form>
    </div>
  );
}
