import Link from "next/link";
import { AlertTriangle, Banknote, Building2, CalendarRange, ChevronRight, CircleDollarSign, HardHat, MessageCircle, PieChart, Receipt, Wallet } from "lucide-react";
import { CollectedCard, DashHeader, MiniStat } from "@/components/Dashboard";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { ensureChargesFor } from "@/lib/billing";
import { fmtDate, ugx } from "@/lib/format";
import { chargeLabel } from "@/lib/rules";
import { Avatar, KeyRow, SectionTitle } from "@/components/ui";
import { portfolioStats, TenantsTable } from "@/components/Portfolio";
import { PushToggle } from "@/components/PushToggle";
import { pushPublicKey } from "@/lib/push";
import { MyBuildCard } from "@/components/MyBuildCard";
import { waLink } from "@/lib/social";

/**
 * A landlord's view: money coming in, and who has and hasn't paid. CasaVilla's office does all the work
 * (tenants, repairs, viewings, listings), so there is nothing here to act on — only to read.
 */
export default async function LandlordHome() {
  const u = await requireUser("landlord");
  await ensureChargesFor("landlord", u.id);
  const s = await portfolioStats(u.id);
  const [vacant, rentRoll, recent] = await Promise.all([
    db.unit.count({ where: { status: "vacant", property: { landlordId: u.id, archivedAt: null } } }),
    db.lease.aggregate({ _sum: { rent: true }, where: { landlordId: u.id, status: "active" } }),
    db.payment.findMany({
      where: { status: "success", lease: { landlordId: u.id } }, orderBy: { paidAt: "desc" }, take: 6,
      include: { tenant: { select: { name: true } }, charge: { select: { kind: true, period: true } } },
    }),
  ]);
  const occ = s.units ? Math.round((s.occupied / s.units) * 100) : 0;
  return (
    <div className="mx-auto max-w-5xl">
      <DashHeader title="My portfolio">
        <Link href="/landlord/statements" className="btn-primary btn-sm"><Receipt className="h-4 w-4" /> Statements</Link>
        <Link href="/landlord/payouts" className="btn-outline btn-sm"><Banknote className="h-4 w-4" /> Payouts</Link>
        <a href={waLink(`Hello CasaVilla, this is ${u.name}.`)} className="btn-outline btn-sm"><MessageCircle className="h-4 w-4" /> Talk to CasaVilla</a>
      </DashHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CollectedCard href="/landlord/tenants" collected={s.collected} due={s.due_month} left={s.left_month} />
        <MiniStat href="/landlord/tenants?show=overdue" tone={s.arrears ? "red" : "green"} icon={<AlertTriangle className="h-[18px] w-[18px]" />} value={ugx(s.arrears)} label={`Overdue · ${s.lateTenants} tenant${s.lateTenants === 1 ? "" : "s"}`}
          hint={s.pastArrears > 0 ? `+ ${ugx(s.pastArrears)} from former tenants` : undefined} />
        <MiniStat href="/landlord/properties" icon={<Building2 className="h-[18px] w-[18px]" />} value={`${occ}% let`} label={`${s.occupied} of ${s.units} units · ${vacant} vacant`} hint={`Rent roll ${ugx(rentRoll._sum.rent ?? 0)} / month`} />
      </div>

      <div className="mt-3 empty:hidden"><PushToggle publicKey={pushPublicKey()} variant="card" text="Know the moment rent comes in and when your payout is sent, straight on this phone." /></div>

      <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-2">
        <div>
          <SectionTitle title="Money in" href="/landlord/statements" cta="Statements" />
          <div className="card divide-y divide-stone-100 p-0">
            {recent.length === 0 && <div className="muted p-4">No payments yet.</div>}
            {recent.map((p) => (
              <Link key={p.id} href={`/receipts/${p.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-stone-50">
                <Avatar name={p.tenant.name} className="h-9 w-9 text-xs" />
                <div className="min-w-0 flex-1"><div className="truncate font-medium text-stone-800">{p.tenant.name}</div><div className="truncate text-xs text-stone-500">{chargeLabel(p.charge.kind, p.charge.period)} · {fmtDate(p.paidAt)} · <span className="uppercase">{p.method}</span></div></div>
                <div className="font-semibold text-brand-700">{ugx(p.amount)}</div>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <SectionTitle title="This month" href="/landlord/reports" cta="Reports" />
          <div className="card divide-y divide-stone-100 p-0">
            <KeyRow icon={<CalendarRange className="h-4 w-4" />} label="Due this month" value={ugx(s.due_month)} />
            <KeyRow icon={<Wallet className="h-4 w-4" />} label="Collected" value={ugx(s.collected)} />
            <KeyRow icon={<CircleDollarSign className="h-4 w-4" />} label="Still to collect" value={ugx(Math.max(0, s.left_month))} />
            <KeyRow icon={<PieChart className="h-4 w-4" />} label="Occupancy" value={`${occ}%`} strong />
          </div>
          <p className="mt-3 text-xs text-stone-500">CasaVilla collects the rent, follows up late payers, handles repairs and finds new tenants. Questions? Talk to the CasaVilla office.</p>
        </div>
      </div>

      <SectionTitle title="Tenants who haven't paid" href="/landlord/tenants?show=owing" />
      <TenantsTable where={{ landlordId: u.id, status: "active" }} only="owing" base="/landlord/tenants" />

      <MyBuildCard u={u} className="mt-6" />
      {/* CasaVilla's design & build: more units for a landlord who already rents through us */}
      <Link href="/build/start?kind=apartments" className="group mt-6 flex items-center gap-4 rounded-3xl bg-brand-900 p-4 text-white md:p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gold-400 text-brand-950"><HardHat className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Build more units, or extend?</span>
          <span className="block text-sm text-white/75">CasaVilla designs, gets approval and builds — then lets and manages the new units for you.</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-white/60 group-hover:text-white" />
      </Link>
    </div>
  );
}
