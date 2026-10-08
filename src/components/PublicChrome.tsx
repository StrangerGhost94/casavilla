"use client";
import { usePathname } from "next/navigation";

// Sign in / sign up open full-screen like an app: no website header, footer, tab bar or install card.
const FULL_SCREEN = ["/login", "/register"];

export function PublicChrome({ header, footer, extras, children }: { header: React.ReactNode; footer: React.ReactNode; extras: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  if (FULL_SCREEN.includes(path)) return <div className="min-h-[100dvh] bg-cream">{children}</div>;
  return (
    <>
      {header}
      {children}
      <div className="app-only h-28" aria-hidden />
      {footer}
      {extras}
    </>
  );
}
