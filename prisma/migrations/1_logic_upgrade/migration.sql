-- CasaVilla: connected workflows, smarter billing and stronger data integrity.
-- Safe to run on live data: new columns have defaults, and rules that existing rows might break
-- are added as NOT VALID (enforced for new writes) or skipped with a notice instead of failing the deploy.

-- ── New columns ────────────────────────────────────────────────────────────────
ALTER TABLE "units" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "leases" ADD COLUMN "credit" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "late_fee_pct" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "ended_at" DATE,
  ADD COLUMN "settlement" INTEGER;

ALTER TABLE "charges" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'rent',
  ADD COLUMN "waived" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "charges" SET "kind" = 'deposit' WHERE "period" = 'DEPOSIT';

ALTER TABLE "jobs" ADD COLUMN "assigned_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "rating" INTEGER,
  ADD COLUMN "review" TEXT;
UPDATE "jobs" SET "assigned_at" = "updated_at" WHERE "provider_id" IS NOT NULL;
UPDATE "jobs" SET "completed_at" = "updated_at" WHERE "status" = 'done';

ALTER TABLE "job_notes" ADD COLUMN "system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "notifications" ADD COLUMN "key" TEXT;

-- ── New tables ─────────────────────────────────────────────────────────────────
CREATE TABLE "allocations" (
    "id" SERIAL NOT NULL,
    "payment_id" INTEGER,
    "charge_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'payment',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "allocations_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "markers" (
    "key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "markers_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Every payment already received becomes an allocation to the charge it paid.
INSERT INTO "allocations" ("payment_id", "charge_id", "amount", "source", "created_at")
SELECT "id", "charge_id", "amount", 'payment', COALESCE("paid_at", "created_at") FROM "payments" WHERE "status" = 'success';

-- Older versions could put more money on a charge than it was worth. The excess is not lost:
-- it becomes credit on the lease (used automatically on the next charges) and the charge is capped.
WITH over AS (
  SELECT c."id", c."lease_id", c."paid" - c."amount" AS extra FROM "charges" c WHERE c."paid" > c."amount"
), last AS (
  SELECT DISTINCT ON (a."charge_id") a."id", a."charge_id", a."amount" FROM "allocations" a JOIN over o ON o."id" = a."charge_id" ORDER BY a."charge_id", a."id" DESC
)
UPDATE "allocations" a SET "amount" = a."amount" - LEAST(o.extra, l."amount" - 1)
FROM last l JOIN over o ON o."id" = l."charge_id" WHERE a."id" = l."id";
UPDATE "leases" l SET "credit" = l."credit" + x.extra
FROM (SELECT "lease_id", SUM("paid" - "amount") AS extra FROM "charges" WHERE "paid" > "amount" GROUP BY "lease_id") x WHERE x."lease_id" = l."id";
UPDATE "charges" SET "paid" = "amount", "status" = 'paid' WHERE "paid" > "amount";

-- ── Indexes ────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS "notifications_user_id_idx";
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");
CREATE UNIQUE INDEX "notifications_key_key" ON "notifications"("key");
CREATE INDEX "applications_unit_id_idx" ON "applications"("unit_id");
CREATE INDEX "applications_tenant_id_idx" ON "applications"("tenant_id");
CREATE INDEX "charges_status_due_date_idx" ON "charges"("status", "due_date");
CREATE INDEX "payments_lease_id_idx" ON "payments"("lease_id");
CREATE INDEX "payments_charge_id_idx" ON "payments"("charge_id");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "allocations_charge_id_idx" ON "allocations"("charge_id");
CREATE INDEX "allocations_payment_id_idx" ON "allocations"("payment_id");
CREATE INDEX "orders_provider_id_idx" ON "orders"("provider_id");
CREATE INDEX "orders_buyer_id_idx" ON "orders"("buyer_id");
CREATE INDEX "jobs_provider_id_idx" ON "jobs"("provider_id");
CREATE INDEX "jobs_landlord_id_idx" ON "jobs"("landlord_id");
CREATE INDEX "jobs_requester_id_idx" ON "jobs"("requester_id");
CREATE INDEX "jobs_status_idx" ON "jobs"("status");
CREATE INDEX "job_notes_job_id_idx" ON "job_notes"("job_id");
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- ── Business rules the database itself enforces ───────────────────────────────
-- One active lease per unit, one active lease per tenant, one open application per tenant per unit.
DO $$ BEGIN
  CREATE UNIQUE INDEX "leases_one_active_per_unit" ON "leases"("unit_id") WHERE "status" = 'active';
EXCEPTION WHEN others THEN RAISE NOTICE 'skipped leases_one_active_per_unit: %', SQLERRM; END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX "leases_one_active_per_tenant" ON "leases"("tenant_id") WHERE "status" = 'active';
EXCEPTION WHEN others THEN RAISE NOTICE 'skipped leases_one_active_per_tenant: %', SQLERRM; END $$;
DO $$ BEGIN
  CREATE UNIQUE INDEX "applications_one_pending" ON "applications"("unit_id", "tenant_id") WHERE "status" = 'pending';
EXCEPTION WHEN others THEN RAISE NOTICE 'skipped applications_one_pending: %', SQLERRM; END $$;

-- Value checks (NOT VALID: enforced for every new or changed row without rejecting old ones).
ALTER TABLE "units" ADD CONSTRAINT "units_values_chk" CHECK ("rent" >= 0 AND "bedrooms" >= 0 AND "status" IN ('vacant', 'occupied')) NOT VALID;
ALTER TABLE "leases" ADD CONSTRAINT "leases_values_chk" CHECK ("rent" > 0 AND "deposit" >= 0 AND "credit" >= 0 AND "due_day" BETWEEN 1 AND 28 AND "late_fee_pct" BETWEEN 0 AND 50 AND "end_date" > "start_date" AND "status" IN ('active', 'ended')) NOT VALID;
ALTER TABLE "charges" ADD CONSTRAINT "charges_values_chk" CHECK ("amount" >= 0 AND "paid" >= 0 AND "paid" <= "amount" AND "waived" >= 0 AND "status" IN ('unpaid', 'partial', 'paid')) NOT VALID;
ALTER TABLE "payments" ADD CONSTRAINT "payments_values_chk" CHECK ("amount" > 0 AND "status" IN ('pending', 'success', 'failed') AND "method" IN ('mtn', 'airtel', 'cash', 'bank')) NOT VALID;
ALTER TABLE "allocations" ADD CONSTRAINT "allocations_values_chk" CHECK ("amount" > 0 AND "source" IN ('payment', 'credit', 'deposit'));
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_chk" CHECK ("status" IN ('pending', 'approved', 'rejected', 'withdrawn')) NOT VALID;
ALTER TABLE "products" ADD CONSTRAINT "products_values_chk" CHECK ("price" >= 0 AND "stock" >= 0) NOT VALID;
ALTER TABLE "services" ADD CONSTRAINT "services_values_chk" CHECK ("price_from" IS NULL OR "price_from" >= 0) NOT VALID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_values_chk" CHECK ("quantity" > 0 AND "total" >= 0 AND "status" IN ('placed', 'confirmed', 'delivered', 'cancelled')) NOT VALID;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_values_chk" CHECK ("status" IN ('open', 'assigned', 'quoted', 'accepted', 'in_progress', 'done', 'cancelled') AND "priority" IN ('low', 'normal', 'urgent') AND ("quote" IS NULL OR "quote" >= 0) AND ("rating" IS NULL OR "rating" BETWEEN 1 AND 5)) NOT VALID;

-- ── One-off clean-up of contradictions in existing data ───────────────────────
UPDATE "units" SET "listed" = false WHERE "status" = 'occupied';
UPDATE "charges" SET "status" = CASE WHEN "paid" >= "amount" THEN 'paid' WHEN "paid" > 0 THEN 'partial' ELSE 'unpaid' END
  WHERE "status" <> CASE WHEN "paid" >= "amount" THEN 'paid' WHEN "paid" > 0 THEN 'partial' ELSE 'unpaid' END;
