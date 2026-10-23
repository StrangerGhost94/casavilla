import QRCode from "qrcode";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, ChevronDown, Clock, FileCheck2, Info, KeyRound, PlugZap, ReceiptText } from "lucide-react";
import { db, type User } from "@/db";
import { fmtDate, kampalaToday, ugx } from "@/lib/format";
import { chargeLabel } from "@/lib/rules";
import { autoActive, docName, EFRIS_STATUS, efrisApplies, efrisMode, efrisProblems, efrisProfile, missingPayments } from "@/lib/efris";
import { canStoreKeys, openKey, publicKeyPem } from "@/lib/efris-crypto";
import { fileUrl } from "@/lib/file-url";
import { generateEfrisKey, recordEfris, removeEfris, retryEfrisPayment, saveEfrisConnection, saveEfrisProfile, testEfrisConnection } from "@/app/efris-actions";
import { Badge, Empty, PageHeader } from "./ui";
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

/** CasaVilla only: the landlord's own URA system-to-system connection (device, key, service-line settings). */
async function ConnectionForm({ landlordId }: { landlordId: number }) {
  const p = await efrisProfile(landlordId);
  if (p.status !== "registered" || !p.tin) return <p className="text-xs text-stone-500">Save the landlord as registered on EFRIS, with their TIN, to connect them to URA.</p>;
  let pub: string | null = null;
  try { pub = p.keyEnc ? publicKeyPem(openKey(p.keyEnc)) : null; } catch { pub = null; }
  const dict = (p.uraDict ?? {}) as { units?: { value: string; name: string }[] };
  const units = dict.units ?? [];
  return (
    <div className="space-y-3 text-sm">
      <div className={`rounded-xl border p-3 text-xs ${p.checkOk ? "border-brand-100 bg-brand-50/60 text-brand-900" : p.checkOk === false ? "border-maroon-100 bg-maroon-50/50 text-maroon-700" : "border-stone-200 bg-white text-stone-600"}`}>
        <div className="flex items-center gap-2 font-semibold"><PlugZap className="h-4 w-4" /> {p.checkOk ? "Connected to URA" : p.checkOk === false ? "Connection failed" : "Not tested yet"}{p.checkedAt ? <span className="font-normal text-stone-500">· {fmtDate(p.checkedAt)}</span> : null}</div>
        {p.checkMessage && <p className="mt-1">{p.checkMessage}</p>}
        {efrisMode() !== "ura" && <p className="mt-1 text-stone-500">EFRIS_MODE isn&apos;t <b>ura</b> yet, so nothing is sent to URA.</p>}
      </div>
      <form action={saveEfrisConnection} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input type="hidden" name="landlordId" value={landlordId} />
        <label className="block"><span className="label">EFRIS device number</span>
          <input name="deviceNo" required defaultValue={p.deviceNo ?? ""} autoComplete="off" className="input font-mono" placeholder={`e.g. ${p.tin}_02`} />
        </label>
        <label className="block"><span className="label">URA environment</span>
          <select name="environment" defaultValue={p.environment} className="input">
            <option value="test">Test (efristest.ura.go.ug)</option>
            <option value="production">Live EFRIS</option>
          </select>
        </label>
        <label className="block"><span className="label">Commodity code — residential rent</span>
          <input name="commodityResidential" inputMode="numeric" defaultValue={p.commodityResidential ?? ""} className="input font-mono" placeholder="From URA's commodity list" />
        </label>
        <label className="block"><span className="label">Its name</span>
          <input name="commodityResidentialName" defaultValue={p.commodityResidentialName ?? ""} className="input" placeholder="As URA lists it" />
        </label>
        <label className="block"><span className="label">Commodity code — commercial rent</span>
          <input name="commodityCommercial" inputMode="numeric" defaultValue={p.commodityCommercial ?? ""} className="input font-mono" placeholder="Only if they let shops/offices" />
        </label>
        <label className="block"><span className="label">Its name</span>
          <input name="commodityCommercialName" defaultValue={p.commodityCommercialName ?? ""} className="input" />
        </label>
        <label className="block"><span className="label">Measure unit for rent</span>
          {units.length ? (
            <select name="unitCode" defaultValue={p.unitCode ?? ""} className="input">
              <option value="">Choose…</option>
              {units.map((u) => <option key={u.value} value={u.value}>{u.name} ({u.value})</option>)}
            </select>
          ) : <input name="unitCode" defaultValue={p.unitCode ?? ""} className="input font-mono" placeholder="Loads from URA after a test" />}
        </label>
        <label className="block"><span className="label">Seller legal name</span>
          <input name="legalName" defaultValue={p.legalName ?? ""} className="input" placeholder="Filled from URA after a test" />
        </label>
        <label className="block"><span className="label">Seller business name</span>
          <input name="businessName" defaultValue={p.businessName ?? ""} className="input" />
        </label>
        <label className="block"><span className="label">Seller address</span>
          <input name="sellerAddress" defaultValue={p.sellerAddress ?? ""} className="input" />
        </label>
        <fieldset className="space-y-2 rounded-xl border border-stone-200 bg-white p-3 sm:col-span-2">
          <legend className="label flex items-center gap-1.5 px-1"><KeyRound className="h-3.5 w-3.5" /> Private key</legend>
          <p className="text-xs text-stone-500">{p.keyEnc ? <>Stored encrypted · fingerprint <span className="font-mono">{p.keyFingerprint}</span>{p.keyAddedAt ? ` · added ${fmtDate(p.keyAddedAt)}` : ""}. Upload a file only to replace it.</> : "None yet. Upload the key file for this TIN's EFRIS device (.pfx, .p12, .pem or .key), or make a new key pair below."}</p>
          {!canStoreKeys() && <p className="text-xs font-semibold text-maroon-600">EFRIS_KEY_SECRET isn&apos;t set in Railway, so keys can&apos;t be stored yet.</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input name="keyFile" type="file" accept=".pfx,.p12,.pem,.key,.der" className="input py-2 text-xs" />
            <input name="keyPassword" type="password" autoComplete="new-password" className="input" placeholder="Key file password (if it has one)" />
          </div>
        </fieldset>
        <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Save URA connection</Submit></div>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <form action={testEfrisConnection}><input type="hidden" name="landlordId" value={landlordId} /><Submit className="btn-outline btn-sm">Test connection</Submit></form>
        <form action={generateEfrisKey}><input type="hidden" name="landlordId" value={landlordId} />
          <ConfirmSubmit message={p.keyEnc ? "Replace the stored key with a new key pair? The current key stops working with URA until the new public key is uploaded." : "Make a new key pair for this landlord?"} className="btn-ghost btn-sm">Make a new key pair</ConfirmSubmit>
        </form>
      </div>
      {pub && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-brand-700">Public key (to upload in URA&apos;s EFRIS portal)</summary>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-stone-900 p-3 font-mono text-[10px] leading-relaxed text-stone-100">{pub}</pre>
          <a download={`efris-public-key-${p.tin}.pem`} href={`data:application/x-pem-file;charset=utf-8,${encodeURIComponent(pub)}`} className="mt-2 inline-block font-semibold text-brand-700">Download public key</a>
        </details>
      )}
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

/** The "EFRIS receipts" page for a landlord (their own) or a manager (everyone). */
export async function EfrisPage({ viewer }: { viewer: User }) {
  const manager = viewer.role === "manager";
  const landlordId = manager ? undefined : viewer.id;
  const [missing, recorded, landlords] = await Promise.all([
    missingPayments(landlordId),
    db.efrisReceipt.findMany({
      where: landlordId ? { payment: { lease: { landlordId } } } : {},
      orderBy: { createdAt: "desc" }, take: 50,
      include: { recordedBy: { select: { name: true } }, payment: { include: { charge: { select: { kind: true, period: true } }, tenant: { select: { name: true } }, lease: { select: { landlord: { select: { name: true } }, unit: { select: { label: true, property: { select: { name: true } } } } } } } } },
    }),
    manager ? db.user.findMany({ where: { role: "landlord" }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true, efrisProfile: true } }) : Promise.resolve([]),
  ]);
  const own = manager ? null : await efrisProfile(viewer.id);
  const [problems, ownAuto] = await Promise.all([efrisProblems(landlordId), own ? autoActive(viewer.id) : Promise.resolve(false)]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="EFRIS receipts" subtitle="URA's fiscal receipts for rent, issued under each landlord's TIN." />

      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-sm text-stone-700">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
        <div className="space-y-1">
          <p><b>How it works:</b> landlords set to <b>automatic</b> get their EFRIS e-receipt issued the moment the tenant pays{efrisMode() === "off" ? " (available once URA approves CasaVilla's connection)" : efrisMode() === "sandbox" ? " (test mode right now: TEST receipts, nothing sent to URA)" : ""}. Otherwise, issue it in URA&apos;s EFRIS app or portal under the landlord&apos;s TIN and record its FDN here.</p>
          <p className="text-xs text-stone-500">Either way the tenant gets one receipt — CasaVilla&apos;s — carrying the EFRIS number, and is told straight away.</p>
        </div>
      </div>

      {/* Set-up */}
      {own && (
        <details className="card group" open={own.status === "unknown"}>
          <summary className="flex cursor-pointer list-none items-center gap-3">
            <ReceiptText className="h-5 w-5 text-brand-700" />
            <span className="min-w-0 flex-1"><span className="block font-semibold text-brand-950">Your EFRIS details</span><span className="block text-xs text-stone-500">{EFRIS_STATUS[own.status]}{own.tin ? ` · TIN ${own.tin}` : ""}{own.status === "registered" ? ` · from ${fmtDate(own.since)}` : ""}{ownAuto ? " · issued automatically" : own.mode === "api" ? " · automatic once CasaVilla connects you to URA" : ""}</span></span>
            <ChevronDown className="h-4 w-4 text-stone-400 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 border-t border-stone-100 pt-4"><SetupForm landlordId={viewer.id} /></div>
        </details>
      )}
      {manager && (
        <section>
          <h2 className="h2 mb-2">Landlords</h2>
          <div className="card divide-y divide-stone-100 p-0">
            {landlords.map((l) => (
              <details key={l.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-stone-800">{l.name}</span><span className="block truncate text-xs text-stone-500">{l.efrisProfile?.tin ? `TIN ${l.efrisProfile.tin}` : "No TIN yet"}{l.efrisProfile?.vatRegistered ? " · VAT" : ""}{l.efrisProfile?.checkOk ? ` · URA connected${l.efrisProfile.environment === "test" ? " (test)" : ""}` : ""}</span></span>
                  <Badge color={l.efrisProfile?.status === "registered" ? "green" : l.efrisProfile?.status === "exempt" ? "gray" : "amber"}>{EFRIS_STATUS[l.efrisProfile?.status ?? "unknown"]}</Badge>
                  <ChevronDown className="h-4 w-4 shrink-0 text-stone-400 transition group-open:rotate-180" />
                </summary>
                <div className="space-y-5 border-t border-stone-100 bg-stone-50/60 px-4 py-4">
                  <SetupForm landlordId={l.id} manager />
                  <div className="border-t border-stone-200 pt-4">
                    <h3 className="mb-2 text-sm font-semibold text-brand-950">URA connection (system-to-system)</h3>
                    <ConnectionForm landlordId={l.id} />
                  </div>
                </div>
              </details>
            ))}
            {!landlords.length && <div className="px-4 py-4 text-sm text-stone-500">No landlords yet.</div>}
          </div>
        </section>
      )}

      {problems.length > 0 && (
        <section>
          <h2 className="h2 mb-2">Automatic issuing needs attention</h2>
          <div className="card divide-y divide-stone-100 p-0">
            {problems.map((a) => (
              <div key={a.paymentId} className="flex items-start gap-3 px-4 py-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${a.status === "uncertain" ? "text-gold-600" : "text-maroon-500"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-800">{a.payment.tenant.name} · {a.payment.lease.unit.label} · {ugx(a.payment.amount)}{manager ? ` · ${a.payment.lease.landlord.name}` : ""}</div>
                  <div className="text-xs text-stone-500">{a.status === "uncertain" ? "Sent to URA without an answer — CasaVilla checks with URA before sending again. Don't issue it by hand." : a.status === "stopped" ? "Stopped — record it by hand, or try again once fixed." : `Retrying hourly (${a.attempts} tries).`}</div>
                  {a.error && <div className="mt-0.5 break-words text-[11px] text-stone-400">{a.error}</div>}
                </div>
                {manager && (
                  <form action={retryEfrisPayment}><input type="hidden" name="paymentId" value={a.paymentId} /><Submit className="btn-outline btn-sm">Try now</Submit></form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* To do */}
      <section>
        <h2 className="h2 mb-2">Waiting for an EFRIS receipt {missing.length > 0 && <span className="ml-1 rounded-full bg-gold-100 px-2 py-0.5 text-xs text-gold-700">{missing.length}</span>}</h2>
        {!missing.length ? (
          <Empty title="Nothing waiting">{own && own.status !== "registered" ? "Set up your EFRIS details above if you issue EFRIS receipts." : "Every payment that needs one has its EFRIS receipt."}</Empty>
        ) : (
          <div className="card divide-y divide-stone-100 p-0">
            {missing.map((p) => (
              <details key={p.id} className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-800">{p.tenant.name} · {chargeLabel(p.charge.kind, p.charge.period)}</span>
                    <span className="block truncate text-xs text-stone-500">{p.lease.unit.property.name} · {p.lease.unit.label} · paid {fmtDate(p.paidAt)}{manager ? ` · ${p.lease.landlord.name}` : ""}</span>
                  </span>
                  <span className="text-right"><span className="block text-sm font-semibold text-stone-800">{ugx(p.amount)}</span><span className="text-[11px] font-semibold text-brand-700 group-open:hidden">Record</span></span>
                </summary>
                <div className="border-t border-stone-100 bg-stone-50/60 px-4 py-4">
                  <p className="mb-3 text-xs text-stone-500">Issue it in EFRIS to <b>{p.tenant.name}</b> for <b>{ugx(p.amount)}</b> ({chargeLabel(p.charge.kind, p.charge.period)}), then enter its number. Receipt {p.receiptNo} · <Link href={`/receipts/${p.id}`} className="link">view</Link></p>
                  <RecordForm paymentId={p.id} paidOn={ymd(p.paidAt!)} />
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      {/* Done */}
      <section>
        <h2 className="h2 mb-2">Recorded</h2>
        {!recorded.length ? <Empty title="No EFRIS receipts recorded yet" /> : (
          <div className="card divide-y divide-stone-100 p-0">
            {recorded.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <FileCheck2 className="h-5 w-5 shrink-0 text-brand-700" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-800">{e.payment.tenant.name} · {chargeLabel(e.payment.charge.kind, e.payment.charge.period)}</div>
                  <div className="truncate font-mono text-xs text-stone-500">FDN {e.fdn}</div>
                  <div className="truncate text-[11px] text-stone-400">{docName(e.kind)} · {fmtDate(e.issuedOn)}{e.recordedBy ? ` · by ${e.recordedBy.name}` : ""}{manager ? ` · ${e.payment.lease.landlord.name}` : ""}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-stone-800">{ugx(e.payment.amount)}</span>
                  <Link href={`/receipts/${e.paymentId}`} className="text-[11px] font-semibold text-brand-700">Receipt</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
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
