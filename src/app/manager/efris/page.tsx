import { requireUser } from "@/lib/auth";
import { EfrisPage } from "@/components/Efris";

export const metadata = { title: "EFRIS receipts" };

export default async function Page() {
  const u = await requireUser("manager");
  return <EfrisPage viewer={u} />;
}
