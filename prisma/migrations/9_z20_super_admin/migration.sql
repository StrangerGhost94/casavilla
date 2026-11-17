-- Office accounts are either ordinary staff or super admins (who manage staff accounts, approve landlords,
-- change commission, waive charges and use the system tools).
ALTER TABLE "users" ADD COLUMN "super_admin" BOOLEAN NOT NULL DEFAULT false;
-- The first office account (created when the site was first started) becomes the first super admin.
UPDATE "users" SET "super_admin" = true WHERE "id" = (SELECT "id" FROM "users" WHERE "role" = 'manager' ORDER BY "id" LIMIT 1);
