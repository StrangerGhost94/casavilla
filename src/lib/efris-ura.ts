import "server-only";
import type { EfrisProfile } from "@prisma/client";
import { db } from "@/db";
import {
  buildCreditNote, buildInvoice, buildService, decodeContent, dictSection, encryptedEnvelope, keyFingerprint, openKey, payModeFor, plainEnvelope,
  readCommodity, readCreditStatus, readIssued, serviceLine, sessionAesKey, treatmentFor, treatmentLabel, type CommodityTax, type Device, type Envelope,
} from "./efris-crypto";

/**
 * URA EFRIS system-to-system client. One connection per landlord: their TIN, the EFRIS device URA gave for it, and
 * their key pair (private key stored encrypted on the profile). TINs never mix: every call is built from the
 * landlord profile of the payment's lease.
 *
 * Duplicate safety: a T109 that was sent but got no answer may have been fiscalised. Such payments are marked
 * "uncertain", and before anything is sent again URA is asked (T106 by our reference number) whether it already has
 * the document.
 */

const ENDPOINT = {
  test: "https://efristest.ura.go.ug/efrisws/ws/taapp/getInformation",
  production: "https://efrisws.ura.go.ug/ws/taapp/getInformation",
} as const;
export type UraEnv = keyof typeof ENDPOINT;

export class UraError extends Error {
  /** true when the request may have reached URA (so the outcome is unknown) */
  sent: boolean;
  rc?: string;
  constructor(message: string, sent = false, rc?: string) { super(message); this.sent = sent; this.rc = rc; }
}

type Reply = { rc: string; rm: string; content: string | null };

/** EFRIS_TEST_URL (optional) points the *test* environment somewhere else, e.g. a local mock of URA. Never production. */
const urlFor = (env: UraEnv) => (env === "test" && process.env.EFRIS_TEST_URL) || ENDPOINT[env];

async function post(env: UraEnv, body: Envelope): Promise<Reply> {
  let res: Response;
  try {
    res = await fetch(urlFor(env), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000), cache: "no-store" });
  } catch (e) {
    const code = String((e as { cause?: { code?: string } }).cause?.code ?? "");
    const before = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code);
    const timeout = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError";
    throw new UraError(timeout ? "URA's EFRIS server didn't answer within 30 seconds" : before ? `Couldn't reach URA's EFRIS server (${code})` : `The connection to URA dropped before its answer arrived${code ? ` (${code})` : ""}`, !before);
  }
  const text = await res.text();
  if (/^\s*</.test(text)) throw new UraError(`URA's EFRIS server is unavailable (HTTP ${res.status})`);
  let j: { returnStateInfo?: { returnCode?: string; returnMessage?: string }; data?: { content?: string } };
  try { j = JSON.parse(text); } catch { throw new UraError(`URA sent an unreadable answer (HTTP ${res.status})`, res.ok); }
  return { rc: String(j.returnStateInfo?.returnCode ?? ""), rm: String(j.returnStateInfo?.returnMessage ?? ""), content: j.data?.content ?? null };
}

export type Conn = Device & { env: UraEnv; pem: string };
type Session = { aesKey: Buffer; login: Record<string, unknown> | null; at: number };
const sessions = new Map<string, Session>();
const SESSION_MS = 25 * 60_000;
const skey = (c: Conn) => `${c.env}|${c.tin}|${c.deviceNo}|${keyFingerprint(c.pem)}`;

/** The connection for a landlord's profile, or why there isn't one. */
export function connFor(p: Pick<EfrisProfile, "tin" | "deviceNo" | "keyEnc" | "environment">): Conn | string {
  if (!p.tin) return "No URA TIN on the landlord's EFRIS details";
  if (!p.deviceNo) return "No EFRIS device number yet";
  if (!p.keyEnc) return "No EFRIS key yet";
  try {
    return { tin: p.tin, deviceNo: p.deviceNo, env: p.environment === "production" ? "production" : "test", pem: openKey(p.keyEnc) };
  } catch (e) {
    return `The stored EFRIS key can't be opened (${(e as Error).message}). Check EFRIS_KEY_SECRET hasn't changed.`;
  }
}

