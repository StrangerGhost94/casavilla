import { requireUser } from "@/lib/auth";
import { SaleList } from "@/components/SaleAdmin";

export const metadata = { title: "Listings for sale" };

export default async function AgentSale() {
  return <SaleList viewer={await requireUser("agent")} />;
}
