import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export const metadata = { title: "New listing for sale" };

export default async function AgentSaleNew() {
  return <SaleForm viewer={await requireUser("agent")} />;
}