/** T101 (reachability) → T104 (session key) → T103 (login). Cached for 25 minutes. */
export async function openSession(c: Conn, fresh = false): Promise<Session> {
  const k = skey(c);
  const cached = sessions.get(k);
  if (!fresh && cached && Date.now() - cached.at < SESSION_MS) return cached;
  sessions.delete(k);
  await post(c.env, plainEnvelope("T101", c));
  const t104 = await post(c.env, plainEnvelope("T104", c));
  let des: string | undefined;
  try { const j = JSON.parse(Buffer.from(t104.content ?? "", "base64").toString("utf8")); des = j.passowrdDes ?? j.passwordDes; } catch { /* below */ }
  if (!des) throw new UraError(`URA didn't send a session key${t104.rc ? ` (${t104.rc}: ${t104.rm})` : ""}. Check the TIN and device number.`, false, t104.rc);
  const aesKey = sessionAesKey(des, c.pem);
  const t103 = await post(c.env, plainEnvelope("T103", c));
  if (t103.rc && t103.rc !== "00") {
    const hint = t103.rc === "402" || /expired/i.test(t103.rm) ? " — the device key has expired; renew the device in URA's EFRIS portal." : "";
    throw new UraError(`URA refused the login (${t103.rc}: ${t103.rm})${hint}`, false, t103.rc);
  }
  const s: Session = { aesKey, login: (decodeContent(t103.content, aesKey) as Record<string, unknown>) ?? null, at: Date.now() };
  sessions.set(k, s);
  return s;
}

/** An encrypted call. rc 15 ("data decryption error") means URA rotated the key: renew and retry once (never processed, so no duplicate). */
async function secure(c: Conn, code: string, payload: unknown, s: Session) {
  let r = await post(c.env, encryptedEnvelope(code, c, payload, s.aesKey, c.pem));
  if (r.rc === "15") {
    Object.assign(s, await openSession(c, true));
    r = await post(c.env, encryptedEnvelope(code, c, payload, s.aesKey, c.pem));
  }
  return { ...r, data: decodeContent(r.content, s.aesKey) };
}

type Dict = { units: { value: string; name: string }[]; payWays: { value: string; name: string }[]; currency: string };

