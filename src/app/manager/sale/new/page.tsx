import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export const metadata = { title: "New listing for sale" };

export default async function ManagerSaleNew() {
  const u = await requireUser("manager");
  return <SaleForm viewer={u} />;
}
