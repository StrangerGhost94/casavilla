import crypto from "node:crypto";
import zlib from "node:zlib";
import forge from "node-forge";

/**
 * URA EFRIS system-to-system: the cryptography and message formats, kept free of the database so they can be
 * unit-tested. The network side (sessions, issuing) is in lib/efris-ura.ts.
 *
 * How URA's interface works:
 * - every call is a JSON envelope POSTed to one URL; `globalInfo.interfaceCode` says what it is (T101 time,
 *   T104 key exchange, T103 login, T109 invoice upload, T130 goods/services registration, T115 dictionary,
 *   T106 invoice search, T108 invoice details);
 * - T104 returns a session AES key encrypted with the taxpayer's RSA public key (registered with URA); we decrypt
 *   it with their private key;
 * - after that, the content of each call is AES-ECB encrypted with that key, base64'd, and signed (SHA1withRSA)
 *   with the private key.
 */

// ---------------------------------------------------------------------------------------------------------------
// Storing landlords' private keys: AES-256-GCM under EFRIS_KEY_SECRET (a Railway variable), never plain.

function masterKey(secret = process.env.EFRIS_KEY_SECRET) {
  if (!secret || secret.length < 32) throw new Error("EFRIS_KEY_SECRET is not set (it must be a long random value of at least 32 characters)");
  return crypto.createHash("sha256").update(`casavilla-efris-key:${secret}`).digest();
}
export const canStoreKeys = () => (process.env.EFRIS_KEY_SECRET?.length ?? 0) >= 32;

