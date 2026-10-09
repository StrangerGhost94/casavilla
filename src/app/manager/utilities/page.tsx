import { requireUser } from "@/lib/auth";
import { UtilitiesPage } from "@/components/Utilities";

export const metadata = { title: "Utilities & meters" };

export default async function ManagerUtilities() {
  const u = await requireUser("manager");
  return <UtilitiesPage viewer={u} />;
}
