import { requireUser } from "@/lib/auth";
import { CaretakerExpenses } from "@/components/Caretakers";

export default async function Page() {
  const u = await requireUser("caretaker");
  return <CaretakerExpenses viewer={u} />;
}
