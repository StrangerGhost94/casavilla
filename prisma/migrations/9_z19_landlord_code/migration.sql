-- Landlords get a private code that existing tenants enter to join, so the landlord's phone number is never needed.
ALTER TABLE "users" ADD COLUMN "landlord_code" TEXT;
CREATE UNIQUE INDEX "users_landlord_code_key" ON "users"("landlord_code");
-- Existing landlords: a random 6-character code each (letters and digits, no look-alikes like O/0 or I/1).
UPDATE "users" SET "landlord_code" = 'CV-' || (
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  FROM generate_series(1, 6) WHERE "users"."id" IS NOT NULL
) WHERE "role" = 'landlord';
