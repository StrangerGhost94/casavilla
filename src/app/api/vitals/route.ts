import { NextResponse } from "next/server";
import { METRICS, recordVital, type Metric } from "@/lib/vitals";

/** Speed figures from visitors' browsers (see lib/vitals). Anything odd is ignored. */
export async function POST(req: Request) {
  const raw = await req.text().catch(() => "");
  if (raw.length > 500) return new NextResponse(null, { status: 204 });
  try {
    const { n, v, p } = JSON.parse(raw) as { n: string; v: number; p: string };
    if (n in METRICS && typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 600_000 && typeof p === "string") recordVital(n as Metric, v, p);
  } catch { /* not ours */ }
  return new NextResponse(null, { status: 204 });
}
