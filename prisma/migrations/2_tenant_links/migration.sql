-- Existing tenants can connect to their landlord by the landlord's phone number.
CREATE TABLE "tenant_links" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "landlord_id" INTEGER,
    "landlord_phone" TEXT NOT NULL,
    "unit_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "lease_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "tenant_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_links_status_chk" CHECK ("status" IN ('pending', 'linked', 'declined', 'cancelled'))
);
CREATE INDEX "tenant_links_landlord_id_status_idx" ON "tenant_links"("landlord_id", "status");
CREATE INDEX "tenant_links_landlord_phone_status_idx" ON "tenant_links"("landlord_phone", "status");
CREATE INDEX "tenant_links_tenant_id_idx" ON "tenant_links"("tenant_id");
-- A tenant has at most one open request at a time.
CREATE UNIQUE INDEX "tenant_links_one_pending" ON "tenant_links"("tenant_id") WHERE "status" = 'pending';
ALTER TABLE "tenant_links" ADD CONSTRAINT "tenant_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_links" ADD CONSTRAINT "tenant_links_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tenant_links" ADD CONSTRAINT "tenant_links_lease_id_fkey" FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
