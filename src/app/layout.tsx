import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/playfair-display/600.css";
import "@fontsource/playfair-display/700.css";
import "./globals.css";
import { Suspense } from "react";
import { RegisterSW } from "@/components/InstallApp";
import { Flash } from "@/components/Flash";
import { StandaloneFileLinks, ViewportFix } from "@/components/FileButton";
import { startupImages } from "@/lib/splash";
import { SITE } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "CasaVilla — Houses for Rent, Land for Sale & Short Stays in Kampala, Uganda", template: "%s · CasaVilla" },
  description: "Find houses and apartments for rent, short stays, and land and property for sale in Kampala, Wakiso, Mukono and across Uganda. Verified listings, rent paid by Mobile Money, and property management by CasaVilla.",
  keywords: ["houses for rent in Kampala", "apartments for rent Kampala", "land for sale in Uganda", "plots for sale Kampala", "short stays Kampala", "property management Uganda", "rentals Uganda"],
  openGraph: { type: "website", siteName: "CasaVilla", locale: "en_UG", images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "CasaVilla — homes, land and short stays in Uganda" }] },
  twitter: { card: "summary_large_image" },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined },
  formatDetection: { telephone: false, email: false, address: false },
  applicationName: "CasaVilla",
  icons: {
    icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "CasaVilla", statusBarStyle: "black-translucent", startupImage: startupImages },
  other: { "apple-mobile-web-app-capable": "yes" },
};
export const viewport: Viewport = { themeColor: "#0e3628", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-UG">
      <body>{children}<Suspense fallback={null}><Flash /></Suspense><RegisterSW /><StandaloneFileLinks /><ViewportFix /></body>
    </html>
  );
}
