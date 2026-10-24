import QRCode from "qrcode";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, ChevronDown, ChevronRight, Clock, FileCheck2, Info, KeyRound, PlugZap, ReceiptText, Zap } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { chargeLabel } from "@/lib/rules";
import { autoActive, daysSince, docName, EFRIS_STATUS, efrisApplies, efrisMode, efrisProblems, efrisProfile, efrisSetup, missingPayments, type EfrisStep } from "@/lib/efris";
import { canStoreKeys, openKey, publicKeyPem } from "@/lib/efris-crypto";
import { fileUrl } from "@/lib/file-url";
import { generateEfrisKey, recordEfris, removeEfris, retryEfrisPayment, saveEfrisConnection, saveEfrisProfile, testEfrisConnection } from "@/app/efris-actions";
import { Avatar, Badge, Empty, PageHeader, Stat } from "./ui";
import { ConfirmSubmit, Submit } from "./client";
import { FileButton } from "./FileButton";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** The landlord's EFRIS set-up: does EFRIS apply, their TIN, VAT, and from which day. */
async function SetupForm({ landlordId, manager }: { landlordId: number; manager?: boolean }) {
  const p = await efrisProfile(landlordId);
  return (
    <form action={saveEfrisProfile} className="space-y-3 text-sm">
      {manager && <input type="hidden" name="landlordId" value={landlordId} />}
      <fieldset className="space-y-2">
        <legend className="label">Does this landlord have to issue EFRIS receipts?</legend>
        {[
          ["registered", "Yes — registered on URA's EFRIS", "Rent receipts must be EFRIS e-receipts (e-invoices if VAT-registered)."],
          ["exempt", "No — not required", "For example rental income below UGX 2.82M a year. Check with URA if unsure."],
        ].map(([v, t, h]) => (
          <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 p-3 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50/60">
            <input type="radio" name="status" value={v} defaultChecked={p.status === v} required className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span><span className="block font-semibold text-brand-950">{t}</span><span className="block text-xs text-stone-500">{h}</span></span>
          </label>
        ))}
      </fieldset>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block"><span className="label">URA TIN (10 digits)</span>
          <input name="tin" inputMode="numeric" maxLength={12} defaultValue={p.tin ?? ""} className="input" placeholder="e.g. 1000123456" />
        </label>
        <label className="block"><span className="label">Issue EFRIS receipts for payments from</span>
          <input name="since" type="date" max={kampalaToday()} defaultValue={ymd(p.since)} className="input" />
        </label>
      </div>
      <label className="flex items-start gap-2.5 text-stone-700">
        <input type="checkbox" name="vat" defaultChecked={p.vatRegistered} className="mt-0.5 h-4 w-4 accent-brand-700" />
        <span>VAT-registered<span className="block text-xs text-stone-500">VAT-registered landlords (e.g. commercial rent above UGX 300M a year) issue e-invoices with 18% VAT. VAT is set aside on commercial property only; residential rent is exempt.</span></span>
      </label>
      <label className="flex items-start gap-2.5 text-stone-700">
        <input type="checkbox" name="auto" defaultChecked={p.mode === "api"} className="mt-0.5 h-4 w-4 accent-brand-700" />
        <span>Issue EFRIS receipts automatically
          <span className="block text-xs text-stone-500">{efrisMode() === "ura" ? "Issued through URA the moment the tenant pays." : efrisMode() === "sandbox" ? "Test mode: a TEST receipt is made when the tenant pays — nothing is sent to URA." : "Available once URA approves CasaVilla's EFRIS connection. Until then, record receipts here."}</span>
        </span>
      </label>
      <fieldset className="space-y-2 border-t border-stone-100 pt-3">
        <legend className="label">Tax on rent</legend>
        {[
          ["individual", "CasaVilla sets it aside and pays URA", "12% rental income tax on rent above UGX 2.82M a year (individual landlords), taken before your payout."],
          ["none", "I pay my own tax", "For example companies, which pay income tax on profit. Nothing is set aside (VAT is still set aside if VAT-registered)."],
        ].map(([v, t, h]) => (
          <label key={v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-stone-200 p-3 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50/60">
            <input type="radio" name="taxMode" value={v} defaultChecked={(p.taxMode ?? "individual") === v} className="mt-0.5 h-4 w-4 accent-brand-700" />
            <span><span className="block font-semibold text-brand-950">{t}</span><span className="block text-xs text-stone-500">{h}</span></span>
          </label>
        ))}
      </fieldset>
      <Submit className="btn-primary btn-sm">Save EFRIS & tax details</Submit>
    </form>
  );
}

/** A numbered step inside a landlord's set-up panel. */
function Step({ n, title, done, hint, children }: { n: number; title: string; done?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <section className="relative pl-10">
      <span className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-brand-700 text-white" : "bg-white text-stone-500 ring-1 ring-stone-300"}`}>
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <h3 className="text-sm font-semibold text-brand-950">{title}</h3>
      {hint && <p className="mb-3 text-xs text-stone-500">{hint}</p>}
      <div className={hint ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

/** Four dots showing how far a landlord's automatic EFRIS set-up is. */
function SetupDots({ steps }: { steps: EfrisStep[] }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${steps.filter((s) => s.done).length} of ${steps.length} set-up steps done`}>
      {steps.map((s) => <span key={s.key} title={s.label} className={`h-1.5 w-5 rounded-full ${s.done ? "bg-brand-600" : "bg-stone-200"}`} />)}
    </span>
  );
}

/** CasaVilla only: the landlord's own URA system-to-system connection (device, key, service-line settings). */
async function ConnectionForm({ landlordId }: { landlordId: number }) {
  const p = await efrisProfile(landlordId);
  if (p.status !== "registered" || !p.tin) return <p className="rounded-xl border border-dashed border-stone-300 bg-white/70 p-3 text-xs text-stone-500">Finish step 1 first: save the landlord as <b>on EFRIS</b> with their TIN.</p>;
  let pub: string | null = null;
  try { pub = p.keyEnc ? publicKeyPem(openKey(p.keyEnc)) : null; } catch { pub = null; }
  const dict = (p.uraDict ?? {}) as { units?: { value: string; name: string }[] };
  const units = dict.units ?? [];
  const status = p.checkOk ? "ok" : p.checkOk === false ? "failed" : "untested";
  return (
    <div className="space-y-3 text-sm">
      <form action={saveEfrisConnection} className="space-y-3">
        <input type="hidden" name="landlordId" value={landlordId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">EFRIS device number</span>
            <input name="deviceNo" required defaultValue={p.deviceNo ?? ""} autoComplete="off" className="input font-mono" placeholder={`e.g. ${p.tin}_02`} />
            <span className="mt-1 block text-[11px] text-stone-500">The system-to-system device URA registered for TIN {p.tin}.</span>
          </label>
          <label className="block"><span className="label">URA environment</span>
            <select name="environment" defaultValue={p.environment} className="input">
              <option value="test">Test (efristest.ura.go.ug)</option>
              <option value="production">Live EFRIS</option>
            </select>
            <span className="mt-1 block text-[11px] text-stone-500">Start on Test. Switch to Live after a test payment works.</span>
          </label>
        </div>

        <fieldset className="space-y-2 rounded-xl border border-stone-200 bg-white p-3">
          <legend className="label flex items-center gap-1.5 px-1"><KeyRound className="h-3.5 w-3.5" /> Private key</legend>
          {p.keyEnc ? (
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-stone-600"><BadgeCheck className="h-3.5 w-3.5 text-brand-700" /> Stored encrypted · fingerprint <span className="font-mono">{p.keyFingerprint}</span>{p.keyAddedAt ? ` · added ${fmtDate(p.keyAddedAt)}` : ""}. Upload a file only to replace it.</p>
          ) : (
            <p className="text-xs text-stone-500">None yet. Upload this device&apos;s key file (.pfx, .p12, .pem or .key), <b>or</b> use “Make a new key pair” below and upload its public key in URA&apos;s portal.</p>
          )}
          {!canStoreKeys() && <p className="text-xs font-semibold text-maroon-600">EFRIS_KEY_SECRET isn&apos;t set in Railway, so keys can&apos;t be stored yet.</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input name="keyFile" type="file" accept=".pfx,.p12,.pem,.key,.der" className="input py-2 text-xs" />
            <input name="keyPassword" type="password" autoComplete="new-password" className="input" placeholder="Key file password (if it has one)" />
          </div>
        </fieldset>

        <details className="group rounded-xl border border-stone-200 bg-white" open={!p.commodityResidential && !p.commodityCommercial}>
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-stone-700">
            <span className="flex-1">Rent categories on the receipt{p.commodityResidential || p.commodityCommercial ? <span className="ml-1 font-normal text-stone-500">· set</span> : <span className="ml-1 font-normal text-gold-700">· needed</span>}</span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-stone-100 p-3 sm:grid-cols-2">
            <label className="block"><span className="label">Commodity code: residential rent</span>
              <input name="commodityResidential" inputMode="numeric" defaultValue={p.commodityResidential ?? ""} className="input font-mono" placeholder="From URA's commodity list" />
            </label>
            <label className="block"><span className="label">Its name</span>
              <input name="commodityResidentialName" defaultValue={p.commodityResidentialName ?? ""} className="input" placeholder="As URA lists it" />
            </label>
            <label className="block"><span className="label">Commodity code: commercial rent</span>
              <input name="commodityCommercial" inputMode="numeric" defaultValue={p.commodityCommercial ?? ""} className="input font-mono" placeholder="Only if they let shops/offices" />
            </label>
            <label className="block"><span className="label">Its name</span>
              <input name="commodityCommercialName" defaultValue={p.commodityCommercialName ?? ""} className="input" />
            </label>
            <label className="block sm:col-span-2"><span className="label">Measure unit for rent</span>
              {units.length ? (
                <select name="unitCode" defaultValue={p.unitCode ?? ""} className="input">
                  <option value="">Choose…</option>
                  {units.map((u) => <option key={u.value} value={u.value}>{u.name} ({u.value})</option>)}
                </select>
              ) : <input name="unitCode" defaultValue={p.unitCode ?? ""} className="input font-mono" placeholder="The list loads from URA after Test connection" />}
            </label>
          </div>
        </details>

        <details className="group rounded-xl border border-stone-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-stone-700">
            <span className="flex-1">Seller name & address <span className="font-normal text-stone-500">· filled from URA after a test</span></span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-stone-100 p-3 sm:grid-cols-2">
            <label className="block"><span className="label">Legal name</span>
              <input name="legalName" defaultValue={p.legalName ?? ""} className="input" />
            </label>
            <label className="block"><span className="label">Business name</span>
              <input name="businessName" defaultValue={p.businessName ?? ""} className="input" />
            </label>
            <label className="block sm:col-span-2"><span className="label">Address</span>
              <input name="sellerAddress" defaultValue={p.sellerAddress ?? ""} className="input" />
            </label>
          </div>
        </details>

        <Submit className="btn-primary btn-sm">Save URA connection</Submit>
      </form>

      <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 text-xs ${status === "ok" ? "border-brand-100 bg-brand-50/60 text-brand-900" : status === "failed" ? "border-maroon-100 bg-maroon-50/50 text-maroon-700" : "border-stone-200 bg-white text-stone-600"}`}>
        <PlugZap className="h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{status === "ok" ? `Connected to URA${p.environment === "test" ? " (test)" : " (live)"}` : status === "failed" ? "Connection failed" : "Not tested yet"}{p.checkedAt ? <span className="font-normal text-stone-500"> · {fmtDate(p.checkedAt)}</span> : null}</div>
          {p.checkMessage && <p className="mt-0.5 break-words">{p.checkMessage}</p>}
          {efrisMode() !== "ura" && <p className="mt-0.5 text-stone-500">EFRIS_MODE isn&apos;t <b>ura</b> yet, so nothing is sent to URA.</p>}
        </div>
        <form action={testEfrisConnection}><input type="hidden" name="landlordId" value={landlordId} /><Submit className={status === "ok" ? "btn-outline btn-sm" : "btn-primary btn-sm"} pendingText="Testing…" doneText="Tested">Test connection</Submit></form>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <form action={generateEfrisKey}><input type="hidden" name="landlordId" value={landlordId} />
          <ConfirmSubmit message={p.keyEnc ? "Replace the stored key with a new key pair? The current key stops working with URA until the new public key is uploaded." : "Make a new key pair for this landlord?"} className="btn-ghost btn-sm">Make a new key pair</ConfirmSubmit>
        </form>
        {pub && (
          <details className="min-w-0 flex-1">
            <summary className="cursor-pointer font-semibold text-brand-700">Public key (to upload in URA&apos;s EFRIS portal)</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-stone-900 p-3 font-mono text-[10px] leading-relaxed text-stone-100">{pub}</pre>
            <a download={`efris-public-key-${p.tin}.pem`} href={`data:application/x-pem-file;charset=utf-8,${encodeURIComponent(pub)}`} className="mt-2 inline-block font-semibold text-brand-700">Download public key</a>
          </details>
        )}
      </div>
    </div>
  );
}

/** The form for recording one EFRIS document against a payment. */
function RecordForm({ paymentId, paidOn }: { paymentId: number; paidOn: string }) {
  return (
    <form action={recordEfris} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <label className="block sm:col-span-2"><span className="label">Fiscal Document Number (FDN)</span>
        <input name="fdn" required inputMode="numeric" autoComplete="off" className="input font-mono tracking-wide" placeholder="As printed on the EFRIS receipt" />
      </label>
      <label className="block"><span className="label">Verification code</span>
        <input name="code" autoComplete="off" className="input font-mono" placeholder="Optional" />
      </label>
      <label className="block"><span className="label">Date on the EFRIS receipt</span>
        <input name="issuedOn" type="date" required min={paidOn} max={kampalaToday()} defaultValue={kampalaToday()} className="input" />
      </label>
      <label className="block sm:col-span-2"><span className="label">URA&apos;s copy (PDF or photo, optional)</span>
        <input name="file" type="file" accept="application/pdf,image/*" className="input py-2 text-xs" />
      </label>
      <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Save EFRIS receipt</Submit></div>
    </form>
  );
}

/** Badge for payment lists: done, waiting, or nothing when EFRIS doesn't apply. */
export function EfrisBadge({ state }: { state: "done" | "missing" | null }) {
  if (state === "done") return <span className="pill bg-brand-50 text-[10px] text-brand-700"><BadgeCheck className="h-3 w-3" /> EFRIS</span>;
  if (state === "missing") return <span className="pill bg-gold-50 text-[10px] text-gold-700"><Clock className="h-3 w-3" /> EFRIS to follow</span>;
  return null;
}

/** "Waiting 3 days": gold at first, red once it's been more than a week. */
function WaitingPill({ since }: { since: Date | null }) {
  const d = daysSince(since);
  return <span className={`pill shrink-0 text-[10px] ${d > 7 ? "bg-maroon-50 text-maroon-600" : "bg-gold-50 text-gold-700"}`}>{d === 0 ? "Today" : `${d} day${d === 1 ? "" : "s"}`}</span>;
}

const modeText = {
  ura: { label: "Connected to URA", tone: "bg-brand-50 text-brand-700", text: "Landlords set to automatic get their EFRIS receipt issued through URA the moment the tenant pays." },
  sandbox: { label: "Test mode", tone: "bg-gold-50 text-gold-700", text: "Automatic landlords get a TEST receipt when the tenant pays. Nothing is sent to URA." },
  off: { label: "Manual only", tone: "bg-stone-100 text-stone-600", text: "Automatic issuing is off. Receipts are issued in URA's EFRIS app or portal and their FDN recorded here." },
} as const;

export type EfrisTab = "todo" | "landlords" | "issued";

/** The "EFRIS receipts" page for a landlord (their own) or a manager (everyone). */
export async function EfrisPage({ viewer, tab: askedTab, show }: { viewer: User; tab?: string; show?: string }) {
  const manager = viewer.role === "manager";
  const landlordId = manager ? undefined : viewer.id;
  const base = manager ? "/manager/efris" : "/landlord/efris";
  const monthStart = new Date(`${kampalaToday().slice(0, 7)}-01T00:00:00+03:00`);
  const scope = landlordId ? { payment: { lease: { landlordId } } } : {};
  const [missing, recorded, issuedMonth, landlords, problems] = await Promise.all([
    missingPayments(landlordId),
    db.efrisReceipt.findMany({
      where: scope, orderBy: { createdAt: "desc" }, take: 50,
      include: { recordedBy: { select: { name: true } }, payment: { include: { charge: { select: { kind: true, period: true } }, tenant: { select: { name: true } }, lease: { select: { landlord: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } } } } },
    }),
    db.efrisReceipt.count({ where: { ...scope, createdAt: { gte: monthStart } } }),
    manager ? db.user.findMany({ where: { role: "landlord" }, orderBy: { name: "asc" }, select: { id: true, name: true, efrisProfile: true } }) : Promise.resolve([]),
    efrisProblems(landlordId),
  ]);
  const own = manager ? null : await efrisProfile(viewer.id);
  const ownAuto = own ? await autoActive(viewer.id) : false;
  const mode = modeText[efrisMode()];
  const todo = missing.length + problems.length;
  const tab: EfrisTab = askedTab === "issued" ? "issued" : askedTab === "landlords" && manager ? "landlords" : "todo";

  // Landlords, with how far each is with automatic issuing.
  const rows = landlords.map((l) => {
    const prof = l.efrisProfile ?? { status: "unknown", tin: null, mode: "record", deviceNo: null, keyEnc: null, checkOk: null, vatRegistered: false, environment: "test" };
    const setup = efrisSetup(prof);
    const group = prof.status === "exempt" ? "exempt" : prof.status === "registered" && !setup.next ? "connected" : "setup";
    return { ...l, prof, setup, group };
  });
  const counts = { all: rows.length, setup: rows.filter((r) => r.group === "setup").length, connected: rows.filter((r) => r.group === "connected").length, exempt: rows.filter((r) => r.group === "exempt").length };
  const filter = show === "setup" || show === "connected" || show === "exempt" ? show : "all";
  const shown = filter === "all" ? rows : rows.filter((r) => r.group === filter);

  const tabs: [EfrisTab, string, number | null][] = [["todo", "To do", todo], ...(manager ? [["landlords", "Landlords", null] as [EfrisTab, string, null]] : []), ["issued", "Issued", null]];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="EFRIS receipts" subtitle={manager ? "URA fiscal receipts for rent, issued under each landlord's own TIN." : "URA fiscal receipts for the rent your tenants pay, under your TIN."} />

      {/* Where things stand */}
      {own ? <OwnStatus own={own} auto={ownAuto} waiting={missing.length} problems={problems.length} /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
            <span className={`pill ${mode.tone}`}><PlugZap className="h-3 w-3" /> {mode.label}</span>
            <span className="min-w-0 flex-1">{mode.text}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Waiting for a receipt" value={missing.length} href={`${base}?tab=todo`} icon={<Clock className="h-[18px] w-[18px]" />} />
            <Stat label="Automatic issuing stuck" value={problems.length} href={`${base}?tab=todo`} icon={<AlertTriangle className="h-[18px] w-[18px]" />} />
            <Stat label="Issued this month" value={issuedMonth} href={`${base}?tab=issued`} icon={<FileCheck2 className="h-[18px] w-[18px]" />} />
            <Stat label="Landlords automatic" value={<>{counts.connected}<span className="text-sm font-semibold text-stone-400"> / {counts.all - counts.exempt}</span></>} href={`${base}?tab=landlords`} icon={<Zap className="h-[18px] w-[18px]" />} />
          </div>
        </div>
      )}

      {/* Tabs */}
      <nav className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm font-semibold" aria-label="EFRIS sections">
        {tabs.map(([k, label, n]) => (
          <Link key={k} href={`${base}?tab=${k}`} aria-current={tab === k ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${tab === k ? "bg-white text-brand-900 shadow-card" : "text-stone-500 hover:text-stone-800"}`}>
            {label}{n ? <span className="rounded-full bg-gold-100 px-1.5 text-[11px] text-gold-700">{n}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "todo" && (
        <>
          {problems.length > 0 && (
            <section>
              <h2 className="h2 mb-1">Automatic issuing stuck</h2>
              <p className="mb-2 text-xs text-stone-500">CasaVilla tried to issue these through URA and couldn&apos;t yet.</p>
              <div className="card divide-y divide-stone-100 p-0">
                {problems.map((a) => (
                  <div key={a.paymentId} className="flex items-start gap-3 px-4 py-3">
                    <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${a.status === "uncertain" ? "text-gold-600" : "text-maroon-500"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-stone-800">{a.payment.tenant.name} · {a.payment.lease.unit.label} · {ugx(a.payment.amount)}{manager ? ` · ${a.payment.lease.landlord.name}` : ""}</div>
                      <div className="text-xs text-stone-600">{a.status === "uncertain" ? "Sent to URA but no answer came back. CasaVilla checks with URA before sending it again, so don't issue it by hand." : a.status === "stopped" ? "Stopped trying. Fix the cause, then press Try now, or record it by hand under Waiting below." : `URA couldn't be reached. Trying again every hour (${a.attempts} ${a.attempts === 1 ? "try" : "tries"} so far).`}</div>
                      {a.error && <details className="mt-1 text-[11px] text-stone-400"><summary className="cursor-pointer">What URA said</summary><p className="mt-1 break-words">{a.error}</p></details>}
                    </div>
                    {manager && (
                      <form action={retryEfrisPayment}><input type="hidden" name="paymentId" value={a.paymentId} /><Submit className="btn-outline btn-sm" pendingText="Trying…" doneText="Sent">Try now</Submit></form>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="h2 mb-1">Waiting for an EFRIS receipt</h2>
            <p className="mb-2 text-xs text-stone-500">Issue each one in URA&apos;s EFRIS app or portal under {manager ? <>the landlord&apos;s</> : "your"} TIN, then tap it here to enter the FDN. The tenant is told straight away.</p>
            {!missing.length ? (
              <Empty title="All caught up">{own && own.status !== "registered" ? "Nothing to issue. Set up your EFRIS details if you're registered with URA." : "Every payment that needs an EFRIS receipt has one."}</Empty>
            ) : (
              <div className="card divide-y divide-stone-100 p-0">
                {missing.map((p) => (
                  <details key={p.id} className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-stone-800">{p.tenant.name} · {chargeLabel(p.charge.kind, p.charge.period)}</span>
                        <span className="block truncate text-xs text-stone-500">{p.lease.unit.property.name} · {p.lease.unit.label} · paid {fmtDate(p.paidAt)}{manager ? ` · ${p.lease.landlord.name}` : ""}</span>
                        <span className="mt-1 flex sm:hidden"><WaitingPill since={p.paidAt} /></span>
                      </span>
                      <span className="hidden sm:flex"><WaitingPill since={p.paidAt} /></span>
                      <span className="text-right"><span className="block text-sm font-semibold text-stone-800">{ugx(p.amount)}</span><span className="text-[11px] font-semibold text-brand-700 group-open:hidden">Record FDN</span></span>
                    </summary>
                    <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-4">
                      <ol className="mb-3 list-decimal space-y-0.5 pl-4 text-xs text-stone-600">
                        <li>In EFRIS, issue {p.lease.landlord.efrisProfile?.vatRegistered ? "an e-invoice" : "an e-receipt"} to <b>{p.tenant.name}</b> for <b>{ugx(p.amount)}</b> ({chargeLabel(p.charge.kind, p.charge.period)}).</li>
                        <li>Copy its FDN below and save. <span className="text-stone-400">CasaVilla receipt {p.receiptNo} · <Link href={`/receipts/${p.id}`} className="link">view</Link></span></li>
                      </ol>
                      <RecordForm paymentId={p.id} paidOn={ymd(p.paidAt!)} />
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "landlords" && manager && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {([["all", "All"], ["setup", "Need setting up"], ["connected", "Automatic"], ["exempt", "Not required"]] as const).map(([k, label]) => (
              <Link key={k} href={`${base}?tab=landlords${k === "all" ? "" : `&show=${k}`}`}
                className={`rounded-full border px-3 py-1.5 ${filter === k ? "border-brand-700 bg-brand-700 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-brand-300"}`}>
                {label} <span className={filter === k ? "text-white/70" : "text-stone-400"}>{counts[k]}</span>
              </Link>
            ))}
          </div>
          <div className="card divide-y divide-stone-100 p-0">
            {shown.map((l) => (
              <details key={l.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <Avatar name={l.name} className="h-9 w-9 text-xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-800">{l.name}</span>
                    <span className="block truncate text-xs text-stone-500">
                      {l.group === "exempt" ? "EFRIS not required" : l.group === "connected" ? `Automatic${l.prof.environment === "test" && efrisMode() === "ura" ? " · URA test" : ""}${l.prof.tin ? ` · TIN ${l.prof.tin}` : ""}${l.prof.vatRegistered ? " · VAT" : ""}` : <>Next: <span className="text-stone-700">{l.setup.next}</span></>}
                    </span>
                  </span>
                  {l.group === "exempt" ? <Badge color="gray">Not required</Badge> : l.group === "connected" ? <Badge color="green">Automatic</Badge> : <SetupDots steps={l.setup.steps} />}
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-6 border-t border-stone-100 bg-stone-50/60 px-4 py-5">
                  <Step n={1} title="EFRIS & tax details" done={l.setup.steps[0].done || l.prof.status === "exempt"} hint="Whether they're on EFRIS, their TIN and VAT, and how rent tax is handled. Tick automatic once steps 2 and 3 are done.">
                    <SetupForm landlordId={l.id} manager />
                  </Step>
                  {l.prof.status !== "exempt" && (
                    <Step n={2} title="Connect to URA" done={!!(l.prof.deviceNo && l.prof.keyEnc && l.prof.checkOk)} hint={efrisMode() === "ura" ? "Their EFRIS device and key, then Test connection. CasaVilla only." : "Needed once EFRIS_MODE is set to ura. CasaVilla only."}>
                      <ConnectionForm landlordId={l.id} />
                    </Step>
                  )}
                </div>
              </details>
            ))}
            {!shown.length && <div className="px-4 py-6 text-center text-sm text-stone-500">{rows.length ? "No landlords in this group." : "No landlords yet."}</div>}
          </div>
        </section>
      )}

      {tab === "issued" && (
        <section>
          <h2 className="h2 mb-2">Issued <span className="text-sm font-normal text-stone-500">· latest 50</span></h2>
          {!recorded.length ? <Empty title="No EFRIS receipts yet">They&apos;ll appear here as they&apos;re issued or recorded.</Empty> : (
            <div className="card divide-y divide-stone-100 p-0">
              {recorded.map((e) => (
                <Link key={e.id} href={`/receipts/${e.paymentId}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <FileCheck2 className="h-5 w-5 shrink-0 text-brand-700" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-stone-800">{e.payment.tenant.name} · {chargeLabel(e.payment.charge.kind, e.payment.charge.period)}</div>
                    <div className="truncate font-mono text-xs text-stone-500">FDN {e.fdn}</div>
                    <div className="truncate text-[11px] text-stone-400">{e.test ? "TEST · " : ""}{docName(e.kind)} · {fmtDate(e.issuedOn)} · {e.source === "api" ? "automatic" : e.recordedBy ? `recorded by ${e.recordedBy.name}` : "recorded"}{manager ? ` · ${e.payment.lease.landlord.name}` : ""}</div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-stone-800">{ugx(e.payment.amount)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* The landlord's own settings, kept at the bottom once set up */}
      {own && (
        <details id="setup" className="card group" open={own.status === "unknown"}>
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <ReceiptText className="h-5 w-5 text-brand-700" />
            <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">Your EFRIS & tax details</span><span className="block text-xs text-stone-500">{EFRIS_STATUS[own.status]}{own.tin ? ` · TIN ${own.tin}` : ""}{own.status === "registered" ? ` · from ${fmtDate(own.since)}` : ""}</span></span>
            <span className="text-xs font-semibold text-brand-700 group-open:hidden">{own.status === "unknown" ? "Set up" : "Edit"}</span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 border-t border-stone-100 pt-4"><SetupForm landlordId={viewer.id} /></div>
        </details>
      )}
    </div>
  );
}

/** For a landlord: one plain answer to "what do I need to do about EFRIS?" */
function OwnStatus({ own, auto, waiting, problems }: { own: Awaited<ReturnType<typeof efrisProfile>>; auto: boolean; waiting: number; problems: number }) {
  const s =
    own.status === "unknown" ? { tone: "gold", icon: Info, title: "Tell us about EFRIS", text: "Are you registered with URA's EFRIS? Answer below so your tenants' receipts are right.", cta: true }
    : own.status === "exempt" ? { tone: "green", icon: BadgeCheck, title: "EFRIS isn't required for you", text: "Nothing to do. If that changes, update your details below.", cta: false }
    : auto ? { tone: "green", icon: Zap, title: "EFRIS receipts are automatic", text: problems ? `CasaVilla issues each receipt when your tenant pays. ${problems} ${problems === 1 ? "is" : "are"} delayed and being handled by CasaVilla.` : "CasaVilla issues each receipt through URA the moment your tenant pays. You don't need to do anything.", cta: false }
    : own.mode === "api" ? { tone: "gold", icon: Clock, title: "Automatic issuing is being set up", text: `CasaVilla is connecting you to URA. Until then, issue receipts in URA's EFRIS app and record them here${waiting ? `: ${waiting} waiting` : ""}.`, cta: false }
    : { tone: waiting ? "gold" : "green", icon: waiting ? Clock : BadgeCheck, title: waiting ? `${waiting} payment${waiting === 1 ? "" : "s"} need an EFRIS receipt` : "All your EFRIS receipts are recorded", text: "You issue receipts in URA's EFRIS app or portal, then record the FDN here. Ask CasaVilla to switch you to automatic to skip this.", cta: false };
  const I = s.icon;
  return (
    <div className={`flex items-start gap-3 rounded-2xl border p-4 ${s.tone === "green" ? "border-brand-100 bg-brand-50/60" : "border-gold-200 bg-gold-50/70"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone === "green" ? "bg-brand-700 text-white" : "bg-gold-400 text-brand-950"}`}><I className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-brand-950">{s.title}</div>
        <p className="mt-0.5 text-sm text-stone-600">{s.text}</p>
        {s.cta && <a href="#setup" className="btn-primary btn-sm mt-3 inline-flex">Set up EFRIS</a>}
      </div>
    </div>
  );
}

/** On the CasaVilla receipt: the EFRIS document, or that it is still to come. */
export async function EfrisOnReceipt({ paymentId, landlordId, paidAt, chargeKind, canManage }: { paymentId: number; landlordId: number; paidAt: Date | null; chargeKind: string; canManage: boolean }) {
  const [e, prof] = await Promise.all([db.efrisReceipt.findUnique({ where: { paymentId } }), efrisProfile(landlordId)]);
  if (!e && (!efrisApplies(chargeKind) || prof.status !== "registered" || !paidAt || paidAt < prof.since)) return null;
  if (!e) {
    return (
      <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50/70 p-4 text-sm">
        <div className="flex items-center gap-2 font-semibold text-stone-800"><Clock className="h-4 w-4 text-gold-600" /> EFRIS receipt to follow</div>
        <p className="mt-1 text-xs text-stone-600">This is CasaVilla&apos;s payment record. The landlord&apos;s URA EFRIS {prof.vatRegistered ? "e-invoice" : "e-receipt"} for this payment will appear here once it&apos;s issued.</p>
        {canManage && (
          <details className="no-print mt-3">
            <summary className="cursor-pointer list-none text-xs font-semibold text-brand-700">Record the EFRIS receipt now</summary>
            <div className="mt-3"><RecordForm paymentId={paymentId} paidOn={ymd(paidAt!)} /></div>
          </details>
        )}
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-brand-900"><BadgeCheck className="h-4 w-4 text-brand-700" /> {e.test ? "TEST " : "URA "}{docName(e.kind)}{e.source === "api" ? " · issued automatically" : ""}</div>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <div><dt className="text-xs text-stone-500">Fiscal Document Number (FDN)</dt><dd className="break-all font-mono font-semibold text-stone-900">{e.fdn}</dd></div>
        {e.verificationCode && <div><dt className="text-xs text-stone-500">Verification code</dt><dd className="break-all font-mono font-semibold text-stone-900">{e.verificationCode}</dd></div>}
        <div><dt className="text-xs text-stone-500">Issued</dt><dd className="font-semibold text-stone-900">{fmtDate(e.issuedOn)}</dd></div>
        {e.tin && <div><dt className="text-xs text-stone-500">Seller TIN</dt><dd className="font-mono font-semibold text-stone-900">{e.tin}</dd></div>}
      </dl>
      {e.qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={await QRCode.toDataURL(e.qr, { margin: 1, width: 240 })} alt="EFRIS QR code" className="mt-3 h-28 w-28 rounded-lg bg-white p-1 ring-1 ring-stone-200" />
      )}
      <p className="mt-2 text-[11px] text-stone-500">{e.test ? "Test document — not a real fiscal receipt." : "Check it in URA's EFRIS app or web portal using the FDN and the date it was issued."}</p>
      <div className="no-print mt-3 flex flex-wrap items-center gap-3">
        {e.fileId && <FileButton href={fileUrl(e.fileId)} name={`EFRIS-${e.fdn}`} className="btn-outline btn-sm">URA&apos;s copy</FileButton>}
        {canManage && (
          <form action={removeEfris}>
            <input type="hidden" name="paymentId" value={paymentId} />
            <ConfirmSubmit message="Remove this EFRIS record? Use this only if it was entered by mistake." className="text-xs font-semibold text-maroon-600 hover:underline">Entered by mistake? Remove</ConfirmSubmit>
          </form>
        )}
      </div>
    </div>
  );
}