/** Taxpayer details from the login (T103). */
function taxpayer(login: Record<string, unknown> | null) {
  const t = ((login?.taxpayer as Record<string, unknown>) ?? login ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const types = JSON.stringify(login?.taxType ?? t.taxType ?? []);
  return { legalName: s(t.legalName), businessName: s(t.businessName), address: s(t.address), email: s(t.contactEmail) ?? s(t.email), phone: s(t.contactMobile) ?? s(t.contactNumber), vat: /value added|\bVAT\b/i.test(types) };
}

/** "Test connection": logs in to URA with the landlord's device and key, and loads what issuing needs. */
export async function testConnection(landlordId: number) {
  const prof = await db.efrisProfile.findUnique({ where: { landlordId } });
  if (!prof) return { ok: false, message: "Save the landlord's EFRIS details first" };
  const c = connFor(prof);
  const save = (ok: boolean, message: string, extra: Partial<EfrisProfile> = {}) =>
    db.efrisProfile.update({ where: { landlordId }, data: { checkedAt: new Date(), checkOk: ok, checkMessage: message.slice(0, 500), ...extra } as never }).then(() => ({ ok, message }));
  if (typeof c === "string") return save(false, c);
  try {
    const s = await openSession(c, true);
    const tp = taxpayer(s.login);
    const t115 = await secure(c, "T115", {}, s);
    const units = dictSection(t115.data, ["rateUnit", "measureUnit", "unit", "goodsUnit"]);
    const payWays = dictSection(t115.data, ["payWay", "paymentMode", "paymentType"]);
    const currencies = dictSection(t115.data, ["currencyType", "currency"]);
    const currency = currencies.find((x) => /UGX|shilling/i.test(x.name) || x.value === "UGX")?.value ?? "101";
    const dict: Dict = { units, payWays, currency };
    const notes: string[] = [];
    if (!units.length) notes.push("URA's list of measure units didn't load — enter the unit code by hand");
    if (tp.vat !== prof.vatRegistered && s.login) notes.push(tp.vat ? "URA lists VAT for this TIN, but the landlord isn't marked VAT-registered here" : "This landlord is marked VAT-registered here, but URA's login didn't list VAT");
    // URA's official tax treatment of each rent commodity code (T124), used on every document.
    const tax: Record<string, CommodityTax> = {};
    for (const [k, code] of [["residential", prof.commodityResidential], ["commercial", prof.commodityCommercial]] as const) {
      if (!code) continue;
      const info = await commodityInfo(c, s, code).catch(() => null);
      if (!info) { notes.push(`URA didn't find commodity code ${code} (${k} rent) — check it`); continue; }
      tax[k] = info;
      if (!info.leaf) notes.push(`commodity code ${code} is a category, not a final item — choose a more specific code under it`);
      if (prof.vatRegistered) notes.push(`${k} rent: ${treatmentLabel(treatmentFor(true, k === "commercial", info))} per URA`);
    }
    const name = tp.legalName ?? tp.businessName;
    return save(true, `Connected to URA ${c.env === "production" ? "EFRIS" : "EFRIS test environment"}${name ? ` as ${name}` : ""}.${notes.length ? ` Note: ${notes.join("; ")}.` : ""}`, {
      uraDict: dict as never,
      legalName: prof.legalName ?? tp.legalName, businessName: prof.businessName ?? tp.businessName, sellerAddress: prof.sellerAddress ?? tp.address,
      commodityTax: (Object.keys(tax).length ? tax : prof.commodityTax) as never,
      commodityResidentialName: prof.commodityResidentialName || tax.residential?.name || null,
      commodityCommercialName: prof.commodityCommercialName || tax.commercial?.name || null,
      unitCode: prof.unitCode ?? (units.find((u) => /month/i.test(u.name)) ?? units.find((u) => /service|unit/i.test(u.name)))?.value ?? null,
    });
  } catch (e) {
    return save(false, (e as Error).message);
  }
}

/** Registers a service line with URA (T130) unless it already is. */
async function ensureService(c: Conn, s: Session, prof: EfrisProfile, unitId: number, line: { kind: string; code: string; name: string }, price: number, commercial: boolean) {
  const have = await db.efrisGood.findUnique({ where: { landlordId_environment_code: { landlordId: prof.landlordId, environment: c.env, code: line.code } } });
  if (have?.status === "registered") return;
  const dict = (prof.uraDict ?? {}) as Partial<Dict>;
  const r = await secure(c, "T130", buildService({
    code: line.code, name: line.name, price, unitOfMeasure: prof.unitCode!, currency: dict.currency ?? "101",
    commodityCode: (commercial ? prof.commodityCommercial : prof.commodityResidential)!, commodityName: (commercial ? prof.commodityCommercialName : prof.commodityResidentialName) ?? "",
  }), s);
  const item = (Array.isArray(r.data) ? r.data[0] : r.data) as { returnCode?: string; returnMessage?: string } | null;
  const rc = String(item?.returnCode ?? r.rc), rm = String(item?.returnMessage ?? r.rm);
  // 602 = already registered under this TIN
  const ok = (rc === "00" || rc === "602") && (r.rc === "00" || r.rc === "");
  const data = { kind: line.kind, name: line.name, unitId, status: ok ? "registered" : "failed", error: ok ? null : `${rc}: ${rm}`.slice(0, 300) };
  await db.efrisGood.upsert({ where: { landlordId_environment_code: { landlordId: prof.landlordId, environment: c.env, code: line.code } }, create: { landlordId: prof.landlordId, environment: c.env, code: line.code, ...data }, update: data });
  if (!ok) throw new UraError(`URA wouldn't register "${line.name}" as a service (${rc}: ${rm})`, false, rc);
}

/** Asks URA whether it already has a document with our reference number (T106), and reads it (T108). */
async function findIssued(c: Conn, s: Session, referenceNo: string, paidAt: Date) {
  const day = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  const r = await secure(c, "T106", {
    oriInvoiceNo: "", invoiceNo: "", deviceNo: c.deviceNo, buyerTin: "", buyerLegalName: "", buyerNinBrn: "", combineKeywords: "",
    invoiceType: "", invoiceKind: "", isInvalid: "", isRefund: "", startDate: day(new Date(paidAt.getTime() - 86400_000)), endDate: day(new Date()),
    pageNo: "1", pageSize: "10", referenceNo, branchName: "", queryType: "1", dataSource: "", sellerTinOrNin: c.tin, currencyType: "", invoiceIndustryCode: "",
  }, s);
  if (r.rc !== "00") throw new UraError(`Couldn't check URA for an earlier document (${r.rc}: ${r.rm})`, false, r.rc);
  const d = r.data as { records?: { invoiceNo?: string; referenceNo?: string }[] } | null;
  const hit = (d?.records ?? []).find((x) => !x.referenceNo || x.referenceNo === referenceNo);
  if (!hit?.invoiceNo) return null;
  const det = await secure(c, "T108", { invoiceNo: hit.invoiceNo }, s);
  return readIssued(det.data, c.env === "production") ?? { fdn: hit.invoiceNo, verificationCode: null, invoiceId: null, qr: null };
}

export type UraIssued =
  | { ok: true; fdn: string; verificationCode: string | null; qr: string | null; invoiceId: string | null; test: boolean }
  | { ok: false; error: string; uncertain: boolean; fixable?: boolean };

/** What's missing before a landlord's payments can be issued through URA (null when ready). */
export function notReady(p: EfrisProfile, commercial: boolean) {
  if (!p.deviceNo || !p.keyEnc) return "URA connection not set up (device number and key)";
  if (!p.unitCode) return "No EFRIS measure unit chosen for rent";
  if (!(commercial ? p.commodityCommercial : p.commodityResidential)) return `No EFRIS commodity code for ${commercial ? "commercial" : "residential"} rent`;
  return null;
}

const COMMERCIAL = ["Commercial / shops", "Office"];

/** Issues the EFRIS document for one payment, for the amount actually paid, under the landlord's own TIN. */
export async function uraIssue(paymentId: number, uncertainBefore: boolean): Promise<UraIssued> {
  const p = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: {
      charge: { select: { kind: true, period: true } },
      allocations: { where: { source: "payment" }, include: { charge: { select: { kind: true } } } },
      tenant: { select: { name: true, phone: true, email: true } },
      lease: { select: { rent: true, landlordId: true, landlord: { select: { name: true, phone: true, email: true, businessName: true } }, unit: { select: { id: true, label: true, property: { select: { name: true, type: true, location: true } } } } } },
    },
  });
  const prof = await db.efrisProfile.findUnique({ where: { landlordId: p.lease.landlordId } });
  if (!prof || prof.status !== "registered") return { ok: false, error: "Landlord isn't set up for EFRIS", uncertain: false, fixable: true };
  const commercial = COMMERCIAL.includes(p.lease.unit.property.type);
  const missing = notReady(prof, commercial);
  if (missing) return { ok: false, error: missing, uncertain: false, fixable: true };
  const c = connFor(prof);
  if (typeof c === "string") return { ok: false, error: c, uncertain: false, fixable: true };
  const test = c.env !== "production";
  const referenceNo = p.receiptNo ?? `CVPAY${p.id}`;

  // Lines: what this payment actually paid for (deposits excluded; anything left over counts as rent paid ahead).
  const byKind = new Map<string, number>();
  for (const a of p.allocations) if (a.charge.kind !== "deposit") byKind.set(a.charge.kind, (byKind.get(a.charge.kind) ?? 0) + a.amount);
  const allocated = p.allocations.reduce((s, a) => s + a.amount, 0);
  if (p.allocations.length) { if (p.amount > allocated) byKind.set("rent", (byKind.get("rent") ?? 0) + p.amount - allocated); }
  else if (p.charge.kind !== "deposit") byKind.set(p.charge.kind, p.amount);
  const lines = [...byKind].filter(([, amt]) => amt > 0).map(([kind, amount]) => ({ ...serviceLine(kind, p.lease.unit.id, p.lease.unit.label, commercial), amount }));
  if (!lines.length) return { ok: false, error: "Nothing in this payment needs an EFRIS document (deposit only)", uncertain: false, fixable: true };

  let s: Session;
  try { s = await openSession(c); } catch (e) { return { ok: false, error: (e as Error).message, uncertain: false }; }
  try {
    if (uncertainBefore) {
      const found = await findIssued(c, s, referenceNo, p.paidAt ?? p.createdAt);
      if (found) return { ok: true, ...found, test };
    }
    for (const l of lines) await ensureService(c, s, prof, p.lease.unit.id, l, l.kind === "rent" ? p.lease.rent : l.amount, commercial);
    const dict = (prof.uraDict ?? {}) as Partial<Dict>;
    const tp = taxpayer(s.login);
    const invoice = buildInvoice({
      seller: {
        tin: c.tin, legalName: prof.legalName ?? tp.legalName ?? p.lease.landlord.businessName ?? p.lease.landlord.name,
        businessName: prof.businessName ?? tp.businessName ?? p.lease.landlord.businessName ?? p.lease.landlord.name,
        address: prof.sellerAddress ?? tp.address ?? p.lease.unit.property.location, phone: tp.phone ?? p.lease.landlord.phone, email: tp.email ?? p.lease.landlord.email,
        placeOfBusiness: `${p.lease.unit.property.name}, ${p.lease.unit.property.location}`.slice(0, 500),
      },
      deviceNo: c.deviceNo, referenceNo, issuedAt: p.paidAt ?? new Date(), vatRegistered: prof.vatRegistered,
      ...(() => {
        // URA's treatment for the code in use (an answer for a since-changed code doesn't count).
        const code = commercial ? prof.commodityCommercial : prof.commodityResidential;
        const info = ((prof.commodityTax ?? {}) as Record<string, CommodityTax>)[commercial ? "commercial" : "residential"];
        const t = treatmentFor(prof.vatRegistered, commercial, info?.code === code ? info : null);
        return { treatment: t.treatment, rate: t.rate };
      })(),
      buyer: { name: p.tenant.name, phone: p.tenant.phone, email: p.tenant.email },
      lines: lines.map((l) => ({ name: l.name, code: l.code, amount: l.amount, commodityCode: (commercial ? prof.commodityCommercial : prof.commodityResidential)!, commodityName: (commercial ? prof.commodityCommercialName : prof.commodityResidentialName) ?? "" })),
      unitOfMeasure: prof.unitCode!, payMode: payModeFor(p.method, dict.payWays ?? []), operator: "CasaVilla",
      remarks: `${p.lease.unit.property.name} · ${p.lease.unit.label} · CasaVilla receipt ${referenceNo}`,
    });
    const r = await secure(c, "T109", invoice, s);
    if (r.rc !== "00") return { ok: false, error: `URA refused the document (${r.rc}: ${r.rm})`, uncertain: false };
    const got = readIssued(r.data, c.env === "production");
    if (got) return { ok: true, ...got, test };
    // Accepted but we couldn't read the number: look it up rather than send again.
    const found = await findIssued(c, s, referenceNo, p.paidAt ?? p.createdAt).catch(() => null);
    return found ? { ok: true, ...found, test } : { ok: false, error: "URA accepted the document but its number couldn't be read; checking again later", uncertain: true };
  } catch (e) {
    const err = e as UraError;
    return { ok: false, error: err.message, uncertain: uncertainBefore || !!err.sent };
  }
}


