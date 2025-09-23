-- Performance Indexes and Optimizations
-- Additional indexes for common queries and reporting

-- =====================================================
-- CDR Performance Indexes
-- =====================================================

-- For billing queries
CREATE INDEX idx_raw_cdr_billing ON cdr.raw_cdr(account_id, setup_time, billable_duration) 
WHERE enriched = TRUE AND billed = FALSE;

-- For real-time dashboard queries
CREATE INDEX idx_raw_cdr_realtime ON cdr.raw_cdr(account_id, setup_time DESC) 
WHERE setup_time > (NOW() - INTERVAL '24 hours');

-- For routing analysis
CREATE INDEX idx_raw_cdr_routing ON cdr.raw_cdr(selected_carrier_id, selected_trunk_id, setup_time);

-- Composite index for enrichment queries
CREATE INDEX idx_enriched_cdr_billing_composite ON cdr.enriched_cdr(
    jurisdiction, 
    created_at DESC,
    customer_amount
);

-- =====================================================
-- Number Management Performance
-- =====================================================

-- For number search by pattern
CREATE INDEX idx_inventory_pattern ON numbers.inventory USING gin(number gin_trgm_ops);

-- For available number searches
CREATE INDEX idx_inventory_available ON numbers.inventory(number_type, status, country_code, state)
WHERE status = 'AVAILABLE';

-- For DID lookups by features
CREATE INDEX idx_dids_features ON numbers.dids(account_id, sms_enabled, voice_enabled)
WHERE active = TRUE;

-- =====================================================
-- Routing Performance
-- =====================================================

-- For LCR calculations
CREATE INDEX idx_rate_deck_lcr ON routing.rate_deck(prefix, effective_date DESC, rate)
WHERE active = TRUE;

-- For trunk selection
CREATE INDEX idx_carrier_trunks_selection ON routing.carrier_trunks(
    carrier_id, 
    active, 
    health_status,
    current_calls,
    max_channels
) WHERE active = TRUE;

-- For IP ACL lookups
CREATE INDEX idx_trunk_acl_ip_range ON routing.trunk_acl USING gist(
    inet(host(ip_address) || '/' || subnet_mask)
);

-- =====================================================
-- Messaging Performance
-- =====================================================

-- For message status updates
CREATE INDEX idx_mdr_status_updates ON messaging.mdr(vendor_message_id, status)
WHERE status IN ('QUEUED', 'SENT');

-- For delivery receipt processing
CREATE INDEX idx_mdr_dlr ON messaging.mdr(message_id, direction)
WHERE dlr_status IS NULL;

-- For opt-out lookups
CREATE INDEX idx_opt_outs_lookup ON messaging.opt_outs(phone_number, active, opt_out_scope)
WHERE active = TRUE;

-- =====================================================
-- Billing Performance
-- =====================================================

-- For invoice generation
CREATE INDEX idx_usage_summary_unbilled ON billing.usage_summary(
    account_id,
    billing_period_start
) WHERE processed = FALSE;

-- For payment application
CREATE INDEX idx_invoices_unpaid ON billing.invoices(account_id, due_date)
WHERE status IN ('SENT', 'PARTIAL', 'OVERDUE');

-- For rate lookups
CREATE INDEX idx_voice_rates_lookup ON billing.voice_rates(
    rate_plan_id,
    prefix,
    rate_type,
    effective_date DESC
) WHERE expires_date IS NULL OR expires_date > CURRENT_DATE;

-- =====================================================
-- Audit Performance
-- =====================================================

-- For compliance reporting
CREATE INDEX idx_audit_log_compliance ON audit.audit_log(
    event_category,
    created_at DESC
) WHERE event_category IN ('BILLING', 'SECURITY', 'ROUTING');

-- For API performance monitoring
CREATE INDEX idx_api_request_log_perf ON audit.api_request_log(
    path,
    created_at DESC,
    response_time_ms
);

-- =====================================================
-- Materialized Views for Reporting
-- =====================================================

-- Hourly traffic summary
CREATE MATERIALIZED VIEW reporting.hourly_traffic AS
SELECT 
    date_trunc('hour', r.setup_time) as hour,
    r.account_id,
    r.direction,
    COUNT(*) as call_count,
    SUM(CASE WHEN r.answer_time IS NOT NULL THEN 1 ELSE 0 END) as completed_calls,
    SUM(r.billable_duration) as total_minutes,
    AVG(r.billable_duration) as avg_duration,
    SUM(e.customer_amount) as revenue,
    SUM(e.vendor_amount) as cost,
    SUM(e.margin_amount) as margin
