import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { Empty } from "@/components/ui";
import { StatementPage } from "@/components/Statements";
import { lastMonths } from "@/lib/statements";

export const metadata = { title: "Statements & expenses" };

export default async function ManagerStatements({ searchParams }: { searchParams: Promise<{ month?: string; property?: string; landlord?: string }> }) {
  const u = await requireUser("manager");
  const q = await searchParams;
  const landlords = await db.user.findMany({ where: { role: "landlord" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  if (!landlords.length) return <Empty title="No landlords yet" />;
  const landlordId = landlords.find((l) => l.id === Number(q.landlord))?.id ?? landlords[0].id;
  const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : lastMonths(1)[0];
  return <StatementPage viewer={u} landlordId={landlordId} month={month} propertyId={Number(q.property) || undefined} base="/manager/statements" landlords={landlords} />;
}
