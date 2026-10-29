# Getting found on Google

## What the site does (in code)

- **sitemap.xml** (`src/app/sitemap.ts`): the marketplace pages, every listing, stay, sale and provider, and every
  area page that has listings. Updated hourly.
- **robots.txt** (`src/app/robots.ts`): private areas, receipts, the API and sorted/near-me variants are kept out.
- **Readable addresses**: `/listings/9-2-bedroom-apartment-for-rent-rubaga`, `/sale/3-50x100-plot-in-kira`,
  `/services/8-sparkle-clean-ug`. Old number-only links still work and point Google to the readable one (canonical).
- **Titles and descriptions** on every page, written the way people search ("2-bedroom apartment for rent in
  Ntinda — UGX 850,000 a month"), with the listing's photo for WhatsApp/Facebook/Google previews.
- **Structured data (schema.org)**: CasaVilla as a real-estate agent in Kampala (home page), the site search box,
  each listing (RealEstateListing with price, rooms, address, map pin), breadcrumbs, providers
  (HomeAndConstructionBusiness, star rating only from real reviews), and FAQs on area pages.
- **Area pages**: `/houses-for-rent/<area>`, `/short-stays/<area>`, `/land-for-sale/<area>`, `/houses-for-sale/<area>`
  — real listings and real prices for the place, FAQs, and links to nearby areas. Empty ones are `noindex` until
  they have listings. The footer's "Popular searches" links them all.
- Unavailable listings (let, archived, sold) are `noindex` so Google doesn't send people to dead ends.

## What only you can do (most important first)

1. **Use your own domain** (e.g. `casavilla.ug` or `casavilla.co.ug`): add it in Railway → Settings → Domains,
   then set `APP_URL=https://casavilla.ug` in Railway Variables. Every link, the sitemap and the canonical tags
   follow `APP_URL`. A `railway.app` address ranks far worse and looks less trustworthy.
2. **Google Search Console** (search.google.com/search-console): add the domain, choose "HTML tag", copy only the
   `content="…"` value into Railway as `GOOGLE_SITE_VERIFICATION`, redeploy, press Verify, then submit
   `https://<your domain>/sitemap.xml`. (Bing Webmaster Tools: `BING_SITE_VERIFICATION`.)
3. **Google Business Profile** (business.google.com): "CasaVilla Property Management", category *Property
   management company* (+ *Real estate agency*), the Rubaga Road address, both phone numbers and the website.
   Ask every happy tenant and landlord for a Google review — reviews drive the map results ("rentals near me").
4. **Real social pages**: create the Facebook, Instagram and TikTok pages and put their links in
   `src/lib/social.ts` (remove `placeholder: true`). They then appear in the site's structured data too.
5. **Listings with photos, a video and a description** rank and convert best — the Listing strength card shows
   landlords what's missing.
6. **Links from other sites**: Uganda business directories, partner landlords' and providers' pages, local news
   or blogs about renting in Kampala.
