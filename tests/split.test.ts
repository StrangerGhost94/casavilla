// The split of each tenant payment: commission, tax set aside, landlord's share, and recovering cash deductions.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recoverFrom, rentalTaxOn, splitPayment, taxYearStart } from "../src/lib/split";

const base = { credit: 0, commissionPct: 10, taxMode: "individual" as const, vatApplies: false, yearRentBefore: 0 };

test("rental tax: 12% only above UGX 2,820,000 a year", () => {
  assert.equal(rentalTaxOn(2_820_000), 0);
  assert.equal(rentalTaxOn(3_820_000), 120_000);
});

test("below the threshold: commission only, landlord gets the rest", () => {
  const s = splitPayment({ ...base, lines: [{ kind: "rent", amount: 1_200_000 }] });
  assert.deepEqual(s, { gross: 1_200_000, taxableRent: 1_200_000, commission: 120_000, vat: 0, rentalTax: 0, net: 1_080_000 });
});

test("crossing the threshold: tax set aside only on the part above it", () => {
  const s = splitPayment({ ...base, lines: [{ kind: "rent", amount: 1_200_000 }], yearRentBefore: 2_400_000 });
  // 2.4M + 1.2M = 3.6M → 780,000 above → 93,600
  assert.equal(s.rentalTax, 93_600);
  assert.equal(s.net, 1_200_000 - 120_000 - 93_600);
  const next = splitPayment({ ...base, lines: [{ kind: "rent", amount: 1_200_000 }], yearRentBefore: 3_600_000 });
  assert.equal(next.rentalTax, 144_000);
});

test("deposits and bills pass straight through", () => {
  const s = splitPayment({ ...base, lines: [{ kind: "deposit", amount: 1_200_000 }, { kind: "utility", amount: 50_000 }], yearRentBefore: 9_000_000 });
  assert.equal(s.commission, 0); assert.equal(s.rentalTax, 0); assert.equal(s.net, 1_250_000);
});

test("paying ahead (credit) counts as rent", () => {
  const s = splitPayment({ ...base, lines: [], credit: 500_000 });
  assert.equal(s.taxableRent, 500_000); assert.equal(s.commission, 50_000);
});

test("VAT-registered commercial rent: 18% VAT inside the rent, commission and tax on the rest", () => {
  const s = splitPayment({ ...base, vatApplies: true, lines: [{ kind: "rent", amount: 1_180_000 }], yearRentBefore: 10_000_000 });
  assert.equal(s.vat, 180_000);
  assert.equal(s.taxableRent, 1_000_000);
  assert.equal(s.commission, 100_000);
  assert.equal(s.rentalTax, 120_000);
  assert.equal(s.net, 1_180_000 - 180_000 - 100_000 - 120_000);
});

test("landlords who pay their own tax: nothing set aside", () => {
  const s = splitPayment({ ...base, taxMode: "none", lines: [{ kind: "rent", amount: 1_200_000 }], yearRentBefore: 9_000_000 });
  assert.equal(s.rentalTax, 0);
});

test("the shares always add back up to what the tenant paid", () => {
  for (const amt of [1, 999, 333_333, 1_234_567]) {
    const s = splitPayment({ ...base, vatApplies: true, commissionPct: 7.5, lines: [{ kind: "rent", amount: amt }, { kind: "late_fee", amount: 17 }], yearRentBefore: 3_000_000 });
    assert.equal(s.commission + s.vat + s.rentalTax + s.net, s.gross);
  }
});

test("cash deductions are taken from the next payouts, oldest first", () => {
  assert.deepEqual(recoverFrom(100_000, [{ id: 1, outstanding: 30_000 }, { id: 2, outstanding: 50_000 }]), { take: [{ id: 1, amount: 30_000 }, { id: 2, amount: 50_000 }], send: 20_000 });
  assert.deepEqual(recoverFrom(40_000, [{ id: 1, outstanding: 30_000 }, { id: 2, outstanding: 50_000 }]), { take: [{ id: 1, amount: 30_000 }, { id: 2, amount: 10_000 }], send: 0 });
  assert.deepEqual(recoverFrom(10_000, []), { take: [], send: 10_000 });
});

test("tax year runs July to June, Kampala time", () => {
  assert.equal(taxYearStart(new Date("2026-06-30T20:59:00Z")), 2025); // 23:59 on 30 June in Kampala
  assert.equal(taxYearStart(new Date("2026-06-30T21:00:00Z")), 2026); // midnight 1 July in Kampala
});
