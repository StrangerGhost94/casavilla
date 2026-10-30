import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";

/** "To verify": listed homes no one from CasaVilla has visited yet (the dashboard links here). */
export default async function ManagerProperties({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireUser("manager");
  const verify = (await searchParams).show === "verify";
  return (
    <>
      <PageHeader title="All properties" actions={<Link href="/manager/properties/new" className="btn-primary">Add property for a landlord</Link>} />
      <div className="mb-4 flex gap-2">
        <Link href="/manager/properties" className={verify ? "chip" : "chip-active"}>All</Link>
        <Link href="/manager/properties?show=verify" className={verify ? "chip-active" : "chip"}>To visit & verify</Link>
      </div>
      <PropertyList where={verify ? { verifiedAt: null, units: { some: { listed: true, status: "vacant" } } } : {}} base="/manager/properties" />
    </>
  );
}