FROM cdr.raw_cdr r
LEFT JOIN cdr.enriched_cdr e ON r.id = e.id
WHERE r.setup_time >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3
WITH DATA;

CREATE UNIQUE INDEX ON reporting.hourly_traffic(hour, account_id, direction);

-- Daily account summary
CREATE MATERIALIZED VIEW reporting.daily_account_summary AS
SELECT 
    DATE(r.setup_time) as call_date,
    r.account_id,
    a.company_name,
    COUNT(*) as total_calls,
    SUM(r.billable_duration) / 60.0 as total_minutes,
    SUM(e.customer_amount) as revenue,
    AVG(CASE WHEN r.answer_time IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (r.answer_time - r.setup_time)) 
    END) as avg_pdd_seconds,
    COUNT(DISTINCT r.ani) as unique_callers,
    COUNT(DISTINCT r.dnis) as unique_destinations
FROM cdr.raw_cdr r
JOIN accounts.accounts a ON r.account_id = a.id
LEFT JOIN cdr.enriched_cdr e ON r.id = e.id
WHERE r.setup_time >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2, 3
WITH DATA;

CREATE UNIQUE INDEX ON reporting.daily_account_summary(call_date, account_id);

-- Carrier performance view
CREATE MATERIALIZED VIEW reporting.carrier_performance AS
SELECT 
    c.name as carrier_name,
    ct.name as trunk_name,
    DATE(r.setup_time) as date,
    COUNT(*) as attempts,
    COUNT(CASE WHEN r.answer_time IS NOT NULL THEN 1 END) as completed,
    AVG(CASE WHEN r.answer_time IS NOT NULL THEN r.duration END) as acd_seconds,
    COUNT(CASE WHEN r.answer_time IS NOT NULL THEN 1 END)::DECIMAL / 
        COUNT(*)::DECIMAL * 100 as asr_percentage,
    AVG(e.pdd) as avg_pdd_ms
FROM cdr.raw_cdr r
JOIN routing.carrier_trunks ct ON r.selected_trunk_id = ct.id
JOIN routing.carriers c ON ct.carrier_id = c.id
LEFT JOIN cdr.enriched_cdr e ON r.id = e.id
WHERE r.setup_time >= NOW() - INTERVAL '7 days'
GROUP BY 1, 2, 3
WITH DATA;

CREATE UNIQUE INDEX ON reporting.carrier_performance(carrier_name, trunk_name, date);

-- =====================================================
-- Refresh Functions for Materialized Views
-- =====================================================

CREATE OR REPLACE FUNCTION reporting.refresh_hourly_traffic()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.hourly_traffic;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reporting.refresh_daily_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.daily_account_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reporting.refresh_carrier_performance()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY reporting.carrier_performance;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Table Statistics and Maintenance
-- =====================================================

-- Ensure statistics are up to date for query planning
CREATE OR REPLACE FUNCTION maintenance.update_table_statistics()
RETURNS void AS $$
DECLARE
    schema_table RECORD;
BEGIN
    FOR schema_table IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname IN ('accounts', 'auth', 'billing', 'cdr', 'messaging', 'numbers', 'routing', 'vendor_mgmt', 'audit')
    LOOP
        EXECUTE format('ANALYZE %I.%I', schema_table.schemaname, schema_table.tablename);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Query Performance Helpers
-- =====================================================

-- Function to explain slow queries
CREATE OR REPLACE FUNCTION debug.explain_query(query_text TEXT)
RETURNS TABLE (plan_line TEXT) AS $$
BEGIN
    RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS) ' || query_text;
END;
$$ LANGUAGE plpgsql;

-- Function to find missing indexes
CREATE OR REPLACE FUNCTION debug.find_missing_indexes()
RETURNS TABLE (
    schemaname TEXT,
    tablename TEXT,
    attname TEXT,
    n_distinct REAL,
    correlation REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.nspname::TEXT,
        c.relname::TEXT,
        a.attname::TEXT,
        s.n_distinct,
        s.correlation
    FROM pg_stats s
    JOIN pg_attribute a ON a.attname = s.attname
    JOIN pg_class c ON c.oid = a.attrelid AND c.relname = s.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = s.schemaname
    WHERE s.schemaname IN ('accounts', 'auth', 'billing', 'cdr', 'messaging', 'numbers', 'routing', 'vendor_mgmt', 'audit')
    AND s.n_distinct > 100
    AND abs(s.correlation) < 0.1
    AND NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = c.oid
        AND a.attnum = ANY(i.indkey)
    )
    ORDER BY s.n_distinct DESC;
END;
$$ LANGUAGE plpgsql;