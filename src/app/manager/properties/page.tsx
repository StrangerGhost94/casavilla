import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";

export default async function ManagerProperties() {
  await requireUser("manager");
  return (
    <>
      <PageHeader title="All properties" actions={<Link href="/manager/properties/new" className="btn-primary">Add property for a landlord</Link>} />
      <PropertyList where={{}} base="/manager/properties" />
    </>
  );
}
