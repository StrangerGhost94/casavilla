-- Uganda location intelligence: canonical administrative locations shared by every module.
-- Additive only: existing addresses are kept as they are; the locations themselves are loaded by
-- scripts/import-locations.mjs on start.

CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "level" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "search_key" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "coord_accuracy_m" INTEGER,
    "dataset_version" TEXT NOT NULL,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "locations_level_chk" CHECK ("level" IN ('country', 'region', 'district', 'county', 'subcounty', 'parish', 'village')),
    CONSTRAINT "locations_coords_chk" CHECK (("lat" IS NULL) = ("lng" IS NULL) AND ("lat" IS NULL OR ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180))),
    CONSTRAINT "locations_path_chk" CHECK ("path" LIKE '%/' || "id" || '/')
);
CREATE INDEX "locations_parent_id_idx" ON "locations"("parent_id");
CREATE INDEX "locations_level_idx" ON "locations"("level");
CREATE INDEX "locations_path_prefix_idx" ON "locations"("path" text_pattern_ops);
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "location_aliases" (
    "id" SERIAL NOT NULL,
    "location_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "alias_key" TEXT NOT NULL,
    CONSTRAINT "location_aliases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "location_aliases_location_id_alias_key_key" ON "location_aliases"("location_id", "alias_key");
CREATE INDEX "location_aliases_alias_key_idx" ON "location_aliases"("alias_key");
ALTER TABLE "location_aliases" ADD CONSTRAINT "location_aliases_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "location_datasets" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "licence" TEXT NOT NULL,
    "source_updated" TEXT NOT NULL,
    "counts" JSONB NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "location_datasets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "provider_areas" (
    "provider_id" INTEGER NOT NULL,
    "location_id" TEXT NOT NULL,
    CONSTRAINT "provider_areas_pkey" PRIMARY KEY ("provider_id", "location_id")
);
CREATE INDEX "provider_areas_location_id_idx" ON "provider_areas"("location_id");
ALTER TABLE "provider_areas" ADD CONSTRAINT "provider_areas_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "provider_areas" ADD CONSTRAINT "provider_areas_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users" ADD COLUMN "location_id" TEXT;
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "properties" ADD COLUMN "location_id" TEXT,
  ADD COLUMN "estate" TEXT, ADD COLUMN "street" TEXT, ADD COLUMN "building" TEXT, ADD COLUMN "plot" TEXT, ADD COLUMN "landmark" TEXT,
  ADD COLUMN "lat" DOUBLE PRECISION, ADD COLUMN "lng" DOUBLE PRECISION, ADD COLUMN "coord_accuracy_m" INTEGER, ADD COLUMN "coord_source" TEXT;
ALTER TABLE "properties" ADD CONSTRAINT "properties_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "properties" ADD CONSTRAINT "properties_coords_chk" CHECK (("lat" IS NULL) = ("lng" IS NULL) AND ("lat" IS NULL OR ("lat" BETWEEN -90 AND 90 AND "lng" BETWEEN -180 AND 180)) AND ("coord_source" IS NULL OR "coord_source" IN ('gps', 'map')));
CREATE INDEX "properties_location_id_idx" ON "properties"("location_id");

ALTER TABLE "jobs" ADD COLUMN "location_id" TEXT;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "jobs_location_id_idx" ON "jobs"("location_id");

-- Fast "contains" search over 84k place names when the trigram extension is available (skipped quietly if not).
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE INDEX IF NOT EXISTS "locations_search_trgm_idx" ON "locations" USING gin ("search_key" gin_trgm_ops);
EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'pg_trgm not available — location search will use a plain scan';
END $$;
