import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export default async function LandlordSaleEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("landlord");
  return <SaleForm viewer={u} id={Number((await params).id)} />;
}
