import Link from "next/link";
import { MapPinned, X } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { crumbText, trailsFor } from "@/lib/geo";
import { PageHeader, Field, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { LocationPicker } from "@/components/LocationPicker";
import { addServiceArea, removeServiceArea } from "@/app/place-actions";
import { saveProfile } from "../actions";

export default async function ProviderProfile() {
  const u = await requireUser("provider");
  const areas = await db.providerArea.findMany({ where: { providerId: u.id }, include: { location: { select: { id: true, name: true, kind: true } } } });
  const trails = await trailsFor(areas.map((a) => a.locationId));
  return (
    <div className="max-w-2xl">
      <PageHeader title="Business profile" actions={u.status === "active" ? <Link href={`/services/${u.id}`} className="btn-outline">View public page</Link> : undefined} />
      <form action={saveProfile} className="card space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name"><input name="name" defaultValue={u.name} className="input" required /></Field>
          <Field label="Business name"><input name="businessName" defaultValue={u.businessName ?? ""} className="input" /></Field>
          <Field label="Phone"><input name="phone" defaultValue={u.phone} className="input" required /></Field>
          <Field label="Area description (shown publicly)"><input name="area" defaultValue={u.area ?? ""} className="input" placeholder="e.g. Rubaga, Mengo, Ndeeba" /></Field>
        </div>
        <Field label="About your business"><textarea name="bio" defaultValue={u.bio ?? ""} rows={4} className="input" placeholder="Experience, team size, guarantees…" /></Field>
        <Submit>Save profile</Submit>
      </form>

      <SectionTitle title="Areas you cover" />
      <div className="card space-y-4">
        <p className="text-sm text-stone-600">Landlords and CasaVilla see you first for jobs inside these areas. Covering a district covers every sub-county, parish and village in it.</p>
        {areas.length === 0 && <div className="rounded-xl bg-gold-50 p-3 text-sm text-gold-700">No areas yet — add at least one so you're matched to nearby jobs.</div>}
        <div className="space-y-2">
          {areas.map((a) => (
            <div key={a.locationId} className="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2">
              <MapPinned className="h-4 w-4 shrink-0 text-brand-700" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-stone-800">{a.location.name} <span className="font-normal text-stone-400">· {a.location.kind}</span></div>
                <div className="truncate text-[11px] text-stone-500">{crumbText(trails.get(a.locationId) ?? [], true)}</div>
              </div>
              <form action={removeServiceArea}><input type="hidden" name="locationId" value={a.locationId} /><button className="rounded-full p-1.5 text-stone-400 hover:bg-maroon-50 hover:text-maroon-600" aria-label={`Remove ${a.location.name}`}><X className="h-4 w-4" /></button></form>
            </div>
          ))}
        </div>
        <form action={addServiceArea} className="space-y-2 border-t border-stone-100 pt-4">
          <LocationPicker label="Add an area" hint="Pick a district for wide coverage, or go down to a sub-county or parish." />
          <Submit className="btn-primary btn-sm" doneText="Added">Add area</Submit>
        </form>
      </div>
    </div>
  );
}
