import Link from "next/link";
import { redirect } from "next/navigation";
import { HardHat } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { sitesFor } from "@/lib/build-sites";
import { SITE_STATUS } from "@/lib/build";
import { Badge } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "My building project", robots: { index: false } };

/** The client's building projects; with just one, straight to it. */
export default async function MyBuilds() {
  const u = await requireUser();
  const sites = await sitesFor(u);
  if (sites.length === 1) redirect(`/build/my/${sites[0].id}`);
  return (
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <h1 className="text-2xl font-bold text-brand-950">My building projects</h1>
      {sites.length ? (
        <div className="card mt-4 divide-y divide-stone-100 p-0">
          {sites.map((s) => (
            <Link key={s.id} href={`/build/my/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><HardHat className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-brand-950">{s.title}</span><span className="block truncate text-xs text-stone-500">{s.location}</span></span>
              <Badge color={SITE_STATUS[s.status]?.tone}>{SITE_STATUS[s.status]?.label}</Badge>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><HardHat className="h-6 w-6" /></div>
          <div className="mt-3 font-semibold text-brand-950">No building project in your account yet</div>
          <p className="mt-1 text-sm text-stone-500">Once you agree a build with CasaVilla, it appears here — sign in with the phone number you gave us. Not starting yet?</p>
          <Link href="/build/start" className="btn-primary mt-4">Start a project</Link>
        </div>
      )}
    </main>
  );
}
