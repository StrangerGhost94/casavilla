import { requireUser } from "@/lib/auth";
import { PropertyPhotos } from "@/components/Portfolio";

export default async function AgentPropertyPhotos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireUser("agent");
  return <PropertyPhotos id={Number((await params).id)} viewer={u} base="/agent/properties" fresh={(await searchParams).new === "1"} />;
}
