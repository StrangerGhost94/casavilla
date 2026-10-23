-- URA EFRIS system-to-system: per-landlord device and (encrypted) key, registered service lines, retry state.
ALTER TABLE "efris_profiles"
  ADD COLUMN "device_no" TEXT,
  ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'test',
  ADD COLUMN "key_enc" TEXT,
  ADD COLUMN "key_fingerprint" TEXT,
  ADD COLUMN "key_added_at" TIMESTAMP(3),
  ADD COLUMN "legal_name" TEXT,
  ADD COLUMN "business_name" TEXT,
  ADD COLUMN "seller_address" TEXT,
  ADD COLUMN "unit_code" TEXT,
  ADD COLUMN "commodity_residential" TEXT,
  ADD COLUMN "commodity_residential_name" TEXT,
  ADD COLUMN "commodity_commercial" TEXT,
  ADD COLUMN "commodity_commercial_name" TEXT,
  ADD COLUMN "ura_dict" JSONB,
  ADD COLUMN "checked_at" TIMESTAMP(3),
  ADD COLUMN "check_ok" BOOLEAN,
  ADD COLUMN "check_message" TEXT;

ALTER TABLE "efris_receipts" ADD COLUMN "invoice_id" TEXT;

CREATE TABLE "efris_goods" (
  "id" SERIAL PRIMARY KEY,
  "landlord_id" INTEGER NOT NULL REFERENCES "efris_profiles"("landlord_id") ON DELETE CASCADE ON UPDATE CASCADE,
  "unit_id" INTEGER,
  "kind" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "error" TEXT,
  "environment" TEXT NOT NULL DEFAULT 'test',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "efris_goods_landlord_id_environment_code_key" ON "efris_goods"("landlord_id", "environment", "code");

CREATE TABLE "efris_attempts" (
  "payment_id" INTEGER PRIMARY KEY,
  "status" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "efris_attempts_status_idx" ON "efris_attempts"("status");
