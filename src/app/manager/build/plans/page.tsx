import { requireUser } from "@/lib/auth";
import { PlanList } from "@/components/BuildAdmin";

export const metadata = { title: "House plans" };

export default async function ManagerPlans() {
  await requireUser("manager");
  return <PlanList />;
}
