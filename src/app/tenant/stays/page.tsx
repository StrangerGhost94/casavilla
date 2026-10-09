import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BookingList } from "@/components/BookingList";

export default async function MyStays() {
  const u = await requireUser("tenant");
  return (
    <>
      <PageHeader title="My bookings" actions={<Link href="/stays" className="btn-primary btn-sm">Find a stay</Link>} />
      <BookingList where={{ guestId: u.id }} empty="No short-stay bookings yet" />
    </>
  );
}
