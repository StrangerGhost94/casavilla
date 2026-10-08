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
