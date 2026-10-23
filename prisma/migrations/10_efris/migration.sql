-- URA EFRIS: each landlord's set-up, and the EFRIS receipt recorded against each payment.
CREATE TABLE "efris_profiles" (
  "landlord_id" INTEGER NOT NULL,
  "tin" TEXT,
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "vat_registered" BOOLEAN NOT NULL DEFAULT false,
  "since" DATE NOT NULL DEFAULT CURRENT_DATE,
  "mode" TEXT NOT NULL DEFAULT 'record',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "efris_profiles_pkey" PRIMARY KEY ("landlord_id"),
  CONSTRAINT "efris_profiles_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "efris_receipts" (
  "id" SERIAL NOT NULL,
  "payment_id" INTEGER NOT NULL,
  "fdn" TEXT NOT NULL,
  "verification_code" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'receipt',
  "tin" TEXT,
  "issued_on" DATE NOT NULL,
  "file_id" INTEGER,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "recorded_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "efris_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "efris_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "efris_receipts_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "efris_receipts_payment_id_key" ON "efris_receipts"("payment_id");
CREATE UNIQUE INDEX "efris_receipts_fdn_key" ON "efris_receipts"("fdn");
