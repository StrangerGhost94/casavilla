import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function CaretakerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("caretaker");
  return <PortalShell user={user}>{children}</PortalShell>;
}
