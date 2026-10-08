import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Submit } from "@/components/client";
import { TenantsTable } from "@/components/Portfolio";
import { generateCharges } from "../actions";

export default async function ManagerTenants() {
  await requireUser("manager");
  return (
    <>
      <PageHeader title="Leases & rent" subtitle="Rent charges are raised automatically each month on the lease's due day."
        actions={<form action={generateCharges}><Submit className="btn-outline">Refresh rent charges</Submit></form>} />
      <TenantsTable where={{}} base="/manager/tenants" />
    </>
  );
}
