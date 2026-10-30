import { requireUser } from "@/lib/auth";
import { ProjectList } from "@/components/BuildAdmin";

export const metadata = { title: "Our work" };

export default async function ManagerProjects() {
  await requireUser("manager");
  return <ProjectList />;
}
