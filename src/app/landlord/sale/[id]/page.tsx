import { requireUser } from "@/lib/auth";
import { SaleManage } from "@/components/SaleAdmin";

export default async function LandlordSaleListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireUser("landlord");
  return <SaleManage viewer={u} id={Number((await params).id)} fresh={(await searchParams).new === "1"} />;
}
