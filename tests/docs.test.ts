// Documents, photos and short stays: pure rules plus (with a database) real PDFs and booking safety.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { shotList } from "../src/lib/photo-check";

test("rent in words for the agreement", async () => {
  const { ugxWords } = await import("../src/lib/agreement");
  assert.equal(ugxWords(1_200_000), "One million two hundred thousand");
  assert.equal(ugxWords(350_500), "Three hundred and fifty thousand five hundred");
  assert.equal(ugxWords(21), "Twenty-one");
});

test("PDF text is reduced to what the built-in fonts can draw", async () => {
  const { safe } = await import("../src/lib/pdf");
  assert.equal(safe("Kampala → Wakiso ★"), "Kampala -> Wakiso *");
  assert.equal(safe("UGX 1,000 — paid"), "UGX 1,000 — paid");
});

test("the shot list follows bedrooms and bathrooms", () => {
  const one = shotList([{ id: 1, label: "A1", bedrooms: 2, bathrooms: 1 }], false);
  assert.deepEqual(one.map((s) => s.label), ["Front of the property", "Compound / parking", "Sitting room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom"]);
  assert.ok(one.find((s) => s.label === "Bedroom 1")!.required && !one.find((s) => s.label === "Bedroom 2")!.required);
  const studio = shotList([{ id: 2, label: "S1", bedrooms: 0, bathrooms: 1 }], false);
  assert.ok(studio.some((s) => s.label === "Main room") && !studio.some((s) => s.room === "bedroom"));
  const multi = shotList([{ id: 1, label: "A1", bedrooms: 1, bathrooms: 1 }, { id: 2, label: "A2", bedrooms: 1, bathrooms: 2 }], true);
  assert.ok(multi.some((s) => s.label === "A2 · Bathroom 2"));
});

test("stay pricing and rules", async () => {
  const { quote, checkStay, nightsBetween } = await import("../src/lib/stays");
  assert.equal(nightsBetween("2030-01-01", "2030-01-04"), 3);
  assert.deepEqual(quote({ nightlyRate: 120000, cleaningFee: 30000 }, "2030-01-01", "2030-01-04"), { nights: 3, nightly: 120000, cleaningFee: 30000, total: 390000 });
  const u = { minNights: 2, maxGuests: 2 };
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  assert.match(checkStay(u, day(30), day(31), 1)!, /at least 2 nights/);
  assert.match(checkStay(u, day(30), day(34), 3)!, /Up to 2 guests/);
  assert.match(checkStay(u, "2000-01-01", "2000-01-05", 1)!, /past/);
  assert.match(checkStay(u, day(400), day(403), 1)!, /year ahead/);
  assert.equal(checkStay(u, day(30), day(34), 2), null);
});

const enabled = !!process.env.DATABASE_URL && !!process.env.GEO_DB_TESTS;
const t = enabled ? test : test.skip;
after(async () => { if (enabled) await (await import("../src/db")).db.$disconnect(); });

t("receipt PDF lists every charge the payment covered", async () => {
  const { db } = await import("../src/db");
  const { receiptData, receiptPdf } = await import("../src/lib/receipts");
  const p = await db.payment.findFirstOrThrow({ where: { status: "success" }, orderBy: { id: "asc" } });
  const r = (await receiptData(p.id))!;
  assert.ok(r.lines.length >= 1 && r.lines.reduce((s, l) => s + l.amount, 0) + r.credit === p.amount, "lines + credit = amount paid");
  const pdf = await PDFDocument.load(await receiptPdf(r));
  assert.ok(pdf.getPageCount() >= 1);
});

t("tenancy agreement PDF builds for every active lease", async () => {
  const { db } = await import("../src/db");
  const { agreementPdf } = await import("../src/lib/agreement");
  for (const l of await db.lease.findMany({ where: { status: "active" } })) {
    const { bytes } = await agreementPdf(l.id);
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 2, `lease ${l.id} agreement too short`);
  }
});

t("two guests can't book the same nights", async () => {
  const { db } = await import("../src/db");
  const { holdBooking } = await import("../src/lib/stays");
  const unit = await db.unit.findFirstOrThrow({ where: { mode: "short" } });
  const [a, b] = await db.user.findMany({ where: { role: "tenant" }, take: 2 });
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  const [r1, r2] = await Promise.all([
    holdBooking(a, unit.id, day(40), day(43), 1, "mtn", "+256772000001"),
    holdBooking(b, unit.id, day(41), day(44), 1, "mtn", "+256772000002"),
  ]);
  const ok = [r1, r2].filter((r) => !("error" in r));
  assert.equal(ok.length, 1, "exactly one booking wins");
  const short = await holdBooking(a, unit.id, day(50), day(51), 1, "mtn", "+256772000001");
  assert.ok("error" in short && /at least 2 nights/.test(short.error));
  await db.booking.deleteMany({ where: { unitId: unit.id, checkIn: { gte: new Date(day(39)) } } });
});
