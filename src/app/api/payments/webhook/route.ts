import { NextResponse } from "next/server";
import { db } from "@/db";
import { verifyCharge } from "@/lib/momo";
import { completePayment, failPayment } from "@/lib/billing";
import { confirmBooking, failBooking } from "@/lib/stays";

// Flutterwave calls this when a mobile money charge settles. We never trust the body:
// we check the secret hash, then re-verify the transaction with Flutterwave.
export async function POST(req: Request) {
  if (!process.env.FLW_WEBHOOK_HASH || req.headers.get("verif-hash") !== process.env.FLW_WEBHOOK_HASH) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const ref = body?.data?.tx_ref || body?.txRef;
  if (!ref) return NextResponse.json({ ok: true });
  if (String(ref).startsWith("BK")) {
    const b = await db.booking.findUnique({ where: { reference: String(ref) } });
    if (b && ["pending", "expired"].includes(b.status) && !b.paidAt) {
      const r = await verifyCharge(b.reference, b.total);
      if (r === "success") await confirmBooking(b.id);
      if (r === "failed") await failBooking(b.id);
    }
    return NextResponse.json({ ok: true });
  }
  const p = await db.payment.findUnique({ where: { reference: String(ref) } });
  if (!p || p.status !== "pending") return NextResponse.json({ ok: true });
  const result = await verifyCharge(p.reference, p.amount);
  if (result === "success") await completePayment(p.id);
  if (result === "failed") await failPayment(p.id);
  return NextResponse.json({ ok: true });
}
