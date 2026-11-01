// Real-user speed: what visitors' own phones report (Core Web Vitals), kept in memory since the last restart.
// No personal data: only the metric, its value and the kind of page. Shown on System health.
export const METRICS = {
  LCP: { label: "Main content visible", good: 2500, poor: 4000, unit: "ms" },
  INP: { label: "Response to taps", good: 200, poor: 500, unit: "ms" },
  CLS: { label: "Layout jumping", good: 0.1, poor: 0.25, unit: "" },
  FCP: { label: "First paint", good: 1800, poor: 3000, unit: "ms" },
  TTFB: { label: "Server reply", good: 800, poor: 1800, unit: "ms" },
} as const;
export type Metric = keyof typeof METRICS;

type Sample = { m: Metric; v: number; p: string };
const store = globalThis as unknown as { cvVitals?: Sample[] };
const MAX = 3000;

/** /listings/12-nice-home → /listings/:id, so pages group together and nothing identifying is kept. */
export const pageKind = (path: string) => path.split("?")[0].split("/").map((s) => (/^\d/.test(s) ? ":id" : s)).join("/").slice(0, 60) || "/";

export function recordVital(m: Metric, v: number, path: string) {
  const list = (store.cvVitals ??= []);
  list.push({ m, v, p: pageKind(path) });
  if (list.length > MAX) list.splice(0, list.length - MAX);
}

const p75 = (vals: number[]) => { const s = [...vals].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.75))]; };

export function vitalsSummary() {
  const list = store.cvVitals ?? [];
  const metrics = (Object.keys(METRICS) as Metric[]).map((m) => {
    const vals = list.filter((s) => s.m === m).map((s) => s.v);
    return { m, count: vals.length, p75: vals.length ? p75(vals) : null };
  });
  const byPage = new Map<string, number[]>();
  for (const s of list) if (s.m === "LCP") byPage.set(s.p, [...(byPage.get(s.p) ?? []), s.v]);
  const slowest = [...byPage].map(([page, vals]) => ({ page, count: vals.length, p75: p75(vals) })).sort((a, b) => b.p75 - a.p75).slice(0, 8);
  return { metrics, slowest };
}
