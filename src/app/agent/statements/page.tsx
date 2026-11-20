import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/format";
import { fullUgx } from "@/lib/sales";
import { StatementPage } from "@/components/Statements";
import { lastMonths } from "@/lib/statements";
import { SectionTitle } from "@/components/ui";

export const metadata = { title: "Statements" };

/** Short-stay income less CasaVilla's commission (paid out by CasaVilla's finance department), and commission due on sales. */
export default async function AgentStatements({ searchParams }: { searchParams: Promise<{ month?: string; property?: string }> }) {
  const u = await requireUser("agent");
  const q = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : lastMonths(1)[0];
  const sold = await db.saleListing.findMany({ where: { ownerId: u.id, status: "sold", soldPrice: { not: null } }, orderBy: { soldAt: "desc" }, take: 50 });
  return (
    <>
      <StatementPage viewer={u} landlordId={u.id} month={month} propertyId={Number(q.property) || undefined} base="/agent/statements" />
      <div className="mx-auto mt-6 max-w-4xl">
        <SectionTitle title="Sales and CasaVilla's commission" />
        <div className="card divide-y divide-stone-100 p-0 text-sm">
          {sold.length === 0 && <div className="muted p-4">No sales recorded yet. When one of your listings sells, the office records the price here.</div>}
          {sold.map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0"><span className="block truncate font-medium">{l.title}</span><span className="block text-xs text-stone-500">Sold {l.soldAt ? fmtDate(l.soldAt) : ""} for {fullUgx(l.soldPrice ?? 0)}</span></span>
              <b className="shrink-0">{fullUgx(l.saleCommission ?? 0)}</b>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">CasaVilla&apos;s commission on sales: {u.salesCommissionPct}% of the sale price. On short stays: {u.commissionPct}% of what guests pay.</p>
      </div>
    </>
  );
}
