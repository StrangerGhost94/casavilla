import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("provider");
  return (
    <PortalShell user={user} nav={[
      { href: "/provider", label: "Overview" },
      { href: "/provider/jobs", label: "Jobs" },
      { href: "/provider/services", label: "My services" },
      { href: "/provider/products", label: "Items for sale" },
      { href: "/provider/orders", label: "Orders" },
      { href: "/provider/profile", label: "Business profile" },
    ]}>
      {user.status === "pending" && (
        <div className="mb-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          CasaVilla is verifying your business. Add your services and items now — you&apos;ll appear in the directory and receive jobs once approved.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
