import { requireUser } from "@/lib/auth";
import { AreaPage } from "@/components/AreaPage";

export const metadata = { title: "Portfolio by area" };
export default async function LandlordAreas({ searchParams }: { searchParams: Promise<{ by?: string; in?: string }> }) {
  const u = await requireUser("landlord");
  return <AreaPage landlordId={u.id} base="/landlord/areas" sp={await searchParams} />;
}
