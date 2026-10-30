import { requireUser } from "@/lib/auth";
import { RequestList } from "@/components/BuildAdmin";

export const metadata = { title: "Build & construction" };

export default async function ManagerBuild({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireUser("manager");
  return <RequestList tab={(await searchParams).tab} />;
}
