import test from "node:test";
import assert from "node:assert/strict";
import { clearFailures, lockedFor, noteFailure } from "../src/lib/throttle";

test("sign-in locks after 8 wrong passwords and a correct one clears it", () => {
  const key = "someone@example.com";
  for (let i = 0; i < 7; i++) noteFailure(key);
  assert.equal(lockedFor(key), 0);
  noteFailure(key);
  assert.ok(lockedFor(key) >= 1 && lockedFor(key) <= 15);
  assert.equal(lockedFor("other@example.com"), 0);
  clearFailures(key);
  assert.equal(lockedFor(key), 0);
});
