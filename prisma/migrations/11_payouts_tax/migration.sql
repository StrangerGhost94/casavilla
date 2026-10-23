-- Automatic split of each payment (commission, tax set aside, landlord's share), landlord payouts, tax paid to URA,
-- and automatic EFRIS fields.
ALTER TABLE "efris_profiles" ADD COLUMN "tax_mode" TEXT NOT NULL DEFAULT 'individual';
ALTER TABLE "efris_receipts" ADD COLUMN "qr" TEXT;
ALTER TABLE "efris_receipts" ADD COLUMN "test" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "payout_accounts" (
  "landlord_id" INTEGER NOT NULL,
  "method" TEXT NOT NULL,
  "account_name" TEXT NOT NULL,
  "phone" TEXT,
  "bank_code" TEXT,
  "bank_name" TEXT,
  "account_number" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("landlord_id"),
  CONSTRAINT "payout_accounts_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "payouts" (
  "id" SERIAL NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "landlord_id" INTEGER NOT NULL,
  "gross" INTEGER NOT NULL,
  "taxable_rent" INTEGER NOT NULL,
  "commission" INTEGER NOT NULL,
  "rental_tax" INTEGER NOT NULL,
  "vat" INTEGER NOT NULL,
  "net" INTEGER NOT NULL,
  "collected_by" TEXT NOT NULL,
  "recovered" INTEGER NOT NULL DEFAULT 0,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "method" TEXT,
  "destination" TEXT,
  "reference" TEXT NOT NULL,
  "provider_ref" TEXT,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payouts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payouts_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "payouts_payment_id_key" ON "payouts"("payment_id");
CREATE UNIQUE INDEX "payouts_reference_key" ON "payouts"("reference");
CREATE INDEX "payouts_landlord_id_status_idx" ON "payouts"("landlord_id", "status");

CREATE TABLE "tax_remittances" (
  "id" SERIAL NOT NULL,
  "landlord_id" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "prn" TEXT NOT NULL,
  "paid_on" DATE NOT NULL,
  "note" TEXT,
  "recorded_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tax_remittances_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tax_remittances_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tax_remittances_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tax_remittances_prn_key" ON "tax_remittances"("prn");
CREATE INDEX "tax_remittances_landlord_id_kind_idx" ON "tax_remittances"("landlord_id", "kind");
