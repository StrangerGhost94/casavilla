import { requireUser } from "@/lib/auth";
import { StatementPage } from "@/components/Statements";
import { lastMonths } from "@/lib/statements";

export const metadata = { title: "Statements & expenses" };

export default async function LandlordStatements({ searchParams }: { searchParams: Promise<{ month?: string; property?: string }> }) {
  const u = await requireUser("landlord");
  const q = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(q.month ?? "") ? q.month! : lastMonths(1)[0];
  return <StatementPage viewer={u} landlordId={u.id} month={month} propertyId={Number(q.property) || undefined} base="/landlord/statements" />;
}
