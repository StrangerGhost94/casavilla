import { BadgeCheck, ChevronRight, Clock, LogOut, MapPin, MessageCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { menus, roleName } from "@/lib/nav";
import { logout } from "@/app/actions";
import { PortalShell } from "@/components/PortalShell";
import { NavIcon } from "@/components/NavLinks";
import { Avatar, ListRow } from "@/components/ui";
import { Submit } from "@/components/client";
import { LocationPicker } from "@/components/LocationPicker";
import { setMyLocation } from "@/app/place-actions";
import { crumbText, trailFor } from "@/lib/geo";

export const metadata = { title: "Profile" };

export default async function Profile() {
  const u = await requireUser();
  const reviewed = u.role === "landlord" || u.role === "provider";
  const items = menus[u.role].slice(1);
  const myPlace = await trailFor(u.locationId);
  return (
    <PortalShell user={u}>
      <div className="mx-auto max-w-xl">
        <div className="card flex items-center gap-4">
          <Avatar name={u.name} className="h-16 w-16 text-xl ring-4 ring-gold-100" />
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold text-brand-950">{u.businessName || u.name}</div>
            {reviewed && u.status === "active" && <span className="pill mt-1 bg-brand-50 text-brand-700"><BadgeCheck className="h-3.5 w-3.5" /> Verified by CasaVilla</span>}
            {u.status === "pending" && <span className="pill mt-1 bg-gold-50 text-gold-700"><Clock className="h-3.5 w-3.5" /> Awaiting approval</span>}
            <div className="mt-1 text-xs text-stone-500">{roleName[u.role]} · {u.phone}</div>
            <div className="truncate text-xs text-stone-500">{u.email}</div>
          </div>
        </div>

        <div className="card mt-4 divide-y divide-stone-100 p-0">
          {u.role !== "manager" && (
            // Same row style as the menu below; the picker only opens when tapped.
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-stone-50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><MapPin className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-stone-800">{u.role === "provider" ? "Where your business is based" : "Where you live"}</span>
                  <span className="block truncate text-xs text-stone-500">{myPlace.length > 1 ? myPlace.filter((c) => !["country", "region"].includes(c.level)).reverse().slice(0, 3).map((c) => c.name).join(", ") || crumbText(myPlace, true) : "Not set — tap to choose"}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-90" />
              </summary>
              <form action={setMyLocation} className="space-y-2 border-t border-stone-100 px-4 pb-4 pt-3">
                <LocationPicker initial={myPlace} label="" hint="Used for nearby homes, services and reports. Pick as far down as you like." />
                <Submit className="btn-primary btn-sm">Save area</Submit>
              </form>
            </details>
          )}
          {items.map((i) => (
            <ListRow key={i.href} href={i.href} title={i.label}
              icon={<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><NavIcon name={i.icon} className="h-[18px] w-[18px]" /></span>} />
          ))}
          <ListRow href="https://wa.me/256776593482" title="Contact CasaVilla" detail="WhatsApp +256 776 593 482"
            icon={<span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-50 text-gold-600"><MessageCircle className="h-[18px] w-[18px]" /></span>} />
        </div>

        <form action={logout} className="mt-5">
          <button className="btn w-full border border-maroon-100 bg-white py-3 text-maroon-600 hover:bg-maroon-50">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </form>
      </div>
    </PortalShell>
  );
}
