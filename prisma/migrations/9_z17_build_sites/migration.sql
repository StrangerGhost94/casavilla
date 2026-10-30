-- Named "9_z17_…" so it sorts after "9_z16_build" (Prisma applies migrations in name order). (17th migration.)
-- Building sites: an agreed build with its stages, progress updates (with photos) and the client's payments.
CREATE TABLE "build_sites" (
  "id" SERIAL NOT NULL,
  "request_id" INTEGER,
  "client_id" INTEGER,
  "client_name" TEXT NOT NULL,
  "client_phone" TEXT NOT NULL,
  "plan_id" INTEGER,
  "title" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "contract_sum" DOUBLE PRECISION NOT NULL,
  "start_date" DATE,
  "target_date" DATE,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_sites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_sites_status_chk" CHECK ("status" IN ('active', 'on_hold', 'handed_over', 'cancelled')),
  CONSTRAINT "build_sites_sum_chk" CHECK ("contract_sum" >= 0)
);
CREATE UNIQUE INDEX "build_sites_request_id_key" ON "build_sites"("request_id");
CREATE INDEX "build_sites_client_id_idx" ON "build_sites"("client_id");
CREATE INDEX "build_sites_client_phone_idx" ON "build_sites"("client_phone");
ALTER TABLE "build_sites" ADD CONSTRAINT "build_sites_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "build_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_sites" ADD CONSTRAINT "build_sites_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_sites" ADD CONSTRAINT "build_sites_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "house_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "build_stages" (
  "id" SERIAL NOT NULL,
  "site_id" INTEGER NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "name" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'upcoming',
  "started_at" TIMESTAMP(3),
  "done_at" TIMESTAMP(3),
  CONSTRAINT "build_stages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_stages_status_chk" CHECK ("status" IN ('upcoming', 'in_progress', 'done')),
  CONSTRAINT "build_stages_amount_chk" CHECK ("amount" >= 0)
);
CREATE INDEX "build_stages_site_id_sort_idx" ON "build_stages"("site_id", "sort");
ALTER TABLE "build_stages" ADD CONSTRAINT "build_stages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "build_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "build_updates" (
  "id" SERIAL NOT NULL,
  "site_id" INTEGER NOT NULL,
  "stage_id" INTEGER,
  "author_id" INTEGER,
  "note" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_updates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "build_updates_site_id_created_at_idx" ON "build_updates"("site_id", "created_at");
ALTER TABLE "build_updates" ADD CONSTRAINT "build_updates_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "build_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "build_updates" ADD CONSTRAINT "build_updates_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "build_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_updates" ADD CONSTRAINT "build_updates_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "build_update_photos" (
  "id" SERIAL NOT NULL,
  "update_id" INTEGER NOT NULL,
  "file_id" INTEGER NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "is_cover" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "build_update_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "build_update_photos_update_id_idx" ON "build_update_photos"("update_id");
ALTER TABLE "build_update_photos" ADD CONSTRAINT "build_update_photos_update_id_fkey" FOREIGN KEY ("update_id") REFERENCES "build_updates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "build_payments" (
  "id" SERIAL NOT NULL,
  "site_id" INTEGER NOT NULL,
  "stage_id" INTEGER,
  "payer_id" INTEGER,
  "amount" DOUBLE PRECISION NOT NULL,
  "method" TEXT NOT NULL,
  "phone" TEXT,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "receipt_no" TEXT,
  "note" TEXT,
  "recorded_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paid_at" TIMESTAMP(3),
  CONSTRAINT "build_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "build_payments_method_chk" CHECK ("method" IN ('mtn', 'airtel', 'cash', 'bank')),
  CONSTRAINT "build_payments_status_chk" CHECK ("status" IN ('pending', 'success', 'failed')),
  CONSTRAINT "build_payments_amount_chk" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "build_payments_reference_key" ON "build_payments"("reference");
CREATE UNIQUE INDEX "build_payments_receipt_no_key" ON "build_payments"("receipt_no");
CREATE INDEX "build_payments_site_id_status_idx" ON "build_payments"("site_id", "status");
CREATE INDEX "build_payments_status_created_at_idx" ON "build_payments"("status", "created_at");
ALTER TABLE "build_payments" ADD CONSTRAINT "build_payments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "build_sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "build_payments" ADD CONSTRAINT "build_payments_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "build_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_payments" ADD CONSTRAINT "build_payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "build_payments" ADD CONSTRAINT "build_payments_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
