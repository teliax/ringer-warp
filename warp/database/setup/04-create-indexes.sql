-- WARP Platform Performance Indexes and Constraints
-- Database: Cloud SQL (PostgreSQL 15)
-- Project: ringer-472421

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Auth Schema Indexes
CREATE INDEX CONCURRENTLY idx_auth_users_last_login ON auth.users(last_login DESC) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_auth_api_keys_lookup ON auth.api_keys(key_hash) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_auth_api_keys_account ON auth.api_keys(account_id, is_active);

-- Accounts Schema Indexes
CREATE INDEX CONCURRENTLY idx_accounts_search ON accounts.accounts USING gin(to_tsvector('english', company_name || ' ' || COALESCE(dba_name, '')));
CREATE INDEX CONCURRENTLY idx_accounts_balance ON accounts.accounts(current_balance) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_accounts_auto_recharge ON accounts.accounts(auto_recharge_threshold) WHERE auto_recharge_enabled = true;

-- Trunks Schema Indexes
CREATE INDEX CONCURRENTLY idx_trunks_lookup ON trunks.trunks(account_id, trunk_name) WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_trunks_auth ON trunks.trunks(username) WHERE auth_type IN ('DIGEST', 'BOTH');
CREATE INDEX CONCURRENTLY idx_ip_acl_lookup ON trunks.ip_acl(ip_address);

-- Numbers Schema Indexes
CREATE INDEX CONCURRENTLY idx_dids_available ON numbers.dids(number_type, npa, status) WHERE status = 'AVAILABLE';
CREATE INDEX CONCURRENTLY idx_dids_sms ON numbers.dids(account_id) WHERE sms_enabled = true;
CREATE INDEX CONCURRENTLY idx_dids_e911 ON numbers.dids(account_id) WHERE e911_enabled = true;
CREATE INDEX CONCURRENTLY idx_dids_porting ON numbers.dids(port_in_date, port_in_status) WHERE port_in_status IS NOT NULL;

-- Routing Schema Indexes
CREATE INDEX CONCURRENTLY idx_rates_lookup ON routing.rates(provider_id, prefix, zone, effective_date DESC);
CREATE INDEX CONCURRENTLY idx_rates_active ON routing.rates(prefix, zone) 
    WHERE effective_date <= CURRENT_DATE AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE);
CREATE INDEX CONCURRENTLY idx_rate_overrides_lookup ON routing.rate_overrides(account_id, override_type, pattern)
    WHERE is_active = true AND effective_date <= CURRENT_DATE;
CREATE INDEX CONCURRENTLY idx_providers_active ON routing.providers(provider_type, status) WHERE status = 'ACTIVE';

-- Billing Schema Indexes
CREATE INDEX CONCURRENTLY idx_invoices_overdue ON billing.invoices(due_date, account_id) 
    WHERE status IN ('SENT', 'PARTIAL') AND due_date < CURRENT_DATE;
CREATE INDEX CONCURRENTLY idx_payments_pending ON billing.payments(initiated_at) WHERE status = 'PENDING';
CREATE INDEX CONCURRENTLY idx_invoice_items_invoice ON billing.invoice_items(invoice_id);

-- CDR Schema Indexes (Critical for performance)
CREATE INDEX CONCURRENTLY idx_raw_cdr_enrichment ON billing.raw_cdr(created_at) 
    WHERE enriched = false;
CREATE INDEX CONCURRENTLY idx_raw_cdr_rating ON billing.raw_cdr(enriched, created_at) 
    WHERE rated = false AND enriched = true;
CREATE INDEX CONCURRENTLY idx_raw_cdr_export ON billing.raw_cdr(start_stamp) 
    WHERE exported_to_bq = false;
CREATE INDEX CONCURRENTLY idx_raw_cdr_ani_lookup ON billing.raw_cdr(raw_ani) 
    WHERE ani_lrn IS NULL AND direction = 'TERMINATING';
CREATE INDEX CONCURRENTLY idx_raw_cdr_dni_lookup ON billing.raw_cdr(dni) 
    WHERE dni_lrn IS NULL;

-- Vendor CDR Indexes
CREATE INDEX CONCURRENTLY idx_vendor_cdr_quality ON billing.vendor_cdr(vendor_name, start_stamp, mos_score);
CREATE INDEX CONCURRENTLY idx_vendor_cdr_failures ON billing.vendor_cdr(vendor_name, sip_response_code) 
    WHERE disposition != 'ANSWERED';

-- Message Records Indexes
CREATE INDEX CONCURRENTLY idx_mdr_pending ON billing.message_records(created_at) 
    WHERE enriched = false OR rated = false;
CREATE INDEX CONCURRENTLY idx_mdr_delivery ON billing.message_records(submit_timestamp, delivery_status) 
    WHERE delivery_status IN ('PENDING', 'SENDING');

-- SMS Schema Indexes
CREATE INDEX CONCURRENTLY idx_campaigns_active ON sms.campaigns(account_id, status) 
    WHERE status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_outbound_queue_processing ON sms.outbound_queue(created_at, priority DESC) 
    WHERE status IN ('PENDING', 'QUEUED');
CREATE INDEX CONCURRENTLY idx_outbound_queue_jasmin ON sms.outbound_queue(jasmin_message_id) 
    WHERE jasmin_message_id IS NOT NULL;
CREATE INDEX CONCURRENTLY idx_inbound_webhook ON sms.inbound_messages(to_number, processed) 
    WHERE webhook_delivered = false;
