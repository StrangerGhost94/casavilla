import Link from "next/link";
import { SERVICE_CATEGORIES } from "@/db";
import { requireUser } from "@/lib/auth";
import { CategoryIcon } from "@/lib/icons";
import { Empty } from "@/components/ui";
import { PhotoPicker, Submit } from "@/components/client";
import { createRequest } from "../../actions";
import { activeLease } from "../../lib";

export default async function NewRequest() {
  const u = await requireUser("tenant");
  const lease = await activeLease(u.id);
  if (!lease) return <Empty title="No active lease">You can still <Link href="/services" className="link">book a provider directly</Link>.</Empty>;
  return (
    <form action={createRequest} className="mx-auto max-w-2xl space-y-6">
      <p className="hidden text-sm text-stone-500 lg:block">{lease.property} · Unit {lease.unit}</p>
      <section>
        <h2 className="h2 mb-3">What&apos;s the issue?</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {SERVICE_CATEGORIES.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="category" value={c} defaultChecked={i === 1} className="peer sr-only" required />
              <span className="flex h-full flex-col items-center gap-1.5 rounded-2xl border border-stone-200 bg-white px-1 py-3 text-center text-[11px] font-medium text-stone-600 transition peer-checked:border-brand-800 peer-checked:bg-brand-800 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100">
                <CategoryIcon category={c} className="h-5 w-5" />
                {c}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="h2 mb-3">How urgent?</h2>
        <div className="grid grid-cols-3 gap-2">
          {[["low", "When convenient"], ["normal", "Normal"], ["urgent", "Urgent"]].map(([v, l]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="priority" value={v} defaultChecked={v === "normal"} className="peer sr-only" />
              <span className={`block rounded-xl border border-stone-200 bg-white py-2.5 text-center text-xs font-semibold text-stone-600 transition ${v === "urgent" ? "peer-checked:border-maroon-500 peer-checked:bg-maroon-50 peer-checked:text-maroon-600" : "peer-checked:border-brand-700 peer-checked:bg-brand-50 peer-checked:text-brand-800"}`}>{l}</span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-stone-500">Urgent = safety risk, no water or no power.</p>
      </section>

      <section>
        <h2 className="h2 mb-3">Add a photo</h2>
        <PhotoPicker name="photo" />
      </section>

      <section className="space-y-3">
        <h2 className="h2">Description</h2>
        <input name="title" className="input" placeholder="Short title, e.g. Kitchen tap is leaking" required />
        <textarea name="description" rows={4} className="input" required placeholder="Describe the issue in detail — what, where, since when…" />
      </section>

      <Submit className="btn-primary btn-lg w-full" pendingText="Sending…">Submit request</Submit>
    </form>
  );
}
