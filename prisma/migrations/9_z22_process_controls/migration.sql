-- Process controls: last sign-in (for the monthly access review), new-staff onboarding, requests a second person
-- must approve (waivers, refunds, reversals), and the daily cash close.
ALTER TABLE "users"
  ADD COLUMN "last_login_at" TIMESTAMP(3),
  ADD COLUMN "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "rules_accepted_at" TIMESTAMP(3);

CREATE TABLE "approval_requests" (
  "id" SERIAL PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "summary" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" INTEGER NOT NULL,
  "requested_by_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "reason" TEXT NOT NULL,
  "decided_by_id" INTEGER REFERENCES "users"("id"),
  "decision_note" TEXT,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "approval_requests_status_created_at_idx" ON "approval_requests"("status", "created_at");
CREATE INDEX "approval_requests_entity_entity_id_idx" ON "approval_requests"("entity", "entity_id");
-- Only one open request per thing at a time (e.g. one waiver request per charge).
CREATE UNIQUE INDEX "approval_requests_one_open" ON "approval_requests"("kind", "entity", "entity_id") WHERE "status" = 'pending';

CREATE TABLE "cash_closes" (
  "day" DATE PRIMARY KEY,
  "closed_by_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "count" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "by_staff" JSONB NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- A cash or bank payment recorded by mistake can be reversed (after a second person approves).
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_values_chk";
ALTER TABLE "payments" ADD CONSTRAINT "payments_values_chk" CHECK ("amount" > 0 AND "status" IN ('pending', 'success', 'failed', 'reversed') AND "method" IN ('mtn', 'airtel', 'cash', 'bank')) NOT VALID;
