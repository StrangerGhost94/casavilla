import { db } from "@/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BrandForm } from "@/components/BrandForm";

export const metadata = { title: "Receipts & documents" };
export default async function LandlordDocuments() {
  const u = await requireUser("landlord");
  const sample = await db.payment.findFirst({ where: { status: "success", lease: { landlordId: u.id } }, orderBy: { id: "desc" }, select: { id: true } });
  return <div className="max-w-2xl"><PageHeader title="Receipts & documents" /><BrandForm ownerId={u.id} sampleReceiptId={sample?.id} /></div>;
}
