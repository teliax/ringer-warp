-- WARP Platform Initial Data
-- Database: Cloud SQL (PostgreSQL 15)
-- Project: ringer-warp-v01

-- ============================================
-- DEFAULT ROUTING PROVIDERS
-- ============================================

-- Insert initial providers
INSERT INTO routing.providers (provider_name, provider_type, status, jurisdiction_status, ij_policy, dialstring_template, max_channels, target_asr, target_acd) VALUES
-- Tier 1 Providers
('Inteliquent', 'LRN', 'ACTIVE', 'ENHANCED', 'INTERSTATE', 'sip:+${number}@sip.inteliquent.com:5060', 5000, 42.00, 180.00),
('Peerless', 'LRN', 'ACTIVE', 'ENHANCED', 'POI', 'sip:${number}@termination.peerlessnetwork.com', 3000, 40.00, 175.00),
('Level3', 'LRN', 'ACTIVE', 'ENHANCED', 'MIXED', 'sip:+1${number}@pstn.level3.net', 10000, 45.00, 190.00),

-- Toll-Free Specialists
('ATT_TollFree', 'TOLLFREE', 'ACTIVE', 'ENHANCED', 'INTERSTATE', 'sip:${number}@tollfree.att.com', 2000, 48.00, 240.00),
('Inteliquent_TF', 'TOLLFREE', 'ACTIVE', 'ENHANCED', 'INTERSTATE', 'sip:${number}@tf.inteliquent.com', 2000, 46.00, 220.00),

-- Value Providers
('Thinq', 'OCNLATA', 'ACTIVE', 'NONENHANCED', 'INTERSTATE', 'sip:1${number}@sip.thinq.com', 1000, 38.00, 160.00),
('VoIPInnovations', 'OCNLATA', 'ACTIVE', 'NONENHANCED', 'MIXED', 'sip:${number}@outbound.voipinnovations.com', 1500, 36.00, 150.00),

-- Dialer Traffic
('Twilio', 'DNIS', 'ACTIVE', 'DIALER', 'INTERSTATE', 'sip:+${number}@termination.twilio.com', 500, 35.00, 120.00),
('Telnyx', 'DNIS', 'ACTIVE', 'DIALER', 'INTERSTATE', 'sip:${number}@sip.telnyx.com', 1000, 37.00, 130.00),

-- International
('BICS', 'INTERNATIONAL', 'ACTIVE', 'UNKNOWN', 'INTERSTATE', 'sip:00${number}@sip.bics.com', 500, 35.00, 90.00),
('IDT', 'INTERNATIONAL', 'ACTIVE', 'UNKNOWN', 'INTERSTATE', 'sip:011${number}@termination.idt.net', 500, 33.00, 85.00);

-- ============================================
-- DEFAULT RATE PLANS
-- ============================================

-- Standard Interstate Rates (Tier 1)
INSERT INTO routing.rates (provider_id, prefix, zone, rate, connection_fee, initial_increment, subsequent_increment, effective_date, priority) 
SELECT 
    p.id,
    '1',
    'INTERSTATE',
    0.004500,
    0,
    6,
    6,
    CURRENT_DATE,
    100
FROM routing.providers p WHERE p.provider_name = 'Inteliquent';

INSERT INTO routing.rates (provider_id, prefix, zone, rate, connection_fee, initial_increment, subsequent_increment, effective_date, priority) 
SELECT 
    p.id,
    '1',
    'INTERSTATE',
    0.005000,
    0,
    6,
    6,
    CURRENT_DATE,
    90
FROM routing.providers p WHERE p.provider_name = 'Peerless';

-- Toll-Free Rates
INSERT INTO routing.rates (provider_id, prefix, zone, rate, connection_fee, initial_increment, subsequent_increment, effective_date, priority) 
SELECT 
    p.id,
    prefix,
    'TOLLFREE',
    0.018000,
    0,
    6,
    6,
    CURRENT_DATE,
    100
FROM routing.providers p, 
    (VALUES ('1800'), ('1888'), ('1877'), ('1866'), ('1855'), ('1844'), ('1833')) AS tf(prefix)
WHERE p.provider_name = 'ATT_TollFree';

