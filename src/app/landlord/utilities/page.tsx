import { requireUser } from "@/lib/auth";
import { UtilitiesPage } from "@/components/Utilities";

export const metadata = { title: "Utilities & meters" };

export default async function LandlordUtilities() {
  const u = await requireUser("landlord");
  return <UtilitiesPage viewer={u} />;
}
