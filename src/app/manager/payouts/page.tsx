import { requireUser } from "@/lib/auth";
import { ManagerPayouts, PAYOUT_STATUS } from "@/components/Payouts";

export const metadata = { title: "Payouts" };

export default async function Page({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("manager");
  const { status } = await searchParams;
  return <ManagerPayouts status={status && status in PAYOUT_STATUS ? status : undefined} />;
}
