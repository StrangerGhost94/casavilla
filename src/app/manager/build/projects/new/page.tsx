import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ProjectForm } from "@/components/BuildAdmin";

export const metadata = { title: "New project" };

export default async function NewProject() {
  await requireUser("manager");
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/manager/build/projects" className="link text-sm">← Our work</Link>
      <h1 className="mb-4 mt-2 text-xl font-bold text-brand-950">Add a past project</h1>
      <ProjectForm />
    </div>
  );
}
