import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyForm } from "@/components/Portfolio";

export default async function NewProperty() {
  await requireUser("landlord");
  return <div className="max-w-2xl"><PageHeader title="Add a property" subtitle="You'll add units (rooms, apartments, shops) next." /><PropertyForm /></div>;
}
