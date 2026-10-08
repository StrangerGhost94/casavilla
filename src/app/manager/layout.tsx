import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("manager");
  return (
    <PortalShell user={user} nav={[
      { href: "/manager", label: "Dashboard" },
      { href: "/manager/people", label: "People & approvals" },
      { href: "/manager/properties", label: "Properties" },
      { href: "/manager/applications", label: "Applications" },
      { href: "/manager/tenants", label: "Leases & rent" },
      { href: "/manager/payments", label: "Payments" },
      { href: "/manager/jobs", label: "Maintenance jobs" },
      { href: "/manager/orders", label: "Shop orders" },
    ]}>{children}</PortalShell>
  );
}
