import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./globals.css";
import { Suspense } from "react";
import { RegisterSW } from "@/components/InstallApp";
import { Flash } from "@/components/Flash";
import { StandaloneFileLinks } from "@/components/FileButton";
import { startupImages } from "@/lib/splash";

export const metadata: Metadata = {
  title: { default: "CasaVilla Property Management", template: "%s · CasaVilla" },
  description: "Connect. Manage. Grow. Rent, maintenance, leases and trusted service providers — CasaVilla Property Management, Kampala.",
  applicationName: "CasaVilla",
  icons: {
    icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CasaVilla", statusBarStyle: "black-translucent", startupImage: startupImages },
  formatDetection: { telephone: false },
  other: { "apple-mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { themeColor: "#0e3628", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}<Suspense fallback={null}><Flash /></Suspense><RegisterSW /><StandaloneFileLinks /></body>
    </html>
  );
}
