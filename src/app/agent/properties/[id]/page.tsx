import { requireUser } from "@/lib/auth";
import { PropertyDetail } from "@/components/Portfolio";

export default async function AgentProperty({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("agent");
  return <PropertyDetail id={Number((await params).id)} viewer={u} base="/agent/properties" />;
}
