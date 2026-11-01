# Performance

## Measurements

Mobile Lighthouse (simulated slow 4G, throttled phone).

| Page | Measure | Before (live, 1 Nov 2026) | After (live, 1 Nov 2026) |
|---|---|---|---|
| Home | Score | 68 | 87 |
| Home | Main content visible (LCP) | 5.8 s | 3.5 s |
| Home | Page weight | 984 KB | 539 KB |
| Listings | Score | 85 | 93 |
| Listings | Main content visible (LCP) | 4.2 s | 2.8 s |
| Listings | Page weight | 639 KB | 367 KB |

Re-measure with `npx lighthouse https://casavillaproperties.com --form-factor=mobile`.

Real visitors' speed (including INP, which lab tests can't measure) is on **Manager → System health → Real-user speed**.

Live server reply times before (from Kampala, 1 Nov 2026): 0.5–2.8 s per page. Even a tiny static file took about 0.35 s after
connecting, which points to the server being far from Uganda (see item 19).

Database queries per page (no page grows with the number of items): home 15, listing 10, area page 6, services 5, sale listing 5,
listings 3, build 3, stays 2, sale 2, shop 2. Set `PRISMA_LOG=1` to print every query.

## The 31-point audit

| # | Fix | Status | Notes |
|---|---|---|---|
| 01 | Skeleton screens | Done | `loading.tsx` for the marketplace, detail pages and every signed-in area |
| 02 | WebP/AVIF images | Done | Logo 286 KB → 18 KB, launch photo 272 KB → 92 KB; uploads already served as resized WebP |
| 03 | Duplicate API calls | Done | Server-rendered, few client fetches; submit buttons disable while sending; one pending MoMo payment at a time |
| 04 | Debounced search | Done | Location search debounced 300 ms; stale replies are ignored |
| 05 | Pagination | Later | Lists are capped (60 homes, 100 stays, 300 providers/products). Add "Load more" when listings near 60 |
| 06 | CDN | **Your call** | Railway has no CDN cache. Cloudflare's free plan could cache static files; needs a DNS change |
| 07 | Background jobs | Done | Emails, messages and payouts already queue; phone pushes no longer hold up the action |
| 08 | N+1 queries | Done | Fixed the short-stay date search (up to 100 queries → 1) |
| 09 | Compression | Done | Gzip on. Brotli would come with Cloudflare |
| 10 | Redis | Not needed | Queries are few and small. Adds a paid service for no real gain at this size |
| 11 | Unused dependencies | Done | Removed the unused Playfair font |
| 12 | Timeouts | Done | Flutterwave and email calls now have limits (messaging already did) |
| 13 | AI streaming | Not relevant | No AI features |
| 14 | Optimistic UI | Partly | Save button is instant; other actions show progress |
| 15 | Lazy-load images | Done | Below-the-screen photos are lazy; the main photo gets high priority |
| 16 | Parallel requests | Done | Listing page's independent lookups now run together |
| 17 | Database indexes | Done | 20 added (migration `9_z18_indexes`) |
| 18 | Tracing | Later | Query log and real-user speed cover today's needs |
| 19 | Server near database and users | **Your call** | Check Railway's regions: app and database in the same one, and the nearest to Uganda |
| 20 | Server rendering | Done | Pages render on the server |
| 21 | Third-party scripts | Done | None |
| 22 | Code splitting | Done | Per-page bundles; maps load only when needed; 103 KB shared |
| 23 | Virtualized lists | Not relevant | Lists are capped and short |
| 24 | Select only needed columns | Done | Photo route no longer reads the original image's bytes when a small copy exists |
| 25 | Connection pooling | Done | One Prisma client and pool per server |
| 26 | Re-renders | Not relevant | Mostly server components |
| 27 | Browser caching | Done | Logo, photos and icons cached a week; hashed files a year |
| 28 | Load balancing | Not relevant | One instance is plenty for now (real-user speed figures are kept per server) |
| 29 | Fonts | Done | Self-hosted Inter only |
| 30 | Real-user monitoring | Done | Built in, no paid service, no personal data |
| 31 | Slow phones and networks | Partly | Lighthouse throttled tests done; try a cheap Android on 3G too |
