-- Named "9_z16_…" so it sorts after "9_z15_…" (Prisma applies migrations in name order). (16th migration.)
-- Build with CasaVilla: house plans, past projects, their photos, and design & build requests.
CREATE TABLE "house_plans" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "style" TEXT NOT NULL,
  "bedrooms" INTEGER,
  "bathrooms" INTEGER,
  "floors" INTEGER NOT NULL DEFAULT 1,
  "area_sqm" INTEGER,
  "plot_size" TEXT,
  "price" INTEGER NOT NULL,
  "build_from" DOUBLE PRECISION,
  "build_to" DOUBLE PRECISION,
  "summary" TEXT,
  "description" TEXT,
  "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "photo_id" INTEGER,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "house_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "house_plans_style_chk" CHECK ("style" IN ('bungalow', 'storeyed', 'apartments', 'commercial'))
);
CREATE INDEX "house_plans_published_sort_idx" ON "house_plans"("published", "sort");

CREATE TABLE "build_projects" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "year" INTEGER,
  "summary" TEXT,
  "photo_id" INTEGER,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_projects_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_projects_kind_chk" CHECK ("kind" IN ('house', 'apartments', 'commercial', 'renovation'))
);

CREATE TABLE "build_photos" (
  "id" SERIAL NOT NULL,
  "plan_id" INTEGER,
  "project_id" INTEGER,
  "file_id" INTEGER NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "is_cover" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_photos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_photos_target_chk" CHECK (("plan_id" IS NULL) <> ("project_id" IS NULL))
);
CREATE INDEX "build_photos_plan_id_idx" ON "build_photos"("plan_id");
CREATE INDEX "build_photos_project_id_idx" ON "build_photos"("project_id");
ALTER TABLE "build_photos" ADD CONSTRAINT "build_photos_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "house_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "build_photos" ADD CONSTRAINT "build_photos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "build_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "build_requests" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "kind" TEXT NOT NULL,
  "plan_id" INTEGER,
  "sale_listing_id" INTEGER,
  "location" TEXT,
  "plot" TEXT,
  "budget" DOUBLE PRECISION,
  "timeline" TEXT,
  "message" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "quote" DOUBLE PRECISION,
  "staff_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_requests_kind_chk" CHECK ("kind" IN ('house', 'apartments', 'commercial', 'renovation', 'plans')),
  CONSTRAINT "build_requests_status_chk" CHECK ("status" IN ('new', 'contacted', 'site_visit', 'quoted', 'won', 'lost'))
);
CREATE INDEX "build_requests_status_created_at_idx" ON "build_requests"("status", "created_at");
CREATE INDEX "build_requests_phone_created_at_idx" ON "build_requests"("phone", "created_at");
ALTER TABLE "build_requests" ADD CONSTRAINT "build_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_requests" ADD CONSTRAINT "build_requests_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "house_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_requests" ADD CONSTRAINT "build_requests_sale_listing_id_fkey" FOREIGN KEY ("sale_listing_id") REFERENCES "sale_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