-- Intrastate Rates (Sample for California)
INSERT INTO routing.rates (provider_id, prefix, zone, rate, connection_fee, initial_increment, subsequent_increment, effective_date, priority) 
SELECT 
    p.id,
    npanxx,
    'INTRASTATE',
    0.008500,
    0,
    6,
    6,
    CURRENT_DATE,
    100
FROM routing.providers p,
    (VALUES ('1209'), ('1213'), ('1310'), ('1323'), ('1408'), ('1415'), ('1510'), ('1559'), ('1562'), 
            ('1619'), ('1626'), ('1650'), ('1657'), ('1661'), ('1707'), ('1714'), ('1760'), ('1805'), 
            ('1818'), ('1831'), ('1858'), ('1909'), ('1916'), ('1925'), ('1949'), ('1951')) AS ca(npanxx)
WHERE p.provider_name = 'Peerless' AND p.poi_state = 'CA';

-- ============================================
-- DEFAULT TAX CONFIGURATION
-- ============================================

-- Federal USF Rate
INSERT INTO billing.tax_rates (tax_type, tax_name, rate, effective_date, jurisdiction) VALUES
('FEDERAL', 'USF', 0.334, CURRENT_DATE, 'US'),
('FEDERAL', 'FCC_REGULATORY', 0.00302, CURRENT_DATE, 'US');

-- State Tax Examples
INSERT INTO billing.tax_rates (tax_type, tax_name, rate, effective_date, jurisdiction, state) VALUES
('STATE', 'CA_TELECOM_TAX', 0.0475, CURRENT_DATE, 'STATE', 'CA'),
('STATE', 'TX_UTILITY_TAX', 0.0325, CURRENT_DATE, 'STATE', 'TX'),
('STATE', 'NY_EXCISE_TAX', 0.0275, CURRENT_DATE, 'STATE', 'NY');

-- ============================================
-- DEFAULT SMS PROVIDER CONFIG
-- ============================================

-- Default Jasmin HTTP User for internal use
INSERT INTO sms.jasmin_users (
    account_id,
    username,
    password_encrypted,
    uid,
    gid,
    connection_type,
    mt_quota,
    is_active
) VALUES (
    NULL, -- System user
    'warp_system',
    pgp_sym_encrypt('auto_generated_password_123!', 'encryption_key'),
    'system',
    'system',
    'HTTP',
    100,
    true
);

-- Default Jasmin Routes
INSERT INTO sms.jasmin_routes (route_id, route_type, filter_type, filter_value, connector_id, priority) VALUES
('default_mt', 'MT', 'UserFilter', 'gid=customers', 'sinch_primary', 100),
('premium_mt', 'MT', 'UserFilter', 'gid=premium', 'sinch_primary', 200),
('tollfree_mt', 'MT', 'DestinationFilter', '^1(800|888|877|866|855|844|833)', 'sinch_tollfree', 150);

-- ============================================
-- SAMPLE CUSTOMER RATE PLAN
-- ============================================

-- Create a default rate plan template
INSERT INTO billing.rate_plans (
    id,
    plan_name,
    plan_type,
    description,
    is_default
) VALUES (
    uuid_generate_v4(),
    'Standard Business',
    'POSTPAID',
    'Standard business rate plan with competitive interstate rates',
    true
);

-- ============================================
-- DEFAULT BILLING ITEMS
-- ============================================

-- Product catalog items (matching PRODUCT_CATALOG.md)
INSERT INTO billing.product_catalog (sku, category, subcategory, name, description, unit_price, unit_type) VALUES
-- Voice Termination
('VOICE_TERM_INTERSTATE', 'VOICE', 'TERMINATION', 'Interstate Voice Termination', 'Interstate call termination per minute', 0.0065, 'MINUTE'),
('VOICE_TERM_INTRASTATE', 'VOICE', 'TERMINATION', 'Intrastate Voice Termination', 'Intrastate call termination per minute', 0.0085, 'MINUTE'),
('VOICE_TERM_LOCAL', 'VOICE', 'TERMINATION', 'Local Voice Termination', 'Local call termination per minute', 0.0045, 'MINUTE'),
('VOICE_TERM_TOLLFREE', 'VOICE', 'TERMINATION', 'Toll-Free Termination', 'Toll-free inbound per minute', 0.0190, 'MINUTE'),
('VOICE_TERM_INTL', 'VOICE', 'TERMINATION', 'International Termination', 'International call termination per minute', 0.0500, 'MINUTE'),

