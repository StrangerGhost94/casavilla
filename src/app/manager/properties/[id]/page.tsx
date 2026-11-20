import { requireUser } from "@/lib/auth";
import { db } from "@/db";
import { PropertyDetail } from "@/components/Portfolio";
import { History } from "@/components/History";

export default async function ManagerProperty({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireUser("manager");
  const id = Number((await params).id) || 0;
  const units = await db.unit.findMany({ where: { propertyId: id }, select: { id: true } });
  return (
    <>
      <PropertyDetail id={id} viewer={u} base="/manager/properties" />
      <div className="mx-auto mt-6 max-w-5xl">
        <History refs={[{ entity: "property", ids: [id] }, { entity: "unit", ids: units.map((x) => x.id) }]} />
      </div>
    </>
  );
}
