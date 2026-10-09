import { requireUser } from "@/lib/auth";
import { CaretakerRent } from "@/components/Caretakers";

export default async function Page() {
  const u = await requireUser("caretaker");
  return <CaretakerRent viewer={u} />;
}
