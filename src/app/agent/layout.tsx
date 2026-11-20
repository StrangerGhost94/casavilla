import { requireUser } from "@/lib/auth";
import { PortalShell } from "@/components/PortalShell";

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("agent");
  return (
    <PortalShell user={user}>
      {user.status === "pending" && (
        <div className="mb-5 rounded-2xl border border-gold-200 bg-gold-50 p-3.5 text-sm text-gold-700">
          CasaVilla is checking your account. You can prepare listings now; they go public once you&apos;re approved and each listing is reviewed.
        </div>
      )}
      {children}
    </PortalShell>
  );
}
