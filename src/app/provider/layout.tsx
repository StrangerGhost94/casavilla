import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("provider");
  return (
    <PortalShell user={user}>
      {user.status === "pending" && (
        <div className="mb-5 rounded-2xl border border-gold-200 bg-gold-50 p-3.5 text-sm text-gold-700">
          CasaVilla is verifying your business. Add your services and items now — you&apos;ll appear in the directory and receive jobs once approved.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
