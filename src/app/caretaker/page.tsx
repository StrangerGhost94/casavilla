import { requireUser } from "@/lib/auth";
import { CaretakerHome } from "@/components/Caretakers";

export default async function Page() {
  const u = await requireUser("caretaker");
  return <CaretakerHome viewer={u} />;
}
