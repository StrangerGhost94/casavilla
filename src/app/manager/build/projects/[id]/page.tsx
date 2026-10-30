import { requireUser } from "@/lib/auth";
import { ProjectManage } from "@/components/BuildAdmin";

export const metadata = { title: "Project" };

export default async function ManageProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fresh?: string }> }) {
  await requireUser("manager");
  return <ProjectManage id={Number((await params).id) || 0} fresh={!!(await searchParams).fresh} />;
}
