import { requireUser } from "@/lib/auth";
import { UtilitiesPage } from "@/components/Utilities";

export const metadata = { title: "Meter readings" };

export default async function CaretakerMeters() {
  const u = await requireUser("caretaker");
  return <UtilitiesPage viewer={u} />;
}
