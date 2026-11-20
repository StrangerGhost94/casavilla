import { requireUser } from "@/lib/auth";
import { PropertyEdit } from "@/components/Portfolio";

export default async function AgentPropertyEdit({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("agent");
  return <PropertyEdit id={Number((await params).id)} viewer={u} base="/agent/properties" />;
}
