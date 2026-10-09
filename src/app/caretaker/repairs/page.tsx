import { requireUser } from "@/lib/auth";
import { CaretakerRepairs } from "@/components/Caretakers";

export default async function Page() {
  const u = await requireUser("caretaker");
  return <CaretakerRepairs viewer={u} />;
}