/** URA's tax treatment for one commodity code (T124, commodity category query). */
async function commodityInfo(c: Conn, s: Session, code: string): Promise<CommodityTax | null> {
  const r = await secure(c, "T124", { categoryCode: code, categoryName: "", categoryLevel: "", parentCode: "", pageNo: "1", pageSize: "10" }, s);
  if (r.rc !== "00") throw new UraError(`URA's commodity list didn't answer (${r.rc}: ${r.rm})`, false, r.rc);
  return readCommodity(r.data, code);
}

/** Re-reads URA's tax treatment for a landlord's commodity codes without a full connection test. */
export async function refreshCommodityTax(landlordId: number) {
  const prof = await db.efrisProfile.findUnique({ where: { landlordId } });
  const c = prof && connFor(prof);
  if (!prof || !c || typeof c === "string") return null;
  const s = await openSession(c);
  const tax: Record<string, CommodityTax> = {};
  for (const [k, code] of [["residential", prof.commodityResidential], ["commercial", prof.commodityCommercial]] as const) {
    if (code) { const info = await commodityInfo(c, s, code).catch(() => null); if (info) tax[k] = info; }
  }
  await db.efrisProfile.update({ where: { landlordId }, data: { commodityTax: tax as never } });
  return tax;
}

// ---------------------------------------------------------------------------------------------------------------
// Credit notes: apply (T110) → URA approves (T111) → it gets its own FDN. Withdraw a pending one (T120);
// cancel an approved one (T114).

