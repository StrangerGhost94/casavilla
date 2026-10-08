import { requireUser } from "@/lib/auth";
import { LeaseDetail } from "@/components/Portfolio";

export default async function LandlordLease({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  const { id } = await params;
  return <LeaseDetail id={Number(id)} viewer={u} base="/landlord/tenants" />;
}
