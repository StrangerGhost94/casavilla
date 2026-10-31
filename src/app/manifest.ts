import type { MetadataRoute } from "next";
import { ANDROID_PACKAGE, PLAY_URL } from "@/lib/android";

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
    // Once the Play Store app is live, Android can point people to it (the web install keeps working too).
    ...(PLAY_URL ? { related_applications: [{ platform: "play", url: PLAY_URL, id: ANDROID_PACKAGE }], prefer_related_applications: false } : {}),
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
