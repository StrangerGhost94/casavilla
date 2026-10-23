import { requireUser } from "@/lib/auth";
import { LandlordPayouts } from "@/components/Payouts";

export const metadata = { title: "Payouts" };

export default async function Page() {
  const u = await requireUser("landlord");
  return <LandlordPayouts viewer={u} />;
}
