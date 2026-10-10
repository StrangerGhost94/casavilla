import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export const metadata = { title: "New listing for sale" };

export default async function LandlordSaleNew() {
  const u = await requireUser("landlord");
  return <SaleForm viewer={u} />;
}
