-- WhatsApp/SMS messaging and phone codes, caretakers, inspections, expenses & statements, utilities.
-- Additive only; existing data keeps working with the defaults below.
-- (The new 'caretaker' role is added here but not used by any statement in this file — Postgres requires that.)

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'caretaker';

ALTER TABLE "users"
  ADD COLUMN "phone_verified_at" TIMESTAMP(3),
  ADD COLUMN "message_opt_in" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "remind_tenants" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "commission_pct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD CONSTRAINT "users_commission_chk" CHECK ("commission_pct" >= 0 AND "commission_pct" <= 50);

-- Messaging -----------------------------------------------------------------
CREATE TABLE "message_outbox" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "to_phone" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "template" TEXT,
  "params" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "text" TEXT NOT NULL,
  "dedupe_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "channel" TEXT,
  "provider_ref" TEXT,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "message_outbox_chk" CHECK ("status" IN ('queued', 'sent', 'failed', 'expired', 'test') AND "kind" IN ('otp', 'reminder', 'notice') AND ("channel" IS NULL OR "channel" IN ('whatsapp', 'sms')))
);
CREATE UNIQUE INDEX "message_outbox_dedupe_key_key" ON "message_outbox"("dedupe_key");
CREATE INDEX "message_outbox_status_created_at_idx" ON "message_outbox"("status", "created_at");
CREATE INDEX "message_outbox_user_id_idx" ON "message_outbox"("user_id");

CREATE TABLE "phone_codes" (
  "id" SERIAL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_codes_chk" CHECK ("purpose" IN ('signup', 'reset') AND "attempts" >= 0)
);
CREATE INDEX "phone_codes_phone_purpose_created_at_idx" ON "phone_codes"("phone", "purpose", "created_at");

-- Caretakers ----------------------------------------------------------------
CREATE TABLE "caretaker_assignments" (
  "id" SERIAL PRIMARY KEY,
  "caretaker_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "landlord_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "property_id" INTEGER NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "can_collect" BOOLEAN NOT NULL DEFAULT true,
  "can_see_balances" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "caretaker_assignments_caretaker_id_property_id_key" ON "caretaker_assignments"("caretaker_id", "property_id");
CREATE INDEX "caretaker_assignments_property_id_idx" ON "caretaker_assignments"("property_id");

-- Inspections ---------------------------------------------------------------
CREATE TABLE "inspections" (
  "id" SERIAL PRIMARY KEY,
  "unit_id" INTEGER NOT NULL REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "lease_id" INTEGER REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "conducted_by_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "conducted_on" DATE NOT NULL DEFAULT CURRENT_DATE,
  "keys" INTEGER,
  "notes" TEXT,
  "submitted_at" TIMESTAMP(3),
  "tenant_answered_at" TIMESTAMP(3),
  "tenant_comment" TEXT,
  "deductions" INTEGER NOT NULL DEFAULT 0,
  "charge_id" INTEGER REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inspections_chk" CHECK ("kind" IN ('move_in', 'move_out', 'routine') AND "status" IN ('draft', 'submitted', 'agreed', 'disputed') AND "deductions" >= 0 AND ("keys" IS NULL OR "keys" >= 0))
);
CREATE UNIQUE INDEX "inspections_charge_id_key" ON "inspections"("charge_id");
CREATE INDEX "inspections_unit_id_idx" ON "inspections"("unit_id");
CREATE INDEX "inspections_lease_id_idx" ON "inspections"("lease_id");
-- One move-in and one move-out report per tenancy.
CREATE UNIQUE INDEX "inspections_one_per_lease_kind" ON "inspections"("lease_id", "kind") WHERE "lease_id" IS NOT NULL AND "kind" IN ('move_in', 'move_out');

CREATE TABLE "inspection_items" (
  "id" SERIAL PRIMARY KEY,
  "inspection_id" INTEGER NOT NULL REFERENCES "inspections"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "area" TEXT NOT NULL,
  "item" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "condition" TEXT NOT NULL DEFAULT 'good',
  "note" TEXT,
  "photo_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "deduction" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "inspection_items_chk" CHECK ("condition" IN ('good', 'fair', 'poor', 'damaged', 'missing', 'na') AND "deduction" >= 0)
);
CREATE INDEX "inspection_items_inspection_id_idx" ON "inspection_items"("inspection_id");

-- Expenses ------------------------------------------------------------------
CREATE TABLE "expenses" (
  "id" SERIAL PRIMARY KEY,
  "landlord_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "property_id" INTEGER REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "unit_id" INTEGER REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "spent_on" DATE NOT NULL,
  "receipt_file_id" INTEGER,
  "job_id" INTEGER REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'approved',
  "created_by_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expenses_chk" CHECK ("amount" > 0 AND "status" IN ('pending', 'approved', 'rejected'))
);
CREATE UNIQUE INDEX "expenses_job_id_key" ON "expenses"("job_id");
CREATE INDEX "expenses_landlord_id_spent_on_idx" ON "expenses"("landlord_id", "spent_on");
CREATE INDEX "expenses_property_id_idx" ON "expenses"("property_id");

-- Utilities -----------------------------------------------------------------
CREATE TABLE "meters" (
  "id" SERIAL PRIMARY KEY,
  "property_id" INTEGER NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "unit_id" INTEGER REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL,
  "label" TEXT,
  "number" TEXT,
  "billing" TEXT NOT NULL DEFAULT 'prepaid',
  "rate" INTEGER,
  "share_unit_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meters_chk" CHECK ("kind" IN ('electricity', 'water') AND "billing" IN ('prepaid', 'submeter', 'shared')
    AND ("billing" <> 'submeter' OR ("rate" IS NOT NULL AND "rate" > 0 AND "unit_id" IS NOT NULL)))
);
CREATE INDEX "meters_property_id_idx" ON "meters"("property_id");
CREATE INDEX "meters_unit_id_idx" ON "meters"("unit_id");

CREATE TABLE "meter_readings" (
  "id" SERIAL PRIMARY KEY,
  "meter_id" INTEGER NOT NULL REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reading" DOUBLE PRECISION NOT NULL,
  "read_on" DATE NOT NULL,
  "photo_file_id" INTEGER,
  "recorded_by_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "inspection_id" INTEGER REFERENCES "inspections"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "charge_id" INTEGER REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "meter_readings_chk" CHECK ("reading" >= 0)
);
CREATE UNIQUE INDEX "meter_readings_charge_id_key" ON "meter_readings"("charge_id");
CREATE INDEX "meter_readings_meter_id_read_on_idx" ON "meter_readings"("meter_id", "read_on");

CREATE TABLE "utility_bills" (
  "id" SERIAL PRIMARY KEY,
  "meter_id" INTEGER NOT NULL REFERENCES "meters"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "period" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "split_count" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "utility_bills_chk" CHECK ("amount" > 0 AND "period" ~ '^\d{4}-\d{2}$')
);
CREATE UNIQUE INDEX "utility_bills_meter_id_period_key" ON "utility_bills"("meter_id", "period");
