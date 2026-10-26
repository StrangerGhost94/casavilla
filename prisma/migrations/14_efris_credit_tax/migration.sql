-- EFRIS: URA's official tax treatment per commodity code, and credit notes.
ALTER TABLE "efris_profiles" ADD COLUMN "commodity_tax" JSONB;

CREATE TABLE "efris_credit_notes" (
  "id" SERIAL NOT NULL,
  "receipt_id" INTEGER NOT NULL,
  "landlord_id" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL,
  "reason_code" TEXT NOT NULL,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'submitting',
  "application_ref" TEXT,
  "application_id" TEXT,
  "fdn" TEXT,
  "verification_code" TEXT,
  "invoice_id" TEXT,
  "error" TEXT,
  "test" BOOLEAN NOT NULL DEFAULT false,
  "requested_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "efris_credit_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "efris_credit_notes_amount_chk" CHECK ("amount" > 0)
);
CREATE INDEX "efris_credit_notes_status_idx" ON "efris_credit_notes"("status");
CREATE INDEX "efris_credit_notes_receipt_id_idx" ON "efris_credit_notes"("receipt_id");
ALTER TABLE "efris_credit_notes" ADD CONSTRAINT "efris_credit_notes_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "efris_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "efris_credit_notes" ADD CONSTRAINT "efris_credit_notes_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "efris_profiles"("landlord_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "efris_credit_notes" ADD CONSTRAINT "efris_credit_notes_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
