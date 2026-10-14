import type { Viewport } from "next";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/SiteFooter";
import { InstallPrompt } from "@/components/InstallApp";
import { PublicChrome } from "@/components/PublicChrome";

// The phone's status-bar tint matches the marketplace header exactly (a lighter green band read as "fog").
export const viewport: Viewport = { themeColor: "#09251b" };

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicChrome header={<PublicHeader />} footer={<PublicFooter />} extras={<InstallPrompt />}>
      {children}
    </PublicChrome>
  );
}
