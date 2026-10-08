import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader, Field } from "@/components/ui";
import { Submit } from "@/components/client";
import { saveProfile } from "../actions";

export default async function ProviderProfile() {
  const u = await requireUser("provider");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Business profile" actions={u.status === "active" ? <Link href={`/services/${u.id}`} className="btn-outline">View public page</Link> : undefined} />
      <form action={saveProfile} className="card space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name"><input name="name" defaultValue={u.name} className="input" required /></Field>
          <Field label="Business name"><input name="businessName" defaultValue={u.businessName ?? ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={u.phone} className="input" required /></Field>
          <Field label="Area served"><input name="area" defaultValue={u.area ?? ""} className="input" /></Field>
        </div>
        <Field label="About your business"><textarea name="bio" defaultValue={u.bio ?? ""} rows={4} className="input" placeholder="Experience, team size, guarantees…" /></Field>
        <Submit>Save profile</Submit>
      </form>
    </div>
  );
}
