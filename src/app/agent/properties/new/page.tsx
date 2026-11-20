import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewPropertyForm } from "@/components/Portfolio";

export const metadata = { title: "Add a short-stay property" };

export default async function AgentNewProperty() {
  await requireUser("agent");
  return <div className="max-w-2xl"><PageHeader title="Add a short-stay property" subtitle="Then add its rooms or apartments with a price per night, and photos. CasaVilla verifies it before guests can book." /><NewPropertyForm stays /></div>;
}
