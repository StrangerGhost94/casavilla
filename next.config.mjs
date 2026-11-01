/** @type {import('next').NextConfig} */
const week = "public, max-age=604800, stale-while-revalidate=2592000";
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  poweredByHeader: false,
  // People get the page in pieces (skeleton first). Search engines and link previews get it whole, with every title and description in <head>.
  htmlLimitedBots: /bot|crawl|spider|slurp|google|bing|facebook|whatsapp|twitter|telegram|linkedin|slack|discord|lighthouse-seo/i,
  // Files in public/ have no hash in their name, so a week (not forever). Next's own hashed files are already cached for a year.
  async headers() {
    return ["/:file(logo.*|launch.*)", "/icons/:path*", "/splash/:path*", "/og-image.jpg", "/icon.svg"].map((source) => ({
      source, headers: [{ key: "Cache-Control", value: week }],
    }));
  },
};
export default nextConfig;
