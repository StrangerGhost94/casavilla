import { requireUser } from "@/lib/auth";
import { SaleList } from "@/components/SaleAdmin";

export const metadata = { title: "For sale" };

export default async function ManagerSale({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const u = await requireUser("manager");
  return <SaleList viewer={u} tab={(await searchParams).tab} />;
}
