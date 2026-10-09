import "server-only";
import { fail } from "./flash";

/**
 * Form readers that refuse bad input with a readable message instead of silently storing NaN, 0 or junk.
 * Each one stops the server action (via fail) when the value is missing or out of range.
 */
export async function int(
  fd: FormData, key: string, label: string,
  o: { min?: number; max?: number; optional?: boolean; fallback?: number } = {},
): Promise<number> {
  const raw = String(fd.get(key) ?? "").replace(/[,\s]/g, "");
  if (raw === "") {
    if (o.fallback !== undefined) return o.fallback;
    if (o.optional) return NaN;
    return fail(`Enter ${label}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return fail(`${cap(label)} must be a whole number`);
  if (o.min !== undefined && n < o.min) return fail(`${cap(label)} must be at least ${o.min.toLocaleString("en-UG")}`);
  if (o.max !== undefined && n > o.max) return fail(`${cap(label)} must be at most ${o.max.toLocaleString("en-UG")}`);
  return n;
}

/** Optional integer: null when left blank. */
export async function optInt(fd: FormData, key: string, label: string, o: { min?: number; max?: number } = {}) {
  const n = await int(fd, key, label, { ...o, optional: true });
  return Number.isNaN(n) ? null : n;
}

export async function text(fd: FormData, key: string, label: string, o: { max?: number; min?: number; optional?: boolean } = {}) {
  const s = String(fd.get(key) ?? "").trim().replace(/\s+\n/g, "\n");
  if (!s) return o.optional ? null : fail(`Enter ${label}`);
  if (o.min && s.length < o.min) return fail(`${cap(label)} is too short`);
  if (s.length > (o.max ?? 2000)) return fail(`${cap(label)} is too long (max ${o.max ?? 2000} characters)`);
  return s;
}
export async function reqText(fd: FormData, key: string, label: string, o: { max?: number; min?: number } = {}) {
  return (await text(fd, key, label, o)) as string;
}

export async function oneOf<T extends string>(fd: FormData, key: string, allowed: readonly T[], label: string, fallback?: T): Promise<T> {
  const v = String(fd.get(key) ?? "");
  if ((allowed as readonly string[]).includes(v)) return v as T;
  if (fallback !== undefined && v === "") return fallback;
  return fail(`Choose a valid ${label}`);
}

/** YYYY-MM-DD from a date input. */
export async function date(fd: FormData, key: string, label: string, optional = false) {
  const v = String(fd.get(key) ?? "");
  if (!v) return optional ? null : fail(`Choose ${label}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return fail(`${cap(label)} is not a valid date`);
  return v;
}

export const id = (fd: FormData, key = "id") => {
  const n = Number(fd.get(key));
  return Number.isInteger(n) && n > 0 ? n : 0;
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Prisma unique-constraint violation (e.g. the one-active-lease-per-unit rule). */
export const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
