import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader, Empty } from "@/components/ui";
import { NewPropertyForm } from "@/components/Portfolio";

export default async function ManagerNewProperty() {
  await requireUser("manager");
  const landlords = await db.user.findMany({ where: { role: "landlord" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (!landlords.length) return <Empty title="No landlords yet">Landlords sign up at /register, or ask them to join.</Empty>;
  return <div className="max-w-2xl"><PageHeader title="Add a property" subtitle="Onboard a property on behalf of a landlord." /><NewPropertyForm landlords={landlords} /></div>;
}
