-- Land & property for sale, with photos and buyer enquiries. Additive only.
CREATE TABLE "sale_listings" (
  "id" SERIAL PRIMARY KEY,
  "owner_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "negotiable" BOOLEAN NOT NULL DEFAULT true,
  "size_value" DOUBLE PRECISION,
  "size_unit" TEXT,
  "plot_dims" TEXT,
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "tenure" TEXT,
  "title_status" TEXT NOT NULL DEFAULT 'titled',
  "title_verified" BOOLEAN NOT NULL DEFAULT false,
  "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "location" TEXT NOT NULL,
  "location_id" TEXT REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "estate" TEXT, "street" TEXT, "plot" TEXT, "landmark" TEXT,
  "lat" DOUBLE PRECISION, "lng" DOUBLE PRECISION, "coord_accuracy_m" INTEGER, "coord_source" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "review_note" TEXT,
  "photo_id" INTEGER,
  "views" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3), "sold_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_listings_chk" CHECK (
    "kind" IN ('land', 'house', 'apartment', 'commercial', 'farm')
    AND "status" IN ('pending', 'active', 'under_offer', 'sold', 'withdrawn', 'rejected')
    AND "price" > 0 AND "price" = round("price")
    AND ("size_value" IS NULL OR "size_value" > 0)
    AND ("size_unit" IS NULL OR "size_unit" IN ('acres', 'decimals', 'hectares', 'sqm'))
    AND ("tenure" IS NULL OR "tenure" IN ('mailo', 'freehold', 'leasehold', 'customary', 'kibanja'))
    AND "title_status" IN ('titled', 'processing', 'none')
    AND ("bedrooms" IS NULL OR "bedrooms" BETWEEN 0 AND 50) AND ("bathrooms" IS NULL OR "bathrooms" BETWEEN 0 AND 50))
);
CREATE INDEX "sale_listings_status_kind_idx" ON "sale_listings"("status", "kind");
CREATE INDEX "sale_listings_owner_id_idx" ON "sale_listings"("owner_id");
CREATE INDEX "sale_listings_location_id_idx" ON "sale_listings"("location_id");

CREATE TABLE "sale_photos" (
  "id" SERIAL PRIMARY KEY,
  "listing_id" INTEGER NOT NULL REFERENCES "sale_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "file_id" INTEGER NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "is_cover" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sale_photos_listing_id_idx" ON "sale_photos"("listing_id");
CREATE UNIQUE INDEX "sale_photos_one_cover" ON "sale_photos"("listing_id") WHERE "is_cover";

CREATE TABLE "sale_enquiries" (
  "id" SERIAL PRIMARY KEY,
  "listing_id" INTEGER NOT NULL REFERENCES "sale_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "message" TEXT,
  "wants_viewing" BOOLEAN NOT NULL DEFAULT false,
  "viewing_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'new',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_enquiries_chk" CHECK ("status" IN ('new', 'contacted', 'closed'))
);
CREATE INDEX "sale_enquiries_listing_id_status_idx" ON "sale_enquiries"("listing_id", "status");
CREATE INDEX "sale_enquiries_phone_created_at_idx" ON "sale_enquiries"("phone", "created_at");