-- DID Services
('DID_LOCAL_MONTHLY', 'DID', 'MONTHLY', 'Local DID Monthly', 'Local phone number monthly charge', 1.00, 'NUMBER'),
('DID_TOLLFREE_MONTHLY', 'DID', 'MONTHLY', 'Toll-Free DID Monthly', 'Toll-free number monthly charge', 2.00, 'NUMBER'),
('DID_LOCAL_USAGE', 'DID', 'USAGE', 'Local DID Usage', 'Local DID inbound usage per minute', 0.0045, 'MINUTE'),
('DID_TOLLFREE_USAGE', 'DID', 'USAGE', 'Toll-Free Usage', 'Toll-free inbound usage per minute', 0.0190, 'MINUTE'),

-- SMS Services
('SMS_LONGCODE_OUT', 'SMS', 'OUTBOUND', 'SMS Outbound (10DLC)', 'Outbound SMS per segment', 0.0075, 'SEGMENT'),
('SMS_TOLLFREE_OUT', 'SMS', 'OUTBOUND', 'SMS Outbound (Toll-Free)', 'Outbound toll-free SMS per segment', 0.0095, 'SEGMENT'),
('SMS_SHORTCODE_OUT', 'SMS', 'OUTBOUND', 'SMS Outbound (Shortcode)', 'Outbound shortcode SMS per segment', 0.0065, 'SEGMENT'),
('SMS_MMS_OUT', 'SMS', 'OUTBOUND', 'MMS Outbound', 'Outbound MMS per message', 0.0400, 'MESSAGE'),

-- API Services
('API_LRN_LOOKUP', 'API', 'LOOKUP', 'LRN Lookup', 'LRN database lookup per query', 0.0050, 'QUERY'),
('API_CNAM_LOOKUP', 'API', 'LOOKUP', 'CNAM Lookup', 'Caller name lookup per query', 0.0080, 'QUERY'),
('API_DNC_CHECK', 'API', 'COMPLIANCE', 'DNC Check', 'Do Not Call registry check', 0.0030, 'QUERY');

-- ============================================
-- SYSTEM CONFIGURATION
-- ============================================

-- System settings
CREATE TABLE IF NOT EXISTS system.settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO system.settings (key, value, description) VALUES
('billing.invoice_due_days', '30', 'Days until invoice is due'),
('billing.late_fee_percentage', '1.5', 'Monthly late fee percentage'),
('billing.low_balance_threshold', '100', 'Low balance alert threshold'),
('cdr.retention_days', '90', 'Days to retain CDR records'),
('cdr.export_batch_size', '1000', 'CDR export batch size'),
('sms.default_throughput', '10', 'Default SMS throughput per second'),
('api.rate_limit_default', '100', 'Default API rate limit per second');

-- ============================================
-- AUDIT TRIGGERS
-- ============================================

-- Create audit trigger function if not exists
CREATE OR REPLACE FUNCTION audit_trigger_function() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log (table_name, record_id, action, old_values, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), current_setting('app.current_user_id', true)::uuid);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log (table_name, record_id, action, old_values, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), current_setting('app.current_user_id', true)::uuid);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log (table_name, record_id, action, new_values, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), current_setting('app.current_user_id', true)::uuid);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_accounts AFTER INSERT OR UPDATE OR DELETE ON accounts.accounts
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_trunks AFTER INSERT OR UPDATE OR DELETE ON trunks.trunks
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_payments AFTER INSERT OR UPDATE OR DELETE ON billing.payments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- ============================================
-- GRANTS FOR READ-ONLY MONITORING
-- ============================================

-- Create monitoring role
CREATE ROLE warp_monitor;

-- Grant read permissions
GRANT USAGE ON SCHEMA auth, accounts, billing, trunks, numbers, routing, audit, sms, providers TO warp_monitor;
GRANT SELECT ON ALL TABLES IN SCHEMA auth, accounts, billing, trunks, numbers, routing, audit, sms, providers TO warp_monitor;

-- Create monitoring user (password should be set separately)
-- CREATE USER monitoring_user WITH PASSWORD 'secure_password';
-- GRANT warp_monitor TO monitoring_user;