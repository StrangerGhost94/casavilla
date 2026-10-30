import { requireUser } from "@/lib/auth";
import { SiteManage } from "@/components/BuildSiteAdmin";

export const metadata = { title: "Build" };

export default async function ManageSite({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ update?: string }> }) {
  await requireUser("manager");
  return <SiteManage id={Number((await params).id) || 0} update={Number((await searchParams).update) || undefined} />;
}
