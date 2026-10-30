import { requireUser } from "@/lib/auth";
import { PlanManage } from "@/components/BuildAdmin";

export const metadata = { title: "House plan" };

export default async function ManagePlan({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> }) {
  await requireUser("manager");
  return <PlanManage id={Number((await params).id) || 0} fresh={!!(await searchParams).fresh} />;
}
