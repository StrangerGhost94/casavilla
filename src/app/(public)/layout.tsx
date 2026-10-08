import { PublicFooter, PublicHeader } from "@/components/PublicHeader";
import { InstallPrompt } from "@/components/InstallApp";
import { PublicChrome } from "@/components/PublicChrome";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicChrome header={<PublicHeader />} footer={<PublicFooter />} extras={<InstallPrompt />}>
      {children}
    </PublicChrome>
  );
}
