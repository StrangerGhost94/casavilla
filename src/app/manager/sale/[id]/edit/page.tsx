import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export default async function ManagerSaleEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  return <SaleForm viewer={u} id={Number((await params).id)} />;
}
