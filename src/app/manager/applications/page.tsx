import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { ApplicationsTable } from "@/components/Portfolio";

export default async function ManagerApplications() {
  await requireUser("manager");
  return <><PageHeader title="All applications" subtitle="You can approve or decline on a landlord's behalf." /><ApplicationsTable where={{}} /></>;
}
