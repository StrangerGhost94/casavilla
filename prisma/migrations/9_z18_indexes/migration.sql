-- Named "9_z18_…" so it sorts after "9_z17_build_sites". (18th migration.)
-- Indexes for the lookups the app does most: public listings, providers, sign-in by phone, file permissions, leases.
CREATE INDEX IF NOT EXISTS "users_role_status_idx" ON "users"("role", "status");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
CREATE INDEX IF NOT EXISTS "units_listed_status_mode_idx" ON "units"("listed", "status", "mode");
CREATE INDEX IF NOT EXISTS "leases_unit_id_idx" ON "leases"("unit_id");
CREATE INDEX IF NOT EXISTS "leases_status_idx" ON "leases"("status");
CREATE INDEX IF NOT EXISTS "services_provider_id_idx" ON "services"("provider_id");
CREATE INDEX IF NOT EXISTS "services_category_active_idx" ON "services"("category", "active");
CREATE INDEX IF NOT EXISTS "products_provider_id_idx" ON "products"("provider_id");
CREATE INDEX IF NOT EXISTS "products_active_idx" ON "products"("active");
CREATE INDEX IF NOT EXISTS "orders_product_id_idx" ON "orders"("product_id");
CREATE INDEX IF NOT EXISTS "jobs_property_id_idx" ON "jobs"("property_id");
CREATE INDEX IF NOT EXISTS "jobs_unit_id_idx" ON "jobs"("unit_id");
CREATE INDEX IF NOT EXISTS "documents_lease_id_idx" ON "documents"("lease_id");
CREATE INDEX IF NOT EXISTS "documents_property_id_idx" ON "documents"("property_id");
CREATE INDEX IF NOT EXISTS "documents_file_id_idx" ON "documents"("file_id");
CREATE INDEX IF NOT EXISTS "payments_tenant_id_idx" ON "payments"("tenant_id");
CREATE INDEX IF NOT EXISTS "viewings_unit_id_idx" ON "viewings"("unit_id");
CREATE INDEX IF NOT EXISTS "viewings_sale_listing_id_idx" ON "viewings"("sale_listing_id");
CREATE INDEX IF NOT EXISTS "build_update_photos_file_id_idx" ON "build_update_photos"("file_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
