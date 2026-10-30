import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, ugx } from "@/lib/format";
import { provider, verifyCharge } from "@/lib/momo";
import { confirmBooking, failBooking } from "@/lib/stays";
import { sandboxStay } from "@/app/stay-actions";
import { Logo } from "@/components/ui";
import { PayPending } from "@/components/PayPending";

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
        {b.status === "pending" && <PayPending reference={ref} sandbox={sandboxStay} note="Your dates are held for 30 minutes." who="guest" />}
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
