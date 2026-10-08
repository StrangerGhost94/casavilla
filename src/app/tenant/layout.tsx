import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("tenant");
  return (
    <PortalShell user={user} nav={[
      { href: "/tenant", label: "Home" },
      { href: "/tenant/rent", label: "Rent & receipts" },
      { href: "/tenant/requests", label: "Repairs" },
      { href: "/tenant/lease", label: "My lease" },
      { href: "/tenant/applications", label: "Applications" },
      { href: "/listings", label: "Find a home" },
      { href: "/services", label: "Book a service" },
      { href: "/orders", label: "My orders" },
    ]}>{children}</PortalShell>
  );
}
