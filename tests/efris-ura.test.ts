// EFRIS system-to-system: key storage, URA's session-key exchange, message encryption/signing, and the T109/T130 payloads.
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import zlib from "node:zlib";
import forge from "node-forge";
import {
  aesDecrypt, aesEncrypt, buildInvoice, buildService, decodeContent, dictSection, encryptedEnvelope, keyFingerprint, newKeyPair,
  normalizePrivateKey, openKey, payModeFor, publicKeyPem, readIssued, sealKey, serviceLine, sessionAesKey, taxTreatment, vatInside,
} from "../src/lib/efris-crypto";

const SECRET = "x".repeat(40);
const pem = newKeyPair();

test("private keys are sealed (AES-256-GCM) and only open with the same secret", () => {
  const sealed = sealKey(pem, SECRET);
  assert.ok(sealed.startsWith("v1."));
  assert.ok(!sealed.includes("PRIVATE KEY"));
  assert.equal(openKey(sealed, SECRET), pem);
  assert.throws(() => openKey(sealed, "y".repeat(40)));
  assert.throws(() => sealKey(pem, "short"));
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => openKey(parts.join("."), SECRET));
});

test("key files: PEM, encrypted PEM, DER and PKCS#12 all become the same PKCS#8 key", () => {
  const k = crypto.createPrivateKey(pem);
  const fp = keyFingerprint(pem);
  const pkcs1 = k.export({ type: "pkcs1", format: "pem" }).toString();
  assert.equal(keyFingerprint(normalizePrivateKey(Buffer.from(pkcs1))), fp);
  const enc = k.export({ type: "pkcs8", format: "pem", cipher: "aes-256-cbc", passphrase: "pw123" }).toString();
  assert.equal(keyFingerprint(normalizePrivateKey(Buffer.from(enc), "pw123")), fp);
  assert.throws(() => normalizePrivateKey(Buffer.from(enc), "wrong"), /Wrong password/);
  const der = k.export({ type: "pkcs8", format: "der" }) as Buffer;
  assert.equal(keyFingerprint(normalizePrivateKey(der)), fp);
  // .pfx with a self-signed certificate, as key tools produce
  const fk = forge.pki.privateKeyFromPem(pem);
  const cert = forge.pki.createCertificate();
  cert.publicKey = forge.pki.setRsaPublicKey(fk.n, fk.e);
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(); cert.validity.notAfter = new Date(Date.now() + 86400_000);
  cert.setSubject([{ name: "commonName", value: "test" }]); cert.setIssuer([{ name: "commonName", value: "test" }]);
  cert.sign(fk);
  const p12 = Buffer.from(forge.asn1.toDer(forge.pkcs12.toPkcs12Asn1(fk, [cert], "pfxpass", { algorithm: "3des" })).getBytes(), "binary");
  assert.equal(keyFingerprint(normalizePrivateKey(p12, "pfxpass")), fp);
  assert.throws(() => normalizePrivateKey(p12, "nope"));
  assert.throws(() => normalizePrivateKey(Buffer.from(publicKeyPem(pem))), /not the private key/);
});

test("T104: URA's encrypted session key is recovered with the landlord's private key", () => {
  const pub = crypto.createPublicKey(pem);
  for (const len of [16, 32]) {
    const aes = crypto.randomBytes(len);
    // URA encrypts base64(aesKey) with RSA PKCS#1 v1.5
    const des = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(aes.toString("base64"))).toString("base64");
    assert.deepEqual(sessionAesKey(des, pem), aes);
  }
  const seed = crypto.randomBytes(8);
  const des8 = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(seed.toString("base64"))).toString("base64");
  assert.deepEqual(sessionAesKey(des8, pem), Buffer.concat([seed, seed]));
  const other = newKeyPair();
  const des = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(crypto.randomBytes(16).toString("base64"))).toString("base64");
  assert.throws(() => sessionAesKey(des, other), /must match the public key/);
});

