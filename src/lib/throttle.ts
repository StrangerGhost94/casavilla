import "server-only";

/**
 * Slows down password guessing: after 8 wrong passwords for one email or phone within 15 minutes, sign-in for it
 * is locked until the 15 minutes pass. Kept in memory (the site runs as one server), so a restart clears it.
 */
const WINDOW = 15 * 60 * 1000, MAX = 8;
const fails = new Map<string, number[]>();

const recent = (key: string) => (fails.get(key) ?? []).filter((t) => Date.now() - t < WINDOW);

/** Minutes left on the lock, or 0 when sign-in may be tried. */
export function lockedFor(key: string): number {
  const r = recent(key);
  return r.length >= MAX ? Math.max(1, Math.ceil((WINDOW - (Date.now() - r[0])) / 60000)) : 0;
}

export function noteFailure(key: string) {
  if (fails.size > 5000) for (const k of fails.keys()) if (!recent(k).length) fails.delete(k);
  fails.set(key, [...recent(key), Date.now()]);
}

export function clearFailures(key: string) {
  fails.delete(key);
}
