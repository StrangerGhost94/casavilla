import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CasaVilla Property Management", template: "%s · CasaVilla" },
  description: "Rent, maintenance, leases and trusted service providers — CasaVilla Property Management, Kampala.",
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#2e8b3e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
