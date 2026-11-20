-- Agents: list land and property for sale, and run short stays (never monthly rentals), under CasaVilla's review.
-- (The new 'agent' role is added here but not used by any statement in this file; Postgres requires that.)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'agent';

ALTER TABLE "users"
  ADD COLUMN "sales_commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "id_file_id" INTEGER,
  ADD COLUMN "agreement_file_id" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_sales_commission_chk" CHECK ("sales_commission_pct" >= 0 AND "sales_commission_pct" <= 20);

-- An agent's listing needs the owner's written authority to sell, expires unless renewed, and records what it sold for.
ALTER TABLE "sale_listings"
  ADD COLUMN "mandate_file_id" INTEGER,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "sold_price" DOUBLE PRECISION,
  ADD COLUMN "sale_commission" INTEGER;

-- Anyone can report a listing that looks wrong (already sold, fake, wrong price, someone else's land).
CREATE TABLE "listing_reports" (
  "id" SERIAL PRIMARY KEY,
  "listing_id" INTEGER NOT NULL REFERENCES "sale_listings"("id") ON DELETE CASCADE,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "contact" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "listing_reports_listing_id_status_idx" ON "listing_reports"("listing_id", "status");

-- Agents' listings can expire (status 'expired') when not renewed after 90 days.
ALTER TABLE "sale_listings" DROP CONSTRAINT IF EXISTS "sale_listings_chk";
ALTER TABLE "sale_listings" ADD CONSTRAINT "sale_listings_chk" CHECK (
  "kind" IN ('land', 'house', 'apartment', 'commercial', 'farm')
  AND "status" IN ('pending', 'active', 'under_offer', 'sold', 'withdrawn', 'rejected', 'expired')
  AND "price" > 0 AND "price" = round("price")
  AND ("size_value" IS NULL OR "size_value" > 0)
  AND ("size_unit" IS NULL OR "size_unit" IN ('acres', 'decimals', 'hectares', 'sqm'))
  AND ("tenure" IS NULL OR "tenure" IN ('mailo', 'freehold', 'leasehold', 'customary', 'kibanja'))
  AND "title_status" IN ('titled', 'processing', 'none')
  AND ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 50) AND ("bathrooms" IS NULL OR "bathrooms" BETWEEN 0 AND 50));
