import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, fmtDateTime, kampalaToday, ugx } from "@/lib/format";
import { cashDays, cashFor } from "@/lib/controls";
import { PageHeader, SectionTitle } from "@/components/ui";
import { Submit } from "@/components/client";
import { Checklist } from "@/components/Checklist";
import { Signature } from "@/components/Signature";
import { closeCashDay } from "@/app/control-actions";

export const metadata = { title: "Daily cash close" };

/** Each day's cash and bank receipts, by who recorded them; a super admin counts and signs the day off. */
export default async function CashClose({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const me = await requireUser("manager");
  const days = await cashDays();
  const today = kampalaToday();
  const asked = (await searchParams).day;
  const day = asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : days.filter((d) => !d.closed && d.day < today).at(-1)?.day ?? days[0]?.day ?? today;
  const [pays, close] = await Promise.all([
    cashFor(day),
    db.cashClose.findUnique({ where: { day: new Date(`${day}T00:00:00Z`) }, include: { closedBy: { select: { name: true } } } }),
  ]);
  const mine = me.superAdmin ? pays : pays.filter((p) => p.recordedById === me.id);
  const groups = new Map<string, { name: string; count: number; total: number }>();
  for (const p of mine) {
    const g = groups.get(String(p.recordedById)) ?? { name: p.recordedBy?.name ?? "Not recorded", count: 0, total: 0 };
    g.count++; g.total += p.amount; groups.set(String(p.recordedById), g);
  }
  const total = mine.reduce((n, p) => n + p.amount, 0);
  const cash = mine.filter((p) => p.method === "cash").reduce((n, p) => n + p.amount, 0);
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title="Daily cash close" subtitle={me.superAdmin ? "Count each day's cash and check bank slips, then sign the day off." : "The cash and bank payments you recorded each day."} />

      <div className="flex flex-wrap gap-1.5">
        {days.slice(0, 14).map((d) => (
          <Link key={d.day} href={`?day=${d.day}`} className={`rounded-full border px-3 py-1 text-xs ${d.day === day ? "border-brand-500 bg-brand-50 text-brand-700" : "border-stone-200 bg-white"}`}>
            {fmtDate(d.day)} {d.closed ? "✓" : d.day < today ? "•" : ""}
          </Link>
        ))}
        {days.length === 0 && <span className="text-sm text-stone-500">No cash or bank payments recorded yet.</span>}
      </div>

      {/* On phones the total runs full width first, so amounts never wrap mid-number. */}
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="card"><div className="text-xs text-stone-500">Cash</div><div className="whitespace-nowrap text-base font-bold sm:text-lg">{ugx(cash)}</div></div>
        <div className="card"><div className="text-xs text-stone-500">Bank</div><div className="whitespace-nowrap text-base font-bold sm:text-lg">{ugx(total - cash)}</div></div>
        <div className="card order-first col-span-2 sm:order-none sm:col-span-1"><div className="text-xs text-stone-500">Total · {mine.length} payment{mine.length === 1 ? "" : "s"}</div><div className="whitespace-nowrap text-base font-bold sm:text-lg">{ugx(total)}</div></div>
      </div>

      {[...groups.values()].length > 0 && (
        <section>
          <SectionTitle title={`${fmtDate(day)} by who recorded it`} />
          <div className="card divide-y divide-stone-100 p-0 text-sm">
            {[...groups.values()].map((g) => <div key={g.name} className="flex justify-between px-4 py-2.5"><span>{g.name} · {g.count}</span><b>{ugx(g.total)}</b></div>)}
          </div>
        </section>
      )}

      <section>
        <SectionTitle title="Payments" />
        <div className="card divide-y divide-stone-100 p-0 text-sm">
          {mine.length === 0 && <div className="muted p-4">None on this day.</div>}
          {mine.map((p) => (
            <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-stone-50">
              <span>{p.tenant.name}<span className="block text-xs text-stone-500">{p.receiptNo} · {p.method} · {p.recordedBy?.name ?? "—"} · {fmtDateTime(p.paidAt)}</span></span>
              <b className="shrink-0 whitespace-nowrap">{ugx(p.amount)}</b>
            </Link>
          ))}
        </div>
      </section>

      {close ? (
        <div className="card flex items-start gap-3 border-brand-100 bg-brand-50/60 text-sm">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-brand-700" />
          <div>
            <div className="font-semibold text-brand-950">Closed by {close.closedBy.name}, {fmtDateTime(close.createdAt)}</div>
            <div className="text-xs text-stone-600">{close.count} payment(s), {ugx(close.total)}{close.note ? ` · ${close.note}` : ""}</div>
            {me.superAdmin && (pays.length !== close.count || total !== close.total) && <div className="mt-1 text-xs font-semibold text-maroon-600">Changed since it was closed: now {pays.length} payment(s), {ugx(total)}. Check the Activity page.</div>}
          </div>
        </div>
      ) : me.superAdmin && pays.length > 0 && (
        <form action={closeCashDay} className="card space-y-2.5 text-sm">
          <input type="hidden" name="day" value={day} />
          <div className="font-semibold text-brand-950">Close {fmtDate(day)}: {ugx(total)}</div>
          <Checklist name="cash" title="Before you close the day" />
          <Signature reasonHint="Note, e.g. banked at Stanbic, slip 0045" />
          <Submit className="btn-primary btn-sm">Close the day</Submit>
        </form>
      )}
    </div>
  );
}
