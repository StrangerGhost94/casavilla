// Rules behind reminders, utilities, inspections and statements.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderStage } from "../src/lib/housekeeping";
import { readingCharge, splitEqually } from "../src/lib/utilities";
import { checklistFor } from "../src/lib/inspections";
import { rentalTax, taxYearOf } from "../src/lib/statements";
import { maskPhone } from "../src/lib/otp";

test("rent reminders: 3 days before, on the day, 3 and 7 days late — nothing in between", () => {
  assert.equal(reminderStage(3), "due3");
  assert.equal(reminderStage(1), "due3");
  assert.equal(reminderStage(4), null);
  assert.equal(reminderStage(0), "due0");
  assert.equal(reminderStage(-1), null);
  assert.equal(reminderStage(-2), null);
  assert.equal(reminderStage(-3), "late3");
  assert.equal(reminderStage(-6), "late3");
  assert.equal(reminderStage(-7), "late7");
  assert.equal(reminderStage(-30), "late7");
  assert.equal(reminderStage(-31), null);
});

test("shared bills split into whole shillings that add up exactly", () => {
  assert.deepEqual(splitEqually(100_000, 3), [33_334, 33_333, 33_333]);
  assert.equal(splitEqually(100_000, 3).reduce((a, b) => a + b, 0), 100_000);
  assert.deepEqual(splitEqually(90_000, 4), [22_500, 22_500, 22_500, 22_500]);
  assert.deepEqual(splitEqually(5, 0), []);
});

test("sub-meter bill = units used × rate, never negative", () => {
  assert.equal(readingCharge(1200, 1266, 900), 59_400);
  assert.equal(readingCharge(10.5, 12.75, 4000), 9_000);
  assert.equal(readingCharge(500, 400, 900), 0);
});

test("inspection checklist follows the unit's rooms", () => {
  const two = checklistFor({ bedrooms: 2, bathrooms: 1 });
  const areas = [...new Set(two.map((i) => i.area))];
  assert.deepEqual(areas, ["Entrance & outside", "Sitting room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom"]);
  const shop = [...new Set(checklistFor({ bedrooms: 0, bathrooms: 0 }).map((i) => i.area))];
  assert.deepEqual(shop, ["Entrance & outside", "Main space"]);
});

test("URA rental tax for individuals: 12% above UGX 2,820,000 a year", () => {
  assert.equal(rentalTax(2_000_000), 0);
  assert.equal(rentalTax(2_820_000), 0);
  assert.equal(rentalTax(12_820_000), 1_200_000);
  assert.equal(taxYearOf("2026-10").label, "July 2026 – June 2027");
  assert.equal(taxYearOf("2026-03").label, "July 2025 – June 2026");
});

test("phone numbers are masked when showing where a code went", () => {
  assert.equal(maskPhone("+256772123456"), "0772 •••456");
  assert.equal(maskPhone("0772 123 456"), "0772 •••456");
});