test("encrypted envelope: AES-ECB content, SHA1withRSA signature over the base64", () => {
  const key = crypto.randomBytes(16);
  const env = encryptedEnvelope("T109", { tin: "1000123456", deviceNo: "1000123456_01" }, { hello: "world" }, key, pem);
  assert.equal(env.globalInfo.interfaceCode, "T109");
  assert.equal(env.globalInfo.tin, "1000123456");
  assert.deepEqual(env.data.dataDescription, { codeType: "1", encryptCode: "2", zipCode: "0" });
  assert.equal(aesDecrypt(env.data.content, key).toString(), '{"hello":"world"}');
  assert.ok(crypto.createVerify("RSA-SHA1").update(env.data.content).verify(crypto.createPublicKey(pem), env.data.signature!, "base64"));
  assert.match(env.globalInfo.requestTime, /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
});

test("responses decode whether plain, gzipped, AES or AES+gzip", () => {
  const key = crypto.randomBytes(32);
  const obj = { a: 1, list: [{ value: "UN", name: "Unit" }] };
  const json = JSON.stringify(obj);
  assert.deepEqual(decodeContent(Buffer.from(json).toString("base64")), obj);
  assert.deepEqual(decodeContent(zlib.gzipSync(json).toString("base64")), obj);
  assert.deepEqual(decodeContent(aesEncrypt(json, key), key), obj);
  const c = crypto.createCipheriv("aes-256-ecb", key, null);
  const aesOfGzip = Buffer.concat([c.update(zlib.gzipSync(json)), c.final()]).toString("base64");
  assert.deepEqual(decodeContent(aesOfGzip, key), obj);
  assert.equal(decodeContent(null), null);
});

test("rent is registered per unit as a service line", () => {
  assert.deepEqual(serviceLine("rent", 12, "3B", false), { kind: "rent", code: "CV12-RENT", name: "Residential Rent - Unit 3B" });
  assert.deepEqual(serviceLine("rent", 7, "Unit A2", true), { kind: "rent", code: "CV7-RENT", name: "Commercial Rent - Unit A2" });
  assert.equal(serviceLine("late_fee", 12, "3B", false).name, "Late payment fee - Unit 3B");
  assert.equal(serviceLine("weird", 12, "3B", false).code, "CV12-OTHR");
  const g = buildService({ code: "CV12-RENT", name: "Residential Rent - Unit 3B", price: 850000, unitOfMeasure: "UN", currency: "101", commodityCode: "80131500", commodityName: "Lease and rental of property" })[0];
  assert.equal(g.goodsCode, "CV12-RENT");
  assert.equal(g.unitPrice, "850000");
  assert.equal(g.haveExciseTax, "102");
});

const base = {
  seller: { tin: "1000123456", legalName: "Jane Landlord", businessName: "Jane Homes", address: "Rubaga Road", phone: "256700000000", email: "j@x.ug", placeOfBusiness: "Rubaga Road" },
  deviceNo: "1000123456_01", referenceNo: "CV-2026-0042", issuedAt: new Date("2026-10-24T07:00:00Z"),
  buyer: { name: "Tom Tenant", phone: "256701111111" },
  unitOfMeasure: "UN", payMode: "105", operator: "CasaVilla", remarks: "test",
};

test("T109, landlord not VAT-registered: e-receipt, out of scope, no tax details, amount actually paid", () => {
  const inv = buildInvoice({ ...base, vatRegistered: false, treatment: taxTreatment(false, false), lines: [{ name: "Residential Rent - Unit 3B", code: "CV12-RENT", amount: 600000, commodityCode: "80131500", commodityName: "Rent" }] });
  assert.equal(inv.basicInformation.invoiceKind, "2");
  assert.equal(inv.basicInformation.issuedDate, "2026-10-24 10:00:00"); // Kampala time
  assert.equal(inv.goodsDetails[0].taxRule, "OOS");
  assert.equal(inv.goodsDetails[0].vatApplicableFlag, "2");
  assert.equal(inv.goodsDetails[0].total, "600000.00");
  assert.deepEqual(inv.taxDetails, []);
  assert.equal(inv.summary.grossAmount, "600000.00");
  assert.equal(inv.summary.taxAmount, "0.00");
  assert.equal(inv.payWay[0].paymentAmount, "600000.00");
  assert.equal(inv.buyerDetails.buyerType, "1");
  assert.equal(inv.sellerDetails.tin, "1000123456");
  assert.equal(inv.sellerDetails.referenceNo, "CV-2026-0042");
});

test("T109, VAT-registered: commercial is 18% inside the rent, residential is exempt", () => {
  const com = buildInvoice({ ...base, vatRegistered: true, treatment: taxTreatment(true, true), lines: [{ name: "Commercial Rent - Unit S1", code: "CV3-RENT", amount: 1180000, commodityCode: "1", commodityName: "x" }] });
  assert.equal(com.basicInformation.invoiceKind, "1");
  assert.equal(com.goodsDetails[0].taxRate, "0.18");
  assert.equal(com.goodsDetails[0].tax, "180000.00");
  assert.deepEqual(com.taxDetails, [{ taxCategoryCode: "01", netAmount: "1000000.00", taxRate: "0.18", taxAmount: "180000.00", grossAmount: "1180000.00" }]);
  const res = buildInvoice({ ...base, vatRegistered: true, treatment: taxTreatment(true, false), lines: [{ name: "Residential Rent - Unit 3B", code: "CV12-RENT", amount: 500000, commodityCode: "1", commodityName: "x" }] });
  assert.equal(res.goodsDetails[0].taxRule, "EXEMPT");
  assert.equal(res.taxDetails[0].taxCategoryCode, "03");
  assert.equal(res.summary.taxAmount, "0.00");
  assert.equal(vatInside(1180000), 180000);
});

test("a buyer with a 10-digit TIN is sent as a business buyer", () => {
  const inv = buildInvoice({ ...base, buyer: { name: "Shop Ltd", tin: "1000999999" }, vatRegistered: false, treatment: "oos", lines: [{ name: "r", code: "c", amount: 1, commodityCode: "1", commodityName: "" }] });
  assert.equal(inv.buyerDetails.buyerType, "0");
  assert.equal(inv.buyerDetails.buyerTin, "1000999999");
});

test("URA's reply: FDN, verification code, invoice id and QR are read; QR falls back to the validation link", () => {
  const r = readIssued({ basicInformation: { invoiceNo: "320012345678", antifakeCode: "AB12CD34", invoiceId: "998877" }, summary: { qrCode: "QRDATA" } }, true)!;
  assert.deepEqual(r, { fdn: "320012345678", verificationCode: "AB12CD34", invoiceId: "998877", qr: "QRDATA" });
  const t = readIssued({ basicInformation: { invoiceNo: "320012345678", antiFakeCode: "XY" } }, false)!;
  assert.match(t.qr!, /efristest\.ura\.go\.ug.*invoiceNo=320012345678&antiFakeCode=XY/);
  assert.equal(readIssued({ basicInformation: {} }, true), null);
});

test("dictionary sections and payment modes", () => {
  const dict = { rateUnit: [{ value: "UN", name: "Unit" }, { value: "MON", name: "Month" }], payWay: [{ value: "102", name: "Cash" }, { value: "105", name: "Mobile money" }, { value: "107", name: "Electronic Funds Transfer" }] };
  assert.equal(dictSection(dict, ["rateUnit"]).length, 2);
  const pw = dictSection(dict, ["payWay"]);
  assert.equal(payModeFor("mtn", pw), "105");
  assert.equal(payModeFor("cash", pw), "102");
  assert.equal(payModeFor("bank", pw), "107");
  assert.equal(payModeFor("airtel", []), "105");
});
