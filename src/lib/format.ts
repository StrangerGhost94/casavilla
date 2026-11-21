export const ugx = (n: number | null | undefined) =>
  n == null ? "—" : "UGX " + Math.round(n).toLocaleString("en-UG");

export const TZ = "Africa/Kampala";

/** Calendar-day columns (@db.Date) come back from Prisma as UTC midnight; this gives "YYYY-MM-DD". */
export const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** "YYYY-MM-DD" → Date for a calendar-day column. */
export const dateOnly = (s: string) => new Date(`${s}T00:00:00Z`);

// Calendar-day Dates are UTC midnight, which is 03:00 the same day in Kampala, so they format correctly here.
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  // Plain YYYY-MM-DD dates (lease dates, due dates) are calendar days, not instants.
  if (typeof d === "string" && d.length === 10) {
    return new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
};

export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";

/** Today's date in Kampala as YYYY-MM-DD. */
export const kampalaToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
/** Midnight in Kampala at the start of a day ("2026-11-20") or a month ("2026-11"). */
export const kampalaStart = (dayOrMonth: string) => new Date(`${dayOrMonth.length === 7 ? `${dayOrMonth}-01` : dayOrMonth}T00:00:00+03:00`);
/** Whole days from one "YYYY-MM-DD" to another (negative if b is earlier). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
/** A plausible email address (the code sent to it is the real check). */
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
/** A normalised Ugandan number: +256 and nine digits. */
export const isUgPhone = (p: string) => /^\+256\d{9}$/.test(p);

export const periodLabel = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};


export function normalizePhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("256")) return "+" + d;
  if (d.startsWith("0")) return "+256" + d.slice(1);
  if (d.length === 9) return "+256" + d;
  return "+" + d;
}

// MTN Uganda: 076, 077, 078 · Airtel Uganda: 070, 074, 075
export function networkFor(phone: string): "mtn" | "airtel" | null {
  const local = normalizePhone(phone).replace("+256", "0");
  const p = local.slice(0, 3);
  if (["076", "077", "078"].includes(p)) return "mtn";
  if (["070", "074", "075"].includes(p)) return "airtel";
  return null;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", then the date. */
export function timeAgo(d: Date) {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return "yesterday";
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return fmtDate(d);
}
