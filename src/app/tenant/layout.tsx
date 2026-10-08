import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("tenant");
  return (
    <PortalShell user={user}>{children}</PortalShell>
  );
}
