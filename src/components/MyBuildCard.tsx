import Link from "next/link";
import { ChevronRight, HardHat } from "lucide-react";
import { db, type User } from "@/db";
import { siteSummary } from "@/lib/build-sites";
import { ugx } from "@/lib/format";

/** "Your building project": progress and what's due, for anyone with a build under way (shown on their home screens). */
export async function MyBuildCard({ u, className = "" }: { u: User; className?: string }) {
  const site = await db.buildSite.findFirst({
    where: { status: { in: ["active", "on_hold"] }, OR: [{ clientId: u.id }, ...(u.phoneVerifiedAt ? [{ clientId: null, clientPhone: u.phone }] : [])] },
    orderBy: { createdAt: "desc" }, select: { id: true },
  });
  if (!site) return null;
  const sum = await siteSummary(site.id);
  if (!sum) return null;
  return (
    <Link href={sum.site.clientId === u.id ? `/build/my/${site.id}` : "/build/my"} className={`group flex items-center gap-4 rounded-3xl bg-brand-900 p-4 text-white ${className}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><HardHat className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-300">Your building project</span>
        <span className="block truncate font-semibold">{sum.site.title}</span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-gold-400" style={{ width: `${sum.progress}%` }} /></span>
        <span className="mt-1 block text-xs text-white/70">{sum.progress}% complete{sum.due ? ` · ${ugx(sum.due)} due` : ""}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-white/60 group-hover:text-white" />
    </Link>
  );
}
