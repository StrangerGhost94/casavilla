import Link from "next/link";
import { BellPlus, BellRing } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { cleanParams, type AlertKind } from "@/lib/saved";
import { createAlert } from "@/app/saved-actions";
import { Submit } from "./client";

/** "Alert me" on a results page: get told (app + phone) when new listings match this search. */
export async function AlertButton({ kind, params, next }: { kind: AlertKind; params: Record<string, string | undefined>; next: string }) {
  const u = await getUser();
  const p = cleanParams(kind, params);
  if (!u) return <Link href={`/login?next=${encodeURIComponent(next)}`} className="chip"><BellPlus className="h-3.5 w-3.5" /> Alert me</Link>;
  const have = await db.searchAlert.findFirst({ where: { userId: u.id, kind, params: { equals: p } }, select: { id: true } });
  if (have) return <Link href="/saved?tab=alerts" className="chip-active"><BellRing className="h-3.5 w-3.5" /> Alert on</Link>;
  return (
    <form action={createAlert}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="params" value={JSON.stringify(p)} />
      <Submit className="chip" pendingText="Saving…" doneText="Alert on"><BellPlus className="h-3.5 w-3.5" /> Alert me</Submit>
    </form>
  );
}