type CreditResult = { status: string; applicationRef?: string | null; applicationId?: string | null; fdn?: string | null; verificationCode?: string | null; invoiceId?: string | null; error?: string | null };

async function creditContext(noteId: number) {
  const n = await db.efrisCreditNote.findUniqueOrThrow({
    where: { id: noteId },
    include: { receipt: { include: { payment: { select: { method: true, tenant: { select: { name: true, phone: true, email: true } } } } } }, profile: true },
  });
  const c = connFor(n.profile);
  if (typeof c === "string") throw new UraError(c);
  return { n, c, s: await openSession(c) };
}

/** Sends the credit note application for the original document's lines. */
export async function uraCreditApply(noteId: number): Promise<CreditResult> {
  const { n, c, s } = await creditContext(noteId);
  const r = n.receipt;
  const orig = await secure(c, "T108", { invoiceNo: r.fdn }, s);
  if (orig.rc !== "00") return { status: "failed", error: `Couldn't read the original document from URA (${orig.rc}: ${orig.rm})` };
  const bi = ((orig.data ?? {}) as { basicInformation?: { invoiceId?: string } }).basicInformation ?? {};
  const dict = (n.profile.uraDict ?? {}) as Partial<Dict>;
  const body = buildCreditNote({
    original: orig.data, oriInvoiceId: String(bi.invoiceId ?? r.invoiceId ?? ""), oriInvoiceNo: r.fdn, amount: n.amount,
    reasonCode: n.reasonCode, reason: n.reason ?? "", appliedAt: new Date(), referenceNo: `CVCN${n.id}`,
    payMode: payModeFor(r.payment.method, dict.payWays ?? []), contact: { name: n.profile.legalName ?? "CasaVilla", phone: null, email: null },
  });
  const res = await secure(c, "T110", body, s);
  if (res.rc !== "00") return { status: "failed", error: `URA refused the credit note (${res.rc}: ${res.rm})` };
  const d = (res.data ?? {}) as { referenceNo?: string; id?: string };
  return { status: "pending", applicationRef: d.referenceNo ?? null, applicationId: d.id ?? null };
}

