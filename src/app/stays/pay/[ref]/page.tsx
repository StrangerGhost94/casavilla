import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { provider, verifyCharge } from "@/lib/momo";
import { confirmBooking, failBooking } from "@/lib/stays";
import { sandboxStay } from "@/app/stay-actions";
import { Logo } from "@/components/ui";
import { AutoRefresh, Submit } from "@/components/client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking payment" };

export default async function StayPay({ params }: { params: Promise<{ ref: string }> }) {
  const u = await requireUser();
  const { ref } = await params;
  let b = await db.booking.findUnique({ where: { reference: ref }, include: { unit: { include: { property: true } } } });
  if (!b || (b.guestId !== u.id && u.role !== "manager")) notFound();
  if (b.status === "pending" && provider !== "sandbox") {
    const r = await verifyCharge(ref, b.total);
    if (r === "success") await confirmBooking(b.id);
    if (r === "failed") await failBooking(b.id);
    b = await db.booking.findUniqueOrThrow({ where: { reference: ref }, include: { unit: { include: { property: true } } } });
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <Logo />
      <div className="card mt-6 w-full">
        <div className="text-sm text-stone-500">{b.unit.property.name} · {b.unit.label}</div>
        <div className="text-xs text-stone-500">{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.nights} night{b.nights > 1 ? "s" : ""}</div>
        <div className="mt-1 text-3xl font-bold">{ugx(b.total)}</div>
        {b.status === "pending" && (
          <div className="mt-6">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-100 border-t-brand-500" />
            <div className="mt-3 font-semibold">Approve the payment on your phone…</div>
            <div className="muted">Your dates are held for 30 minutes.</div>
            {provider !== "sandbox" && <AutoRefresh seconds={5} />}
            {provider === "sandbox" && (
              <div className="mt-5 rounded-lg bg-amber-50 p-3 text-left text-xs text-amber-800">
                <div className="mb-2 font-semibold">Test mode — simulate the guest&apos;s response:</div>
                <div className="flex gap-2">
                  <form action={sandboxStay}><input type="hidden" name="ref" value={ref} /><input type="hidden" name="outcome" value="approve" /><Submit className="btn-primary btn-sm">Approve payment</Submit></form>
                  <form action={sandboxStay}><input type="hidden" name="ref" value={ref} /><input type="hidden" name="outcome" value="decline" /><Submit className="btn-outline btn-sm">Decline</Submit></form>
                </div>
              </div>
            )}
          </div>
        )}
        {b.status === "confirmed" && (
          <div className="mt-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500 text-2xl text-white">✓</div>
            <div className="mt-3 font-semibold text-brand-700">You&apos;re booked!</div>
            <div className="muted">Receipt {b.receiptNo}</div>
            <Link href={`/stays/bookings/${b.id}`} className="btn-primary mt-4">View booking</Link>
          </div>
        )}
        {["expired", "cancelled"].includes(b.status) && (
          <div className="mt-6">
            <div className="font-semibold text-maroon-600">Booking not completed</div>
            <div className="muted">{b.note || "No money was taken."}</div>
            <Link href={`/stays/${b.unitId}`} className="btn-primary mt-4">Try again</Link>
          </div>
        )}
      </div>
    </main>
  );
}
