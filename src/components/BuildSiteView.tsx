import Link from "next/link";
import { CalendarDays, Check, CircleDashed, Hammer, MapPin, Receipt } from "lucide-react";
import { fmtDate, fmtDateTime, ugx } from "@/lib/format";
import { PAY_METHOD, SITE_STATUS, STAGE_STATUS } from "@/lib/build";
import { fileUrl } from "@/lib/file-url";
import type { SiteSummary } from "@/lib/build-sites";
import { Badge } from "./ui";

/** Dark band: the project, its status and how far along it is. */
export function SiteHeader({ sum, back }: { sum: SiteSummary; back?: React.ReactNode }) {
  const s = sum.site;
  return (
    <section className="bg-brand-950 text-white">
      <div className="mx-auto max-w-4xl px-4 pb-6 pt-4 md:pt-8">
        {back}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold-300">Building with CasaVilla</span>
          <Badge color={SITE_STATUS[s.status]?.tone}>{SITE_STATUS[s.status]?.label ?? s.status}</Badge>
        </div>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">{s.title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/70">
          <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {s.location}</span>
          {(s.startDate || s.targetDate) && <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> {s.startDate ? `Started ${fmtDate(s.startDate)}` : ""}{s.startDate && s.targetDate ? " · " : ""}{s.targetDate ? `Handover ${fmtDate(s.targetDate)}` : ""}</span>}
        </div>
        <div className="mt-4">
          <div className="flex items-end justify-between text-sm"><span className="font-semibold">{sum.progress}% complete</span><span className="text-white/60">{sum.done} of {sum.stages.length} stages done</span></div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gold-400" style={{ width: `${sum.progress}%` }} /></div>
        </div>
      </div>
    </section>
  );
}

export function MoneyCards({ sum }: { sum: SiteSummary }) {
  const cards: [string, string, string?][] = [
    ["Contract sum", ugx(sum.site.contractSum)],
    ["Paid so far", ugx(sum.paid), sum.site.contractSum ? `${Math.round((sum.paid / sum.site.contractSum) * 100)}%` : undefined],
    ["Balance", ugx(sum.balance)],
    ["Due now", ugx(sum.due), sum.due ? "for stages under way" : "nothing due"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(([k, v, h]) => (
        <div key={k} className={`card py-3 ${k === "Due now" && sum.due ? "border-gold-200 bg-gold-50/60" : ""}`}>
          <div className="text-xs text-stone-500">{k}</div>
          <div className="whitespace-nowrap text-[15px] font-bold text-brand-950 md:text-lg">{v}</div>
          {h && <div className="text-[11px] text-stone-500">{h}</div>}
        </div>
      ))}
    </div>
  );
}

const StageIcon = ({ status }: { status: string }) =>
  status === "done" ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white"><Check className="h-4 w-4" /></span>
    : status === "in_progress" ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400 text-brand-950"><Hammer className="h-4 w-4" /></span>
    : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-400"><CircleDashed className="h-4 w-4" /></span>;

/** The stages in order: what each costs, what's paid, and (for staff) the controls passed in. */
export function StageList({ sum, controls }: { sum: SiteSummary; controls?: (stage: SiteSummary["stages"][number]) => React.ReactNode }) {
  if (!sum.stages.length) return <p className="card text-sm text-stone-500">The stages of the build will appear here.</p>;
  return (
    <ol className="card divide-y divide-stone-100 p-0">
      {sum.stages.map((st) => (
        <li key={st.id} className="flex gap-3 px-4 py-3">
          <StageIcon status={st.status} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold text-brand-950">{st.name}</div>
              <Badge color={STAGE_STATUS[st.status]?.tone}>{STAGE_STATUS[st.status]?.label}</Badge>
            </div>
            <div className="mt-0.5 text-sm text-stone-600">
              {ugx(st.amount)} · {st.balance === 0 && st.amount > 0 ? <span className="font-semibold text-brand-700">paid in full</span> : st.paid > 0 ? <>paid {ugx(st.paid)}, <b>{ugx(st.balance)} left</b></> : "not paid yet"}
            </div>
            {(st.startedAt || st.doneAt) && <div className="text-[11px] text-stone-400">{st.startedAt && `Started ${fmtDate(st.startedAt)}`}{st.doneAt && ` · finished ${fmtDate(st.doneAt)}`}</div>}
            {controls?.(st)}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Progress notes from the site with their photos, newest first. */
export function UpdateFeed({ sum, extra }: { sum: SiteSummary; extra?: (u: SiteSummary["site"]["updates"][number]) => React.ReactNode }) {
  if (!sum.site.updates.length) return <p className="card text-sm text-stone-500">Progress updates and photos from the site will appear here.</p>;
  return (
    <div className="space-y-3">
      {sum.site.updates.map((u) => (
        <article key={u.id} id={`update-${u.id}`} className="card scroll-mt-24">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <span>{fmtDateTime(u.createdAt)}{u.author ? ` · ${u.author.name}` : ""}</span>
            {u.stage && <span className="pill bg-brand-50 text-brand-800">{u.stage.name}</span>}
          </div>
          <p className="mt-2 whitespace-pre-line break-words text-sm text-stone-800">{u.note}</p>
          {u.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {u.photos.map((p, i) => (
                <a key={p.id} href={fileUrl(p.fileId, 1600)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-stone-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.fileId, 320)} alt={`Site photo ${i + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
          {extra?.(u)}
        </article>
      ))}
    </div>
  );
}

export function PaymentList({ sum }: { sum: SiteSummary }) {
  const rows = sum.site.payments.filter((p) => p.status !== "failed");
  if (!rows.length) return <p className="card text-sm text-stone-500">No payments yet.</p>;
  const stageName = (id: number | null) => sum.stages.find((s) => s.id === id)?.name;
  return (
    <div className="card divide-y divide-stone-100 p-0">
      {rows.map((p) => (
        <div key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-brand-950">{ugx(p.amount)} <span className="font-normal text-stone-500">· {PAY_METHOD[p.method] ?? p.method}</span></div>
            <div className="truncate text-xs text-stone-500">{stageName(p.stageId) ?? "General"} · {fmtDate(p.paidAt ?? p.createdAt)}{p.receiptNo ? ` · ${p.receiptNo}` : ""}</div>
          </div>
          {p.status === "success"
            ? <Link href={`/build/receipt/${p.id}`} className="btn-outline btn-sm"><Receipt className="h-3.5 w-3.5" /> Receipt</Link>
            : <Badge color="gold">Waiting</Badge>}
        </div>
      ))}
    </div>
  );
}
