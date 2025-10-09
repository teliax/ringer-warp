-- Rollback migration: Drop service_providers table

DROP TRIGGER IF EXISTS update_service_providers_updated_at ON vendor_mgmt.service_providers;
DROP FUNCTION IF EXISTS vendor_mgmt.update_updated_at_column();
DROP TABLE IF EXISTS vendor_mgmt.service_providers;
