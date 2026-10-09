import { requireUser } from "@/lib/auth";
import { CaretakerAdmin } from "@/components/Caretakers";

export const metadata = { title: "Caretakers" };

export default async function LandlordCaretakers() {
  const u = await requireUser("landlord");
  return <CaretakerAdmin landlordId={u.id} />;
}
