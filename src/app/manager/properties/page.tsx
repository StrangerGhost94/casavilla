import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PropertyList } from "@/components/Portfolio";
import { AGENT_WAITING } from "@/lib/queries";

/** "To verify": listed homes no one from CasaVilla has visited yet (the dashboard links here). */
export default async function ManagerProperties({ searchParams }: { searchParams: Promise<{ show?: string; landlord?: string }> }) {
  await requireUser("manager");
  const sp = await searchParams;
  const verify = sp.show === "verify";
  const owner = Number(sp.landlord) || undefined;
  return (
    <>
      <PageHeader title="All properties" actions={<Link href="/manager/properties/new" className="btn-primary">Add property for a landlord</Link>} />
      <div className="mb-4 flex gap-2">
        <Link href="/manager/properties" className={verify ? "chip" : "chip-active"}>All</Link>
        <Link href="/manager/properties?show=verify" className={verify ? "chip-active" : "chip"}>To visit & verify</Link>
      </div>
      <PropertyList where={{ ...(owner ? { landlordId: owner } : {}), ...(verify ? { verifiedAt: null, OR: [{ units: { some: { listed: true, status: "vacant" } } }, AGENT_WAITING] } : {}) }} base="/manager/properties" />
    </>
  );
}
