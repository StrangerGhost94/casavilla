import { requireUser } from "@/lib/auth";
import { FinanceReport } from "@/components/FinanceReport";

export const metadata = { title: "Financial reports" };

export default async function ManagerReports({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const u = await requireUser("manager");
  return <FinanceReport viewer={u} q={await searchParams} />;
}