/** Encrypts a private key for the database: "v1.<iv>.<tag>.<ciphertext>" (base64). */
export function sealKey(pem: string, secret?: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", masterKey(secret), iv);
  const ct = Buffer.concat([c.update(pem, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(".");
}
export function openKey(sealed: string, secret?: string) {
  const [v, iv, tag, ct] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Stored EFRIS key is in an unknown format");
  const d = crypto.createDecipheriv("aes-256-gcm", masterKey(secret), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}

/** Short fingerprint of a key's public half, so people can tell keys apart without seeing them. */
export function keyFingerprint(privatePem: string) {
  const pub = crypto.createPublicKey(crypto.createPrivateKey(privatePem)).export({ type: "spki", format: "der" });
  return crypto.createHash("sha256").update(pub).digest("hex").slice(0, 16).replace(/(.{4})(?!$)/g, "$1:");
}
export function publicKeyPem(privatePem: string) {
  return crypto.createPublicKey(crypto.createPrivateKey(privatePem)).export({ type: "spki", format: "pem" }).toString();
}

/** A fresh 2048-bit RSA key pair: the private key stays with CasaVilla, the public key is uploaded to URA. */
export function newKeyPair() {
  const { privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

/**
 * Turns an uploaded key file into an unencrypted PKCS#8 PEM (which is then sealed). Accepts PEM (encrypted or not,
 * PKCS#1 or PKCS#8), DER, and PKCS#12 keystores (.p12 / .pfx, as URA's tools produce) with their password.
 */
export function normalizePrivateKey(file: Buffer, passphrase = ""): string {
  const text = file.toString("utf8");
  const asRsa = (k: crypto.KeyObject) => {
    if (k.asymmetricKeyType !== "rsa") throw new Error("This is not an RSA key. EFRIS uses RSA keys.");
    return k.export({ type: "pkcs8", format: "pem" }).toString();
  };
  if (text.includes("-----BEGIN")) {
    if (!/PRIVATE KEY-----/.test(text)) throw new Error("This file holds a certificate or public key, not the private key");
    try { return asRsa(crypto.createPrivateKey({ key: text.replace(/\\n/g, "\n"), format: "pem", ...(passphrase ? { passphrase } : {}) })); }
    catch (e) { throw new Error(/passphrase|decrypt|bad/i.test(String(e)) ? "Wrong password for this key file" : "Couldn't read this key file"); }
  }
  // PKCS#12 (.p12 / .pfx)
  try {
    const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(file.toString("binary"))), passphrase);
    const bags = [
      ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
    ];
    const key = bags.find((b) => b.key)?.key;
    if (!key) throw new Error("No private key inside this keystore");
    return asRsa(crypto.createPrivateKey(forge.pki.privateKeyToPem(key)));
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    if (/No private key/.test(msg)) throw e;
    if (/password|MAC|Invalid/i.test(msg) && file[0] === 0x30) {
      // could still be plain DER; try that before blaming the password
      for (const type of ["pkcs8", "pkcs1"] as const) {
        try { return asRsa(crypto.createPrivateKey({ key: file, format: "der", type })); } catch { /* next */ }
      }
      throw new Error("Wrong password for this keystore, or it isn't a key file");
    }
  }
  for (const type of ["pkcs8", "pkcs1"] as const) {
    try { return asRsa(crypto.createPrivateKey({ key: file, format: "der", type })); } catch { /* next */ }
  }
  throw new Error("Couldn't read this key file. Upload the private key (.pem, .key, .p12 or .pfx).");
}

// ---------------------------------------------------------------------------------------------------------------
// Session key and message encryption

/** PKCS#1 v1.5 decryption done by hand (OpenSSL 3 in Node 20+ refuses RSA_PKCS1_PADDING for decryption). */
function pkcs1v15Decrypt(key: crypto.KeyObject, enc: Buffer) {
  const raw = crypto.privateDecrypt({ key, padding: crypto.constants.RSA_NO_PADDING }, enc);
  if (raw[0] !== 0x00 || raw[1] !== 0x02) throw new Error("not PKCS1 v1.5");
  const sep = raw.indexOf(0x00, 2);
  if (sep < 10) throw new Error("not PKCS1 v1.5");
  return raw.subarray(sep + 1);
}

/** Decrypts T104's `passowrdDes` into the session AES key (16, 24 or 32 bytes). */
export function sessionAesKey(passwordDes: string, privatePem: string): Buffer {
  const key = crypto.createPrivateKey(privatePem);
  const enc = Buffer.from(passwordDes, "base64");
  const tries: (() => Buffer)[] = [
    () => pkcs1v15Decrypt(key, enc),
    () => crypto.privateDecrypt({ key, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha1" }, enc),
  ];
  for (const t of tries) {
    try {
      const dec = t();
      const b64 = Buffer.from(dec.toString("utf8").trim(), "base64");
      if ([16, 24, 32].includes(b64.length)) return b64;
      if ([16, 24, 32].includes(dec.length)) return dec;
      // Some devices get an 8-byte seed, used doubled as a 16-byte key.
      if (b64.length === 8) return Buffer.concat([b64, b64]);
      if (dec.length === 8) return Buffer.concat([dec, dec]);
    } catch { /* next */ }
  }
  throw new Error("Couldn't decrypt URA's session key with this landlord's private key. The key uploaded here must match the public key registered with URA for this device.");
}

const algo = (k: Buffer) => (k.length === 32 ? "aes-256-ecb" : k.length === 24 ? "aes-192-ecb" : "aes-128-ecb");
export function aesEncrypt(plain: string, key: Buffer) {
  const c = crypto.createCipheriv(algo(key), key, null);
  return Buffer.concat([c.update(plain, "utf8"), c.final()]).toString("base64");
}
export function aesDecrypt(b64: string, key: Buffer) {
  const d = crypto.createDecipheriv(algo(key), key, null);
  return Buffer.concat([d.update(Buffer.from(b64, "base64")), d.final()]);
}
export const signContent = (contentB64: string, privatePem: string) => crypto.createSign("RSA-SHA1").update(contentB64, "utf8").sign(privatePem, "base64");

/**
 * Reads a response's `data.content` into JSON. URA varies the encoding by interface (plain base64, gzip, AES,
 * gzip inside AES or AES inside gzip), so every combination is tried.
 */
export function decodeContent(b64: string | undefined | null, key?: Buffer | null): unknown {
  if (!b64) return null;
  const raw = Buffer.from(b64, "base64");
  const Z = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
  const json = (b: Buffer) => {
    const s = b.toString("utf8").trim();
    if (!s || !"{[".includes(s[0])) return undefined;
    try { return JSON.parse(s); } catch {
      const cut = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
      try { return cut > 0 ? JSON.parse(s.slice(0, cut + 1)) : undefined; } catch { return undefined; }
    }
  };
  const tries: (() => Buffer)[] = [
    () => raw,
    () => zlib.gunzipSync(raw, Z),
    ...(key ? [() => aesDecrypt(b64, key), () => zlib.gunzipSync(aesDecrypt(b64, key), Z), () => aesDecrypt(zlib.gunzipSync(raw, Z).toString("base64"), key)] : []),
  ];
  for (const t of tries) {
    try { const v = json(t()); if (v !== undefined) return v; } catch { /* next */ }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Envelopes

/** "yyyy-MM-dd HH:mm:ss" in Uganda time, whatever the server's time zone. */
export const eatStamp = (d = new Date()) => new Date(d.getTime() + 3 * 3600_000).toISOString().replace("T", " ").slice(0, 19);

export type Device = { tin: string; deviceNo: string };
export type Envelope = ReturnType<typeof plainEnvelope>;

export function plainEnvelope(code: string, dev: Device, content = "") {
  return {
    data: { content: Buffer.from(content).toString("base64"), signature: null as string | null, dataDescription: { codeType: "0", encryptCode: "1", zipCode: "0" } },
    globalInfo: {
      appId: "AP04", version: "1.1.20191201", dataExchangeId: crypto.randomUUID().replace(/-/g, "").slice(0, 32),
      interfaceCode: code, requestCode: "TP", requestTime: eatStamp(), responseCode: "TA",
      userName: dev.tin, deviceMAC: "FFFFFFFFFFFF", deviceNo: dev.deviceNo, tin: dev.tin, brn: "", taxpayerID: "1",
      longitude: "32.5525", latitude: "0.3070", agentType: "0", extendField: { responsePaddingInfo: "0" },
    },
    returnStateInfo: { returnCode: "", returnMessage: "" },
  };
}

export function encryptedEnvelope(code: string, dev: Device, payload: unknown, aesKey: Buffer, privatePem: string) {
  const env = plainEnvelope(code, dev);
  const content = aesEncrypt(JSON.stringify(payload), aesKey);
  env.data = { content, signature: signContent(content, privatePem), dataDescription: { codeType: "1", encryptCode: "2", zipCode: "0" } };
  return env;
}

// ---------------------------------------------------------------------------------------------------------------
// Rent as an EFRIS service line, and the T109 invoice

export const LINE_NAME: Record<string, string> = {
  rent: "Rent", late_fee: "Late payment fee", utility: "Utility recharge", repair: "Repair recharge", other: "Other charges",
};
const KIND_CODE: Record<string, string> = { rent: "RENT", late_fee: "LATE", utility: "UTIL", repair: "REPR", other: "OTHR" };

/** The service registered with URA for a kind of charge on one unit, e.g. "Residential Rent - Unit 3B" / CV12-RENT. */
export function serviceLine(kind: string, unitId: number, unitLabel: string, commercial: boolean) {
  const k = KIND_CODE[kind] ? kind : "other";
  const label = unitLabel.trim().replace(/^unit\s+/i, "");
  const base = k === "rent" ? `${commercial ? "Commercial" : "Residential"} Rent` : LINE_NAME[k];
  return { kind: k, code: `CV${unitId}-${KIND_CODE[k]}`, name: `${base} - Unit ${label}`.slice(0, 100) };
}

export type TaxTreatment = "standard" | "zero" | "exempt" | "oos";
/** Fallback before URA has been asked: VAT-registered landlords' commercial rent is 18%, residential exempt; others out of scope. */
export const taxTreatment = (vatRegistered: boolean, commercial: boolean): TaxTreatment => (!vatRegistered ? "oos" : commercial ? "standard" : "exempt");

/** URA's tax treatment of one commodity code (from T124). */
export type CommodityTax = { code: string; name: string; rate: number | null; exempt: boolean; zero: boolean; leaf: boolean; checkedAt: string };

/** The treatment URA's commodity list gives, for a VAT-registered landlord; the fixed rule only when URA hasn't said. */
export function treatmentFor(vatRegistered: boolean, commercial: boolean, info?: CommodityTax | null): { treatment: TaxTreatment; rate: number } {
  if (!vatRegistered) return { treatment: "oos", rate: 0 };
  if (!info) { const t = taxTreatment(true, commercial); return { treatment: t, rate: t === "standard" ? 0.18 : 0 }; }
  if (info.exempt) return { treatment: "exempt", rate: 0 };
  if (info.zero || info.rate === 0) return { treatment: "zero", rate: 0 };
  return { treatment: "standard", rate: info.rate ?? 0.18 };
}

/** How a treatment reads to people, e.g. "Standard rate 18%". */
export const treatmentLabel = (t: { treatment: TaxTreatment; rate: number }) =>
  t.treatment === "standard" ? `Standard rate ${Math.round(t.rate * 1000) / 10}%` : t.treatment === "zero" ? "Zero-rated (0%)" : t.treatment === "exempt" ? "Exempt" : "Out of scope (not VAT-registered)";

/** Reads URA's T124 answer for one commodity code. Flags come as "101" (yes) / "102" (no). */
export function readCommodity(content: unknown, code: string): CommodityTax | null {
  const d = (content ?? {}) as Record<string, unknown>;
  const rows = (Array.isArray(d.records) ? d.records : Array.isArray(content) ? content : []) as Record<string, unknown>[];
  const r = rows.find((x) => String(x.commodityCategoryCode ?? x.categoryCode ?? x.code ?? "") === code) ?? (rows.length === 1 ? rows[0] : null);
  if (!r) return null;
  const yes = (v: unknown) => v === true || v === "101" || v === "1" || v === "Y";
  const rateRaw = String(r.rate ?? r.taxRate ?? "").trim();
  const rate = rateRaw === "" || rateRaw === "-" ? null : Number(rateRaw.replace("%", "")) > 1 ? Number(rateRaw.replace("%", "")) / 100 : Number(rateRaw);
  return {
    code, name: String(r.commodityCategoryName ?? r.categoryName ?? r.name ?? ""),
    rate: rate != null && Number.isFinite(rate) ? rate : null,
    exempt: yes(r.isExempt), zero: yes(r.isZeroRate), leaf: r.isLeafNode == null ? true : yes(r.isLeafNode),
    checkedAt: new Date().toISOString(),
  };
}

const TAX: Record<TaxTreatment, { taxRule: string; cat: string; vatFlag: string }> = {
  standard: { taxRule: "STANDARD", cat: "01", vatFlag: "1" },
  zero: { taxRule: "ZERO", cat: "02", vatFlag: "1" },
  exempt: { taxRule: "EXEMPT", cat: "03", vatFlag: "1" },
  oos: { taxRule: "OOS", cat: "05", vatFlag: "2" },
};
const rateText = (t: TaxTreatment, rate: number) => (t === "standard" ? String(rate) : t === "zero" ? "0" : "-");
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
/** VAT inside a VAT-inclusive amount (18% unless URA says otherwise). */
export const vatInside = (gross: number, rate = 0.18) => Math.round((gross - gross / (1 + rate)) * 100) / 100;

export type InvoiceInput = {
  seller: { tin: string; legalName: string; businessName: string; address: string; phone: string; email: string; placeOfBusiness: string };
  deviceNo: string;
  referenceNo: string;
  issuedAt: Date;
  vatRegistered: boolean;
  treatment: TaxTreatment;
  /** Standard rate from URA's commodity list (default 18%). */
  rate?: number;
  buyer: { name: string; phone?: string | null; email?: string | null; tin?: string | null };
  lines: { name: string; code: string; amount: number; commodityCode: string; commodityName: string }[];
  unitOfMeasure: string;
  payMode: string;
  operator: string;
  remarks: string;
};

/** The T109 "upload invoice" payload for the amount actually paid. */
export function buildInvoice(i: InvoiceInput) {
  const rate = i.rate ?? 0.18;
  const t = { ...TAX[i.treatment], taxRate: rateText(i.treatment, rate) };
  const goodsDetails = i.lines.map((l, n) => ({
    item: l.name, itemCode: l.code, qty: "1", unitOfMeasure: i.unitOfMeasure,
    unitPrice: money(l.amount), total: money(l.amount),
    taxRate: t.taxRate, taxRule: t.taxRule, tax: i.treatment === "standard" ? money(vatInside(l.amount, rate)) : "0",
    discountTotal: "", discountTaxRate: "", orderNumber: String(n), discountFlag: "2", deemedFlag: "2", exciseFlag: "2",
    categoryId: "", categoryName: "", goodsCategoryId: l.commodityCode, goodsCategoryName: l.commodityName, vatApplicableFlag: t.vatFlag,
  }));
  const gross = i.lines.reduce((s, l) => s + l.amount, 0);
  const tax = goodsDetails.reduce((s, g) => s + Number(g.tax), 0);
  const tin = (i.buyer.tin ?? "").replace(/\D/g, "");
  return {
    sellerDetails: {
      tin: i.seller.tin, ninBrn: "", legalName: i.seller.legalName, businessName: i.seller.businessName, address: i.seller.address,
      mobilePhone: i.seller.phone, linePhone: "", emailAddress: i.seller.email, placeOfBusiness: i.seller.placeOfBusiness, referenceNo: i.referenceNo,
    },
    basicInformation: {
      invoiceNo: "", antifakeCode: "", deviceNo: i.deviceNo, issuedDate: eatStamp(i.issuedAt), operator: i.operator.slice(0, 100), currency: "UGX",
      oriInvoiceId: "", invoiceType: "1", invoiceKind: i.vatRegistered ? "1" : "2", dataSource: "103", invoiceIndustryCode: "101", isBatch: "0", isRefund: "0",
    },
    buyerDetails: {
      buyerTin: tin.length === 10 ? tin : "", buyerNinBrn: "", buyerPassportNum: "", buyerLegalName: i.buyer.name, buyerBusinessName: i.buyer.name, buyerAddress: "",
      buyerEmail: i.buyer.email ?? "", buyerMobilePhone: i.buyer.phone ?? "", buyerLinePhone: "", buyerPlaceOfBusi: "",
      buyerType: tin.length === 10 ? "0" : "1", buyerCitizenship: "", buyerSector: "", buyerReferenceNo: "",
    },
    goodsDetails,
    // Non-VAT e-receipts carry no tax categories.
    taxDetails: i.vatRegistered ? [{ taxCategoryCode: t.cat, netAmount: money(gross - tax), taxRate: t.taxRate, taxAmount: money(tax), grossAmount: money(gross) }] : [],
    summary: { netAmount: money(gross - tax), taxAmount: money(tax), grossAmount: money(gross), itemCount: String(goodsDetails.length), modeCode: "1", remarks: i.remarks.slice(0, 500), qrCode: "" },
    payWay: [{ paymentMode: i.payMode, paymentAmount: money(gross), orderNumber: "1" }],
    extend: {},
  };
}

/** The T130 payload registering one service line. */
export function buildService(s: { code: string; name: string; price: number; unitOfMeasure: string; currency: string; commodityCode: string; commodityName: string }) {
  return [{
    operationType: "101", goodsCode: s.code, goodsName: s.name, goodsTypeCode: "101", measureUnit: s.unitOfMeasure,
    unitPrice: String(Math.max(1, Math.round(s.price))), currency: s.currency,
    commodityCategoryId: s.commodityCode, commodityCategoryName: s.commodityName, haveExciseTax: "102", description: s.name,
    stockPrewarning: "0", pricingMode: "1", havePieceUnit: "102", pieceUnit: "", packageScaledValue: "", scaledValue: "", discountTaxRate: "",
  }];
}

/** URA's reasons for a credit note. */
export const CREDIT_REASONS: Record<string, string> = {
  "102": "Rent refunded / tenancy cancelled",
  "103": "Amount was wrongly stated",
  "104": "Part or all of it waived",
  "105": "Other reason",
  "101": "Returned (goods)",
};

type OriginalLine = { item?: string; itemCode?: string; qty?: string; unitOfMeasure?: string; unitPrice?: string; total?: string; taxRate?: string; tax?: string; orderNumber?: string; goodsCategoryId?: string; goodsCategoryName?: string; vatApplicableFlag?: string; taxRule?: string };

/**
 * T110 credit note application for `amount` against an issued document, built from that document's own lines
 * (as T108 returns them): lines are credited in order until the amount is used up; a partly credited line keeps
 * its unit price and gets a fractional (negative) quantity, with its tax credited pro rata.
 */
export function buildCreditNote(o: {
  original: unknown; oriInvoiceId: string; oriInvoiceNo: string; amount: number; reasonCode: string; reason: string;
  appliedAt: Date; referenceNo: string; payMode: string; contact: { name: string; phone?: string | null; email?: string | null };
}) {
  const d = (o.original ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const lines = ((d.goodsDetails ?? []) as OriginalLine[]).filter((g) => Number(g.total) > 0);
  if (!lines.length) throw new Error("The original document's lines couldn't be read");
  let left = Math.round(o.amount * 100) / 100;
  const goodsDetails: Record<string, string>[] = [];
  for (const g of lines) {
    if (left <= 0) break;
    const total = Number(g.total), price = Number(g.unitPrice) || total, qty = Number(g.qty) || 1;
    const credit = Math.min(left, total);
    const share = credit / total;
    const tax = Math.round(Number(g.tax || 0) * share * 100) / 100;
    goodsDetails.push({
      item: g.item ?? "", itemCode: g.itemCode ?? "", qty: String(-Number((qty * share).toFixed(8))), unitOfMeasure: g.unitOfMeasure ?? "",
      unitPrice: money(price), total: money(-credit), taxRate: g.taxRate ?? "-", tax: money(-tax), orderNumber: String(goodsDetails.length),
      deemedFlag: "2", exciseFlag: "2", categoryId: "", categoryName: "", goodsCategoryId: g.goodsCategoryId ?? "", goodsCategoryName: g.goodsCategoryName ?? "",
      exciseRate: "", exciseRule: "", exciseTax: "", pack: "", stick: "", exciseUnit: "", exciseCurrency: "", exciseRateName: "", vatApplicableFlag: g.vatApplicableFlag ?? "1",
    });
    left = Math.round((left - credit) * 100) / 100;
  }
  if (left > 0.009) throw new Error("The credit is more than the original document");
  const gross = goodsDetails.reduce((s, g) => s + Number(g.total), 0);
  const tax = goodsDetails.reduce((s, g) => s + Number(g.tax), 0);
  const origTax = (d.taxDetails ?? [])[0] as { taxCategoryCode?: string; taxRate?: string } | undefined;
  return {
    oriInvoiceId: o.oriInvoiceId, oriInvoiceNo: o.oriInvoiceNo, reasonCode: o.reasonCode, reason: o.reasonCode === "105" ? o.reason.slice(0, 1024) : "",
    applicationTime: eatStamp(o.appliedAt), invoiceApplyCategoryCode: "101", currency: "UGX",
    contactName: o.contact.name.slice(0, 100), contactMobileNum: o.contact.phone ?? "", contactEmail: o.contact.email ?? "",
    source: "103", remarks: o.reason.slice(0, 500), sellersReferenceNo: o.referenceNo,
    goodsDetails,
    taxDetails: origTax ? [{ taxCategoryCode: origTax.taxCategoryCode ?? "", netAmount: money(gross - tax), taxRate: origTax.taxRate ?? "-", taxAmount: money(tax), grossAmount: money(gross), exciseUnit: "", exciseCurrency: "", taxRateName: "" }] : [],
    summary: { netAmount: money(gross - tax), taxAmount: money(tax), grossAmount: money(gross), itemCount: String(goodsDetails.length), modeCode: "0", qrCode: "" },
    payWay: [{ paymentMode: o.payMode, paymentAmount: money(gross), orderNumber: "a" }],
    buyerType: "1",
  };
}

/** URA's application status (T111): 101 approved · 102 submitted · 103 rejected · 104 voided. */
export function readCreditStatus(content: unknown, referenceNo: string) {
  const d = (content ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const rows = (Array.isArray(d.records) ? d.records : Array.isArray(content) ? content : []) as Record<string, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  const r = rows.find((x) => String(x.referenceNo ?? "") === referenceNo) ?? (rows.length === 1 ? rows[0] : null);
  if (!r) return null;
  const code = String(r.approveStatus ?? r.approveStatusCode ?? "");
  const status = code === "101" ? "approved" : code === "103" ? "rejected" : code === "104" ? "withdrawn" : "pending";
  const fdn = String(r.invoiceNo ?? r.creditNoteNo ?? "").trim();
  return { status, id: String(r.id ?? "") || null, fdn: fdn && fdn !== String(r.oriInvoiceNo ?? "") ? fdn : null, note: String(r.approveRemark ?? r.remarks ?? "") || null } as const;
}

export function validationUrl(fdn: string, code: string, production: boolean) {
  const base = production ? "https://efris.ura.go.ug/site_mobile/#/invoiceValidation" : "https://efristest.ura.go.ug/site_new/#/invoiceValidation";
  return `${base}?invoiceNo=${encodeURIComponent(fdn)}&antiFakeCode=${encodeURIComponent(code)}`;
}

/** Reads the FDN, verification code, invoice id and QR from a T109 (or T108) response's decoded content. */
export function readIssued(content: unknown, production: boolean) {
  const d = (content ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const bi = d.basicInformation ?? {};
  const sm = d.summary ?? {};
  const fdn = String(bi.invoiceNo ?? d.invoiceNo ?? d.fdn ?? "").trim();
  const code = String(bi.antifakeCode ?? bi.antiFakeCode ?? d.antifakeCode ?? d.antiFakeCode ?? "").trim();
  if (!fdn) return null;
  return {
    fdn, verificationCode: code || null, invoiceId: String(bi.invoiceId ?? d.invoiceId ?? "") || null,
    qr: String(sm.qrCode ?? d.qrCode ?? "") || (code ? validationUrl(fdn, code, production) : null),
  };
}

/** Finds a dictionary section (T115) by trying likely names, then any array whose rows look right. */
export function dictSection(dict: unknown, names: string[]): { value: string; name: string }[] {
  const d = (dict ?? {}) as Record<string, unknown>;
  const rows = names.map((n) => d[n]).find(Array.isArray) as Record<string, unknown>[] | undefined;
  return (rows ?? []).map((r) => ({ value: String(r.value ?? r.code ?? ""), name: String(r.name ?? r.description ?? "") })).filter((r) => r.value);
}

/** EFRIS payment-mode code for how the tenant paid, from URA's dictionary when we have it. */
export function payModeFor(method: string, payWays: { value: string; name: string }[]) {
  const want = method === "cash" ? /cash/i : method === "bank" ? /eft|electronic|bank|transfer/i : /mobile/i;
  return payWays.find((p) => want.test(p.name))?.value ?? (method === "cash" ? "102" : method === "bank" ? "107" : "105");
}
