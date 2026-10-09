import { requireUser } from "@/lib/auth";
import { AreaPage } from "@/components/AreaPage";

export const metadata = { title: "Portfolio by area" };
export default async function ManagerAreas({ searchParams }: { searchParams: Promise<{ by?: string; in?: string }> }) {
  await requireUser("manager");
  return <AreaPage base="/manager/areas" sp={await searchParams} />;
}
