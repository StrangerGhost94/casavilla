import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("landlord");
  return (
    <PortalShell user={user} nav={[
      { href: "/landlord", label: "Overview" },
      { href: "/landlord/properties", label: "Properties & units" },
      { href: "/landlord/applications", label: "Applications" },
      { href: "/landlord/tenants", label: "Tenants & rent" },
      { href: "/landlord/maintenance", label: "Maintenance" },
      { href: "/services", label: "Service providers" },
      { href: "/shop", label: "Shop" },
    ]}>
      {user.status === "pending" && (
        <div className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          CasaVilla is reviewing your account. You can set up properties now — your listings go public once you&apos;re approved.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
