import { requireUser } from "@/lib/auth";
import { SaleManage } from "@/components/SaleAdmin";
import { History } from "@/components/History";

export default async function ManagerSaleListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const u = await requireUser("manager");
  const id = Number((await params).id) || 0;
  return (
    <>
      <SaleManage viewer={u} id={id} fresh={(await searchParams).new === "1"} />
      <div className="mx-auto mt-6 max-w-5xl"><History refs={[{ entity: "sale", ids: [id] }]} /></div>
    </>
  );
}
