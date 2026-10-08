import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("landlord");
  return (
    <PortalShell user={user}>
      {user.status === "pending" && (
        <div className="mb-5 rounded-2xl border border-gold-200 bg-gold-50 p-3.5 text-sm text-gold-700">
          CasaVilla is reviewing your account. You can set up properties now — your listings go public once you&apos;re approved.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
