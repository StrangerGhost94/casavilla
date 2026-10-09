import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/db";
import { fmtDate, ugx } from "@/lib/format";
import { Badge, Empty } from "./ui";

export async function BookingList({ where, empty, showGuest }: { where: Prisma.BookingWhereInput; empty: string; showGuest?: boolean }) {
  const rows = await db.booking.findMany({ where: { status: { not: "expired" }, ...where }, include: { guest: { select: { name: true } }, unit: { include: { property: { select: { name: true } } } } }, orderBy: { checkIn: "desc" }, take: 100 });
  if (!rows.length) return <Empty title={empty} />;
  return (
    <div className="card divide-y divide-stone-100 p-0">
      {rows.map((b) => {
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-stone-800">{b.unit.property.name} · {b.unit.label}</div>
              <div className="text-xs text-stone-500">{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {b.nights} night{b.nights > 1 ? "s" : ""}{showGuest && b.status !== "blocked" ? ` · ${b.guest.name}` : ""}{b.note ? ` · ${b.note}` : ""}</div>
            </div>
            <div className="text-right"><div className="text-sm font-semibold">{b.status === "blocked" ? "Blocked" : ugx(b.total)}</div><Badge>{b.status === "blocked" ? "closed" : b.status}</Badge></div>
          </>
        );
        return b.status === "blocked"
          ? <div key={b.id} className="flex items-center gap-3 px-4 py-3">{body}</div>
          : <Link key={b.id} href={`/stays/bookings/${b.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">{body}</Link>;
      })}
    </div>
  );
}
