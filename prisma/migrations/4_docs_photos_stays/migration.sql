-- Receipts & agreements branding, guided listing photos, richer unit details, short stays, email outbox.
-- Additive only; existing data keeps working with the defaults below.

ALTER TABLE "users" ADD COLUMN "email_receipts" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "units"
  ADD COLUMN "bathrooms" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "self_contained" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "furnished" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "size_sqm" INTEGER,
  ADD COLUMN "amenities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'long',
  ADD COLUMN "nightly_rate" INTEGER,
  ADD COLUMN "cleaning_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "min_nights" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "max_guests" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "check_in_from" TEXT NOT NULL DEFAULT '14:00',
  ADD COLUMN "check_out_by" TEXT NOT NULL DEFAULT '10:00',
  ADD COLUMN "house_rules" TEXT;
ALTER TABLE "units" ADD CONSTRAINT "units_detail_chk" CHECK (
  "bathrooms" BETWEEN 0 AND 20 AND ("size_sqm" IS NULL OR "size_sqm" > 0) AND "mode" IN ('long', 'short')
  AND ("mode" = 'long' OR ("nightly_rate" IS NOT NULL AND "nightly_rate" > 0))
  AND "cleaning_fee" >= 0 AND "min_nights" BETWEEN 1 AND 90 AND "max_guests" BETWEEN 1 AND 30);

ALTER TABLE "leases" ADD COLUMN "next_rent" INTEGER, ADD COLUMN "next_rent_from" DATE, ADD COLUMN "special_terms" TEXT;
ALTER TABLE "leases" ADD CONSTRAINT "leases_next_rent_chk" CHECK (("next_rent" IS NULL) = ("next_rent_from" IS NULL) AND ("next_rent" IS NULL OR "next_rent" > 0));

ALTER TABLE "documents" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'upload';

CREATE TABLE "brand_profiles" (
    "id" SERIAL NOT NULL,
    "owner_id" INTEGER,
    "display_name" TEXT NOT NULL,
    "address" TEXT, "phone" TEXT, "email" TEXT, "tin" TEXT,
    "accent_color" TEXT NOT NULL DEFAULT '#124331',
    "footer_note" TEXT, "signatory" TEXT, "signatory_title" TEXT,
    "show_casavilla" BOOLEAN NOT NULL DEFAULT true,
    "logo_file_id" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "brand_profiles_color_chk" CHECK ("accent_color" ~ '^#[0-9a-fA-F]{6}$')
);
CREATE UNIQUE INDEX "brand_profiles_owner_id_key" ON "brand_profiles"("owner_id");
-- Only one CasaVilla default (owner_id NULL).
CREATE UNIQUE INDEX "brand_profiles_one_default" ON "brand_profiles"((owner_id IS NULL)) WHERE "owner_id" IS NULL;
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "property_photos" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "unit_id" INTEGER,
    "file_id" INTEGER NOT NULL,
    "room" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "width" INTEGER, "height" INTEGER, "quality" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "property_photos_chk" CHECK ("room" IN ('exterior','compound','living','kitchen','bedroom','bathroom','dining','balcony','view','other') AND ("quality" IS NULL OR "quality" BETWEEN 0 AND 100))
);
CREATE INDEX "property_photos_property_id_idx" ON "property_photos"("property_id");
CREATE INDEX "property_photos_unit_id_idx" ON "property_photos"("unit_id");
CREATE UNIQUE INDEX "property_photos_one_cover" ON "property_photos"("property_id") WHERE "is_cover";
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Existing single cover photos become the first gallery photo.
INSERT INTO "property_photos" ("property_id", "file_id", "room", "label", "is_cover")
SELECT "id", "photo_id", 'exterior', 'Front of the property', true FROM "properties" WHERE "photo_id" IS NOT NULL;

CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "unit_id" INTEGER NOT NULL,
    "guest_id" INTEGER NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "nights" INTEGER NOT NULL,
    "guests" INTEGER NOT NULL DEFAULT 1,
    "nightly" INTEGER NOT NULL,
    "cleaning_fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL,
    "method" TEXT, "phone" TEXT, "receipt_no" TEXT,
    "paid_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bookings_values_chk" CHECK ("check_out" > "check_in" AND "nights" = ("check_out" - "check_in") AND "guests" >= 1 AND "nightly" >= 0 AND "cleaning_fee" >= 0
      AND "total" = "nightly" * "nights" + "cleaning_fee"
      AND "status" IN ('pending','confirmed','cancelled','completed','expired','blocked'))
);
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");
CREATE INDEX "bookings_unit_id_check_in_idx" ON "bookings"("unit_id", "check_in");
CREATE INDEX "bookings_guest_id_idx" ON "bookings"("guest_id");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- The database itself refuses two live bookings on the same unit for overlapping nights (when btree_gist exists;
-- the app also checks inside a locked transaction).
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("unit_id" WITH =, daterange("check_in", "check_out", '[)') WITH &&)
    WHERE ("status" IN ('pending', 'confirmed', 'blocked'));
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'btree_gist not available — overlap protection stays in the application';
END $$;

CREATE TABLE "email_outbox" (
    "id" SERIAL NOT NULL,
    "to_email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "attach_kind" TEXT,
    "attach_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "email_outbox_status_chk" CHECK ("status" IN ('queued', 'sent', 'failed'))
);
CREATE INDEX "email_outbox_status_created_at_idx" ON "email_outbox"("status", "created_at");
