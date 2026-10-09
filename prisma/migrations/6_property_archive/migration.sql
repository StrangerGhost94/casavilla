-- Properties with tenancy history are archived (hidden, unlisted) instead of deleted, so receipts and statements stay intact.
ALTER TABLE "properties" ADD COLUMN "archived_at" TIMESTAMP(3);
CREATE INDEX "properties_archived_at_idx" ON "properties"("archived_at");
