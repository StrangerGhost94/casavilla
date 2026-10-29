import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

/** Search engines may read the marketplace; private areas, receipts and the API are off limits. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: ["/tenant", "/landlord", "/manager", "/provider", "/caretaker", "/api/", "/receipts", "/profile", "/notifications", "/saved", "/viewings", "/orders", "/pay", "/statements", "/reports", "/leases", "/inspections", "/stays/book", "/*?*sort=", "/*?*lat="],
    }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
