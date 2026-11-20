import { requireUser } from "@/lib/auth";
import { SaleManage } from "@/components/SaleAdmin";

export default async function AgentSaleListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireUser("agent");
  return <SaleManage viewer={u} id={Number((await params).id)} fresh={(await searchParams).new === "1"} />;
}
