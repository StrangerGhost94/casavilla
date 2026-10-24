import Link from "next/link";
import { Check, ClipboardList, Search, X } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { PageHeader, Photo } from "@/components/ui";
import { ConfirmSubmit } from "@/components/client";
import { homeTitle } from "@/components/PropertyCard";
import { withdrawApplication } from "../actions";

const said: Record<string, { label: string; tone: string; text: string }> = {
  pending: { label: "Awaiting reply", tone: "bg-gold-50 text-gold-700", text: "The landlord has your application. You'll get a notification when they answer." },
  approved: { label: "Approved", tone: "bg-brand-50 text-brand-700", text: "Congratulations! Your lease, rent and receipts are now under My home." },
  rejected: { label: "Not this time", tone: "bg-maroon-50 text-maroon-600", text: "The landlord chose someone else. Keep looking, there are new homes every week." },
  withdrawn: { label: "Withdrawn", tone: "bg-stone-100 text-stone-600", text: "You withdrew this application." },
};

export default async function TenantApplications() {
  const u = await requireUser("tenant");
  const rows = await db.application.findMany({
    where: { tenantId: u.id }, orderBy: { createdAt: "desc" },
    include: { unit: { include: { property: { include: { landlord: { select: { name: true } } } } } } },
  });
  const open = rows.filter((a) => a.status === "pending").length;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My applications" subtitle={rows.length ? `${open} waiting for an answer · ${rows.length} in total` : undefined}
        actions={<Link href="/listings" className="btn-primary btn-sm"><Search className="h-4 w-4" /> Find a home</Link>} />
      {rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-stone-300 bg-white/70 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700"><ClipboardList className="h-6 w-6" /></div>
          <div className="mt-3 font-semibold text-brand-950">No applications yet</div>
          <p className="mt-1 text-sm text-stone-500">Find a home you like and tap Apply. It takes a minute.</p>
          <Link href="/listings" className="btn-primary btn-sm mt-4">Browse homes</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((a) => {
            const s = said[a.status] ?? said.pending;
            const p = a.unit.property;
            const steps = [["Sent", true], ["Being reviewed", a.status !== "withdrawn"], [a.status === "rejected" ? "Declined" : "Decision", a.status === "approved" || a.status === "rejected"]] as const;
            return (
              <div key={a.id} className="card overflow-hidden p-0">
                <Link href={a.unit.mode === "short" ? `/stays/${a.unit.id}` : `/listings/${a.unit.id}`} className="flex items-center gap-3 p-4 hover:bg-stone-50">
                  <Photo id={p.photoId} alt={p.name} className="h-16 w-20 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-brand-950">{homeTitle(a.unit.bedrooms, p.type)} · {p.name}</div>
                    <div className="truncate text-xs text-stone-500">Unit {a.unit.label} · {p.location}</div>
                    <div className="mt-0.5 text-sm font-semibold text-stone-800">{ugx(a.unit.rent)} <span className="text-xs font-normal text-stone-500">/ month</span></div>
                  </div>
                </Link>
                <div className="border-t border-stone-100 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`pill shrink-0 whitespace-nowrap ${s.tone}`}>{a.status === "approved" ? <Check className="h-3.5 w-3.5" /> : a.status === "rejected" ? <X className="h-3.5 w-3.5" /> : null}{s.label}</span>
                    <span className="text-[11px] text-stone-400">Applied {fmtDate(a.createdAt)} · {p.landlord.name}</span>
                  </div>
                  {a.status !== "withdrawn" && (
                    <ol className="mt-3 flex items-center gap-1.5">
                      {steps.map(([label, done], i) => (
                        <li key={label} className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span className={`h-1.5 flex-1 rounded-full ${done ? (a.status === "rejected" && i === 2 ? "bg-maroon-400" : "bg-brand-600") : "bg-stone-200"}`} />
                          <span className={`shrink-0 text-[10px] ${done ? "font-semibold text-stone-700" : "text-stone-400"}`}>{label}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                  <p className="mt-2 text-xs text-stone-500">{s.text}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs">
                    {a.status === "approved" && <Link href="/tenant" className="font-semibold text-brand-700 hover:underline">Go to My home →</Link>}
                    {a.status === "rejected" && <Link href={`/listings?max=${Math.round(a.unit.rent * 1.2)}`} className="font-semibold text-brand-700 hover:underline">See similar homes →</Link>}
                    {a.status === "pending" && (
                      <form action={withdrawApplication}><input type="hidden" name="id" value={a.id} /><ConfirmSubmit message="Withdraw this application?" className="font-semibold text-maroon-600 hover:underline">Withdraw</ConfirmSubmit></form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
