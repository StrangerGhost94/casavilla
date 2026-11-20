import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";

export const metadata = { title: "Short-stay properties" };

export default async function AgentProperties() {
  const u = await requireUser("agent");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Short-stay properties" subtitle="Homes you let by the night. CasaVilla visits and verifies each property before its units can be listed. Agents can't list monthly rentals."
        actions={<Link href="/agent/properties/new" className="btn-primary btn-sm"><Plus className="h-4 w-4" /> Add a property</Link>} />
      <PropertyList where={{ landlordId: u.id }} base="/agent/properties" />
    </div>
  );
}
