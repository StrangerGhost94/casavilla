import { requireUser } from "@/lib/auth";
import { SaleForm } from "@/components/SaleAdmin";

export default async function AgentSaleEdit({ params }: { params: Promise<{ id: string }> }) {
  return <SaleForm viewer={await requireUser("agent")} id={Number((await params).id)} />;
}
