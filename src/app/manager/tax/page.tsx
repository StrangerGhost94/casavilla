import { requireUser } from "@/lib/auth";
import { TaxForUra } from "@/components/Payouts";

export const metadata = { title: "Tax for URA" };

export default async function Page() {
  await requireUser("manager");
  return <TaxForUra />;
}
