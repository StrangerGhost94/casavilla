import { requireUser } from "@/lib/auth";
import { SiteList } from "@/components/BuildSiteAdmin";

export const metadata = { title: "Builds" };

export default async function ManagerSites() {
  await requireUser("manager");
  return <SiteList />;
}
