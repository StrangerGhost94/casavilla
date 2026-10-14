"use client";
import { usePathname } from "next/navigation";

// Sign in / sign up open full-screen like an app: no website header, footer, tab bar or install card.
const FULL_SCREEN = ["/login", "/register"];

export function PublicChrome({ header, footer, extras, children }: { header: React.ReactNode; footer: React.ReactNode; extras: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  if (FULL_SCREEN.includes(path)) return <div className="public-chrome min-h-[100dvh] bg-cream">{children}</div>;
  return (
    <div className="public-chrome flex min-h-[100dvh] flex-col bg-cream">
      {header}
      <div className="flex-1">{children}</div>
      {/* Room for the bottom tab bar on phones (browser and installed app alike). */}
      <div className="h-[calc(5.5rem+env(safe-area-inset-bottom))] lg:hidden" aria-hidden />
      {footer}
      {extras}
    </div>
  );
}
