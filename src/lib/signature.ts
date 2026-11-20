import "server-only";
import bcrypt from "bcryptjs";
import type { User } from "@/db";
import { fail } from "@/lib/flash";
import { clearFailures, lockedFor, noteFailure } from "@/lib/throttle";

/**
 * Risky actions are signed: the person gives a reason and re-enters their own password, so the audit trail shows
 * it was really them and why. Returns the reason to store with the entry. Nothing changes if either is missing.
 */
export async function requireSignature(fd: FormData, me: User): Promise<string> {
  const reason = String(fd.get("signReason") || "").trim().replace(/\s+/g, " ");
  if (reason.length < 4) return fail("Give a short reason, then sign with your password");
  const key = `sign:${me.id}`;
  const wait = lockedFor(key);
  if (wait) return fail(`Too many wrong passwords. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`);
  if (!(await bcrypt.compare(String(fd.get("signPassword") || ""), me.passwordHash))) {
    noteFailure(key);
    return fail("Your password was wrong, so nothing was changed");
  }
  clearFailures(key);
  return reason.slice(0, 300);
}
