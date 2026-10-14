-- A property is shown as "Verified by CasaVilla" only after a manager has checked it.
ALTER TABLE "properties" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "properties" ADD COLUMN "verified_by" INTEGER;
