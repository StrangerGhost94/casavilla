// EFRIS: the checks on numbers people type in, and how payments are described.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanFdn, docName, validCode, validFdn, validTin } from "../src/lib/efris";
import { chargeLabel, payLabel } from "../src/lib/rules";

test("URA TIN is exactly 10 digits", () => {
  assert.ok(validTin("1000123456"));
  assert.ok(!validTin("100012345"));
  assert.ok(!validTin("10001234567"));
  assert.ok(!validTin("10001234AB"));
});

test("FDN: spaces and dashes are dropped, then numbers only", () => {
  assert.equal(cleanFdn(" 3200 1234-5678 9012 "), "3200123456789012");
  assert.ok(validFdn(cleanFdn("3200 1234 5678 9012")));
  assert.ok(!validFdn("12345"));
  assert.ok(!validFdn("32001234ABCD"));
});

test("verification code: letters and numbers", () => {
  assert.ok(validCode("A1B2C3D4E5"));
  assert.ok(!validCode("abc"));
  assert.ok(!validCode("12 34"));
});

test("e-invoice for VAT-registered landlords, e-receipt otherwise", () => {
  assert.equal(docName("invoice"), "EFRIS e-invoice");
  assert.equal(docName("receipt"), "EFRIS e-receipt");
});

test("payments say what they were for", () => {
  assert.equal(chargeLabel("rent", "2026-09"), "Rent · September 2026");
  assert.equal(chargeLabel("deposit", "DEPOSIT"), "Deposit");
  assert.equal(chargeLabel("utility", "2026-10"), "Utility bill · October 2026");
  assert.equal(payLabel("rent"), "Pay rent");
  assert.equal(payLabel("utility"), "Pay now");
});

test("security deposits don't need an EFRIS receipt; rent and bills do", async () => {
  const { efrisApplies } = await import("../src/lib/efris");
  assert.equal(efrisApplies("deposit"), false);
  assert.equal(efrisApplies("rent"), true);
  assert.equal(efrisApplies("utility"), true);
});
