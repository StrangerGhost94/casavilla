import { CHECKLISTS, type ChecklistName } from "@/lib/checklist";

/** The tick boxes for one checklist (see lib/checklist). Every box is required. */
export function Checklist({ name, title = "Before you approve" }: { name: ChecklistName; title?: string }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</legend>
      {CHECKLISTS[name].map(([k, t]) => (
        <label key={k} className="flex items-start gap-2 text-sm text-stone-700"><input type="checkbox" name={`check_${k}`} required className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700" /> {t}</label>
      ))}
    </fieldset>
  );
}
