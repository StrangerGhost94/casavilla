import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PlanForm } from "@/components/BuildAdmin";

export const metadata = { title: "New house plan" };

export default async function NewPlan() {
  await requireUser("manager");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/manager/build/plans" className="link text-sm">← House plans</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold text-brand-950">New house plan</h1>
      <PlanForm />
    </div>
  );
}
