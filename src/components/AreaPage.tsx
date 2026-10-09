import Link from "next/link";
import { db } from "@/db";
import { trailFor } from "@/lib/geo";
import { PageHeader } from "./ui";
import { LocationPicker } from "./LocationPicker";
import { AREA_LEVELS, AreaReport, type AreaLevel } from "./AreaReport";

export async function AreaPage({ landlordId, base, sp }: { landlordId?: number; base: string; sp: { by?: string; in?: string } }) {
  const by: AreaLevel = (AREA_LEVELS.find((l) => l.id === sp.by)?.id ?? "district");
  const scope = await trailFor(sp.in);
  const ds = await db.locationDataset.findFirst();
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ by, in: sp.in, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `${base}?${p}`;
  };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Portfolio by area" subtitle="Properties, occupancy, rent roll, arrears and repairs, grouped by Uganda's official areas." />
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {AREA_LEVELS.map((l) => <Link key={l.id} href={q({ by: l.id })} className={by === l.id ? "chip-active" : "chip"}>{l.label}</Link>)}
      </div>
      <form className="mb-4">
        <input type="hidden" name="by" value={by} />
        <details className="rounded-2xl border border-stone-200 bg-white p-3" open={scope.length > 1}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-brand-900">Narrow to one area</summary>
          <div className="mt-3"><LocationPicker name="in" initial={scope} label="" compact /></div>
          <div className="mt-3 flex gap-2"><button className="btn-primary btn-sm flex-1">Apply</button>{sp.in && <Link href={q({ in: undefined })} className="btn-outline btn-sm">Whole country</Link>}</div>
        </details>
      </form>
      <AreaReport landlordId={landlordId} by={by} inId={scope.length ? sp.in : null} base={base} />
      {ds && <p className="mt-4 text-[11px] text-stone-400">Areas: {ds.source}. Version {ds.version}, loaded {ds.importedAt.toISOString().slice(0, 10)}.</p>}
    </div>
  );
}
