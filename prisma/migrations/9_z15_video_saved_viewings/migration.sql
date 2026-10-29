-- Named "9_z15_…" so it sorts after "9_file_variants": Prisma applies migrations in name order, and this one
-- needs tables from 7_sales. (15th migration.)
-- Video tours, shop sections, saved homes, search alerts and viewing requests.
ALTER TABLE "properties" ADD COLUMN "video_url" TEXT;
ALTER TABLE "sale_listings" ADD COLUMN "video_url" TEXT;
ALTER TABLE "products" ADD COLUMN "category" TEXT;

CREATE TABLE "saved_listings" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "item_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_listings_kind_chk" CHECK ("kind" IN ('rent', 'stay', 'sale'))
);
CREATE UNIQUE INDEX "saved_listings_user_id_kind_item_id_key" ON "saved_listings"("user_id", "kind", "item_id");
ALTER TABLE "saved_listings" ADD CONSTRAINT "saved_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "search_alerts" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "params" JSONB NOT NULL,
  "label" TEXT NOT NULL,
  "last_seen_id" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "search_alerts_kind_chk" CHECK ("kind" IN ('rent', 'stays', 'sale'))
);
CREATE INDEX "search_alerts_user_id_idx" ON "search_alerts"("user_id");
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "viewings" (
  "id" SERIAL NOT NULL,
  "unit_id" INTEGER,
  "sale_listing_id" INTEGER,
  "requester_id" INTEGER NOT NULL,
  "host_id" INTEGER NOT NULL,
  "at" TIMESTAMP(3) NOT NULL,
  "note" TEXT,
  "host_note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "viewings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "viewings_target_chk" CHECK (("unit_id" IS NULL) <> ("sale_listing_id" IS NULL)),
  CONSTRAINT "viewings_status_chk" CHECK ("status" IN ('requested', 'confirmed', 'proposed', 'declined', 'cancelled'))
);
CREATE INDEX "viewings_host_id_status_idx" ON "viewings"("host_id", "status");
CREATE INDEX "viewings_requester_id_idx" ON "viewings"("requester_id");
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_sale_listing_id_fkey" FOREIGN KEY ("sale_listing_id") REFERENCES "sale_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