/** Asks URA how the application stands; once approved, reads the credit note's FDN and verification code. */
export async function uraCreditCheck(noteId: number): Promise<CreditResult> {
  const { n, c, s } = await creditContext(noteId);
  const day = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);
  const q = await secure(c, "T111", {
    referenceNo: n.applicationRef ?? "", oriInvoiceNo: n.receipt.fdn, invoiceNo: "", combineKeywords: "", approveStatus: "", queryType: "1",
    invoiceApplyCategoryCode: "101", startDate: day(new Date(n.createdAt.getTime() - 86400_000)), endDate: day(new Date()), pageNo: "1", pageSize: "20",
  }, s);
  if (q.rc !== "00") return { status: n.status, error: `Couldn't check the credit note with URA (${q.rc}: ${q.rm})` };
  const st = readCreditStatus(q.data, n.applicationRef ?? "");
  if (!st) return { status: n.status };
  if (n.status === "cancelling") {
    // The cancellation is approved when URA marks the credit note itself invalid.
    if (!n.fdn) return { status: n.status };
    const det = await secure(c, "T108", { invoiceNo: n.fdn }, s);
    const inv = String(((det.data ?? {}) as { basicInformation?: { isInvalid?: string } }).basicInformation?.isInvalid ?? "");
    return { status: inv === "1" ? "cancelled" : "cancelling" };
  }
  if (st.status !== "approved" || !st.fdn) return { status: st.status, applicationId: st.id, error: st.status === "rejected" ? st.note : null };
  const det = await secure(c, "T108", { invoiceNo: st.fdn }, s);
  const got = readIssued(det.data, c.env === "production");
  return { status: "approved", applicationId: st.id, fdn: st.fdn, verificationCode: got?.verificationCode ?? null, invoiceId: got?.invoiceId ?? null };
}

/** Withdraws an application URA hasn't decided yet. */
export async function uraCreditWithdraw(noteId: number): Promise<CreditResult> {
  const { n, c, s } = await creditContext(noteId);
  const r = await secure(c, "T120", { businessKey: n.applicationId ?? "", referenceNo: n.applicationRef ?? "" }, s);
  return r.rc === "00" ? { status: "withdrawn" } : { status: n.status, error: `URA wouldn't withdraw it (${r.rc}: ${r.rm})` };
}

/** Applies to cancel an approved credit note. */
export async function uraCreditCancel(noteId: number, reason: string): Promise<CreditResult> {
  const { n, c, s } = await creditContext(noteId);
  const r = await secure(c, "T114", { oriInvoiceId: n.invoiceId ?? "", invoiceNo: n.fdn ?? "", reason: reason.slice(0, 1024), reasonCode: "102", invoiceApplyCategoryCode: "104" }, s);
  return r.rc === "00" ? { status: "cancelling" } : { status: n.status, error: `URA refused the cancellation (${r.rc}: ${r.rm})` };
}
