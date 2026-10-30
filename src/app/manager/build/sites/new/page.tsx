import { requireUser } from "@/lib/auth";
import { SiteForm } from "@/components/BuildSiteAdmin";

export const metadata = { title: "Start a build" };

export default async function NewSite({ searchParams }: { searchParams: Promise<{ request?: string }> }) {
  await requireUser("manager");
  return <SiteForm requestId={Number((await searchParams).request) || undefined} />;
}
