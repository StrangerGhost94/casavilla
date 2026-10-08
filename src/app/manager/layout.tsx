import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("manager");
  return (
    <PortalShell user={user}>{children}</PortalShell>
  );
}
