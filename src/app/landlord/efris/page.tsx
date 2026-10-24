import { requireUser } from "@/lib/auth";
import { EfrisPage } from "@/components/Efris";

export const metadata = { title: "EFRIS receipts" };

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string; show?: string }> }) {
  const u = await requireUser("landlord");
  const sp = await searchParams;
  return <EfrisPage viewer={u} tab={sp.tab} show={sp.show} />;
}