CREATE INDEX CONCURRENTLY idx_opt_outs_lookup ON sms.opt_outs(phone_number, is_active) 
    WHERE is_active = true;

-- Provider Schema Indexes
CREATE INDEX CONCURRENTLY idx_provider_instances_primary ON providers.provider_instances(account_id, provider_id) 
    WHERE is_primary = true AND status = 'ACTIVE';
CREATE INDEX CONCURRENTLY idx_api_logs_recent ON providers.api_logs(instance_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_webhook_active ON providers.webhook_configs(instance_id, event_type) 
    WHERE is_active = true;

-- Audit Schema Indexes
CREATE INDEX CONCURRENTLY idx_audit_recent ON audit.audit_log(changed_at DESC);

-- ============================================
-- UNIQUE CONSTRAINTS (Beyond Primary Keys)
-- ============================================

-- Ensure only one primary provider per category per account
CREATE UNIQUE INDEX CONCURRENTLY idx_one_primary_provider 
    ON providers.provider_instances(account_id, provider_id) 
    WHERE is_primary = true;

-- Ensure unique campaign-number associations
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_campaign_numbers 
    ON sms.campaign_numbers(phone_number) 
    WHERE is_active = true;

-- Ensure unique active opt-outs
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_active_optouts 
    ON sms.opt_outs(phone_number, campaign_id) 
    WHERE is_active = true;

-- ============================================
-- FOREIGN KEY INDEXES (If not created automatically)
-- ============================================

-- These are usually created automatically, but listed for completeness
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fk_account_users_account 
    ON accounts.account_users(account_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fk_account_users_user 
    ON accounts.account_users(user_id);

-- ============================================
-- PARTIAL INDEXES FOR COMMON QUERIES
-- ============================================

-- Active customers with balance issues
CREATE INDEX CONCURRENTLY idx_accounts_low_balance 
    ON accounts.accounts(account_id, current_balance) 
    WHERE status = 'ACTIVE' AND type = 'PREPAID' AND current_balance < 100;

-- Recent high-value calls
CREATE INDEX CONCURRENTLY idx_high_value_cdrs 
    ON billing.raw_cdr(customer_ban, start_stamp, total_charge) 
    WHERE total_charge > 1.0;

-- Failed messages requiring retry
CREATE INDEX CONCURRENTLY idx_sms_retry_needed 
    ON sms.outbound_queue(next_retry_at) 
    WHERE status = 'FAILED' AND attempt_count < 3;

-- ============================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ============================================

-- LCR routing lookup
CREATE INDEX CONCURRENTLY idx_lcr_routing 
    ON routing.rates(prefix, zone, provider_id, rate, priority) 
    WHERE effective_date <= CURRENT_DATE 
    AND (expiration_date IS NULL OR expiration_date > CURRENT_DATE);

-- Customer usage reporting
CREATE INDEX CONCURRENTLY idx_customer_usage 
    ON billing.raw_cdr(customer_ban, start_stamp, direction, call_type, total_charge) 
    WHERE rated = true;

-- Message delivery tracking
CREATE INDEX CONCURRENTLY idx_message_delivery 
    ON sms.outbound_queue(account_id, created_at, status, delivered_at);

-- ============================================
-- EXPRESSION INDEXES
-- ============================================

-- Phone number normalization for lookups
CREATE INDEX CONCURRENTLY idx_normalized_ani 
    ON billing.raw_cdr((CASE WHEN raw_ani LIKE '1%' THEN raw_ani ELSE '1' || raw_ani END));

-- Date-based partitioning helpers
CREATE INDEX CONCURRENTLY idx_cdr_by_date 
    ON billing.raw_cdr(DATE(start_stamp), customer_ban);

CREATE INDEX CONCURRENTLY idx_mdr_by_date 
    ON billing.message_records(DATE(submit_timestamp), customer_ban);

-- ============================================
-- STATISTICS CONFIGURATION
-- ============================================

-- Increase statistics target for frequently filtered columns
ALTER TABLE billing.raw_cdr ALTER COLUMN customer_ban SET STATISTICS 1000;
ALTER TABLE billing.raw_cdr ALTER COLUMN start_stamp SET STATISTICS 1000;
ALTER TABLE billing.raw_cdr ALTER COLUMN direction SET STATISTICS 100;
ALTER TABLE billing.raw_cdr ALTER COLUMN call_type SET STATISTICS 100;

ALTER TABLE sms.outbound_queue ALTER COLUMN status SET STATISTICS 100;
ALTER TABLE sms.outbound_queue ALTER COLUMN account_id SET STATISTICS 500;

-- ============================================
-- MAINTENANCE COMMANDS
-- ============================================

-- Run these periodically for optimal performance:

-- ANALYZE all tables to update statistics
-- ANALYZE;

-- VACUUM to reclaim space and update visibility map
-- VACUUM ANALYZE;

-- Reindex tables with heavy updates (run during maintenance window)
-- REINDEX TABLE billing.raw_cdr;
-- REINDEX TABLE sms.outbound_queue;

-- ============================================
-- MONITORING QUERIES
-- ============================================

-- Query to check index usage
COMMENT ON SCHEMA public IS 'Check index usage with:
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;';

-- Query to find missing indexes
COMMENT ON SCHEMA public IS 'Find missing indexes with:
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE schemaname NOT IN (''pg_catalog'', ''information_schema'')
AND n_distinct > 100
AND correlation < 0.1
ORDER BY n_distinct DESC;';