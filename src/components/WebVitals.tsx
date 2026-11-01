"use client";
import { useReportWebVitals } from "next/web-vitals";

/** Tells our own server how fast pages really were on this phone (metric, value and page only; see lib/vitals). */
export function WebVitals() {
  useReportWebVitals((m) => {
    if (process.env.NODE_ENV !== "production") return;
    const body = JSON.stringify({ n: m.name, v: m.value, p: location.pathname });
    if (!navigator.sendBeacon?.("/api/vitals", body)) fetch("/api/vitals", { method: "POST", body, keepalive: true }).catch(() => {});
  });
  return null;
}
