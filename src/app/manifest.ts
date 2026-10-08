import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "CasaVilla Property Management",
    short_name: "CasaVilla",
    description: "Connect. Manage. Grow. Rent, Mobile Money payments, repairs and trusted service providers in Kampala.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e3628",
    theme_color: "#0e3628",
    categories: ["business", "lifestyle", "finance"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Pay rent", url: "/tenant/rent", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Report an issue", url: "/tenant/requests/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Find a home", url: "/listings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
