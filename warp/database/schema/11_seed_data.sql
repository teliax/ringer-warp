-- Initial Seed Data for WARP Platform
-- This file contains essential reference data and test data for development

-- =====================================================
-- Vendor Seed Data
-- =====================================================

-- Sample carriers
INSERT INTO vendor_mgmt.vendors (vendor_code, vendor_name, vendor_type, payment_terms, active) VALUES
('TELNYX', 'Telnyx LLC', 'CARRIER', 'NET7', true),
('PEERLESS', 'Peerless Network', 'CARRIER', 'NET30', true),
('BANDWIDTH', 'Bandwidth Inc', 'CARRIER', 'NET30', true),
('SINCH', 'Sinch AB', 'SMS_PROVIDER', 'PREPAID', true),
('TELIQUE', 'Telique Inc', 'LRN_PROVIDER', 'NET30', true),
('SOMOS', 'Somos Inc', 'TOLLFREE_PROVIDER', 'NET30', true);

-- Carrier details
INSERT INTO vendor_mgmt.carriers (vendor_id, ocn, supports_lrn_dip, supports_sms, supports_emergency)
SELECT id, '1234', true, false, true FROM vendor_mgmt.vendors WHERE vendor_code = 'TELNYX';

INSERT INTO vendor_mgmt.carriers (vendor_id, ocn, supports_lrn_dip, supports_sms, supports_emergency)
SELECT id, '5678', true, false, true FROM vendor_mgmt.vendors WHERE vendor_code = 'PEERLESS';

-- Actual carriers
INSERT INTO routing.carriers (name, company_name, active) VALUES
('telnyx', 'Telnyx LLC', true),
('peerless', 'Peerless Network', true),
('bandwidth', 'Bandwidth Inc', true);

-- Carrier trunks
INSERT INTO routing.carrier_trunks (carrier_id, name, sip_host, sip_port, transport, max_channels, active, health_status)
SELECT id, 'telnyx-primary', 'sip.telnyx.com', 5060, 'UDP', 1000, true, 'UP' 
FROM routing.carriers WHERE name = 'telnyx';

INSERT INTO routing.carrier_trunks (carrier_id, name, sip_host, sip_port, transport, max_channels, active, health_status)
SELECT id, 'peerless-primary', 'sip.peerless.com', 5060, 'UDP', 1000, true, 'UP' 
FROM routing.carriers WHERE name = 'peerless';

-- Service provider configurations (Telique for LRN)
INSERT INTO vendor_mgmt.service_providers (
    vendor_id, provider_type, instance_name, display_name, 
    credentials, settings, capabilities, is_active, is_primary
)
SELECT 
    id, 'telique', 'telique-prod', 'Telique Production',
    '{"api_key_ref": "projects/ringer-472421/secrets/telique-api-credentials/versions/latest"}'::jsonb,
    '{"api_url": "https://api.telique.com/v1", "cache_ttl": 3600}'::jsonb,
    ARRAY['lrn_lookup', 'lerg_lookup', 'cnam_lookup'],
    true, true
FROM vendor_mgmt.vendors WHERE vendor_code = 'TELIQUE';

-- SMPP connector for Sinch
INSERT INTO vendor_mgmt.smpp_connectors (
    vendor_id, connector_name, host, port, 
    system_id, password_encrypted, bind_type, 
    max_throughput, cost_per_sms, cost_per_mms, active
)
SELECT 
    id, 'sinch_primary', 'smpp1.sinch.com', 2775,
    'warp_prod', 'projects/ringer-472421/secrets/sinch-smpp-password/versions/latest',
    'transceiver', 100, 0.0045, 0.0180, true
FROM vendor_mgmt.vendors WHERE vendor_code = 'SINCH';

-- =====================================================
-- Routing Partitions Seed Data
-- =====================================================

INSERT INTO routing.partitions (name, description, carrier_trunk_ids, is_default) VALUES
('premium', 'Premium quality routes', 
 (SELECT ARRAY_AGG(id) FROM routing.carrier_trunks WHERE carrier_id IN 
  (SELECT id FROM routing.carriers WHERE name IN ('telnyx', 'bandwidth'))), 
 false),
('standard', 'Standard quality routes', 
 (SELECT ARRAY_AGG(id) FROM routing.carrier_trunks), 
 true);

-- =====================================================
-- Sample Rate Deck (LCR)
-- =====================================================

-- Telnyx rates
INSERT INTO routing.rate_deck (carrier_trunk_id, prefix, destination_name, country_code, rate, effective_date, active)
SELECT 
    ct.id, '1', 'USA', 'USA', 0.0045, '2025-01-01', true
FROM routing.carrier_trunks ct
JOIN routing.carriers c ON ct.carrier_id = c.id
WHERE c.name = 'telnyx';

INSERT INTO routing.rate_deck (carrier_trunk_id, prefix, destination_name, country_code, rate, effective_date, active)
SELECT 
    ct.id, '1212', 'USA - New York', 'USA', 0.0055, '2025-01-01', true
FROM routing.carrier_trunks ct
JOIN routing.carriers c ON ct.carrier_id = c.id
WHERE c.name = 'telnyx';

-- Peerless rates (slightly higher)
INSERT INTO routing.rate_deck (carrier_trunk_id, prefix, destination_name, country_code, rate, effective_date, active)
SELECT 
    ct.id, '1', 'USA', 'USA', 0.0048, '2025-01-01', true
FROM routing.carrier_trunks ct
JOIN routing.carriers c ON ct.carrier_id = c.id
WHERE c.name = 'peerless';

-- =====================================================
-- Tax Rates
-- =====================================================

-- Federal USF
INSERT INTO billing.tax_rates (country, tax_type, tax_rate, effective_date) VALUES
('USA', 'USF', 0.208, '2024-10-01'); -- 20.8% for Q4 2024

-- State taxes (examples)
INSERT INTO billing.tax_rates (country, state, tax_type, tax_rate, effective_date) VALUES
('USA', 'CA', 'SALES', 0.0725, '2025-01-01'),
('USA', 'NY', 'SALES', 0.0800, '2025-01-01'),
('USA', 'TX', 'SALES', 0.0625, '2025-01-01'),
('USA', 'FL', 'SALES', 0.0600, '2025-01-01');

-- E911 fees
INSERT INTO billing.tax_rates (country, state, tax_type, fixed_amount, tax_rate, effective_date) VALUES
('USA', 'CA', 'E911', 0.75, 0.0000, '2025-01-01'),
('USA', 'NY', 'E911', 1.00, 0.0000, '2025-01-01'),
('USA', 'TX', 'E911', 0.50, 0.0000, '2025-01-01');

-- =====================================================
-- Standard Rate Plans
-- =====================================================

INSERT INTO billing.rate_plans (name, description, plan_type, active, effective_date) VALUES
('standard-wholesale', 'Standard Wholesale Rates', 'STANDARD', true, '2025-01-01'),
('premium-wholesale', 'Premium Wholesale Rates', 'STANDARD', true, '2025-01-01'),
('paygo-retail', 'Pay As You Go Retail', 'STANDARD', true, '2025-01-01');

-- Voice rates for standard wholesale
INSERT INTO billing.voice_rates (
    rate_plan_id, prefix, destination_name, country_code, 
    rate_type, interstate_rate, intrastate_rate, local_rate, 
    initial_increment, subsequent_increment, effective_date
)
SELECT 
    id, '1', 'USA Domestic', 'USA',
    'TERMINATING', 0.0065, 0.0075, 0.0055,
    6, 6, '2025-01-01'
FROM billing.rate_plans WHERE name = 'standard-wholesale';

-- Toll-free rates
INSERT INTO billing.voice_rates (
    rate_plan_id, prefix, destination_name, country_code, 
    rate_type, flat_rate, initial_increment, subsequent_increment, effective_date
)
SELECT 
    id, '1800', 'Toll Free', 'USA',
    'TOLL_FREE', 0.0180, 6, 6, '2025-01-01'
FROM billing.rate_plans WHERE name = 'standard-wholesale';

-- SMS rates
INSERT INTO billing.messaging_rates (
    rate_plan_id, message_type, direction, country_code, 
    rate_per_segment, number_type, effective_date
)
SELECT 
    id, 'sms', 'outbound', 'USA',
    0.0075, 'LONG_CODE', '2025-01-01'
FROM billing.rate_plans WHERE name = 'standard-wholesale';

INSERT INTO billing.messaging_rates (
    rate_plan_id, message_type, direction, country_code, 
    rate_per_segment, number_type, effective_date
)
SELECT 
    id, 'sms', 'inbound', 'USA',
    0.0025, 'LONG_CODE', '2025-01-01'
FROM billing.rate_plans WHERE name = 'standard-wholesale';

-- DID rates
INSERT INTO billing.number_rates (
    rate_plan_id, number_type, country_code, 
    monthly_rate, setup_fee, port_in_fee
)
SELECT 
    id, 'DID', 'USA',
    1.00, 0.00, 5.00
FROM billing.rate_plans WHERE name = 'standard-wholesale';

INSERT INTO billing.number_rates (
    rate_plan_id, number_type, country_code, 
    monthly_rate, setup_fee, port_in_fee
)
SELECT 
    id, 'TOLL_FREE', 'USA',
    2.00, 0.00, 0.00
FROM billing.rate_plans WHERE name = 'standard-wholesale';

-- =====================================================
-- Test Account Data (for development)
-- =====================================================

-- Test account
INSERT INTO accounts.accounts (
    ban, company_name, primary_contact_email, 
    status, billing_cycle, payment_terms, credit_limit,
    max_concurrent_calls, allowed_countries
) VALUES (
    'TEST001', 'WARP Test Account', 'test@warp.dev',
    'ACTIVE', 'POSTPAID', 'NET30', 10000.00,
    100, ARRAY['USA', 'CAN']
);

-- Test user
INSERT INTO auth.users (
    account_id, email, auth_type, 
    first_name, last_name, role, active, email_verified
)
SELECT 
    id, 'admin@warp.dev', 'PASSWORD',
    'Test', 'Admin', 'ADMIN', true, true
FROM accounts.accounts WHERE ban = 'TEST001';

-- Test API key
INSERT INTO auth.api_keys (
    account_id, key_prefix, key_hash, name, 
    scopes, rate_limit_per_second, active
)
SELECT 
    id, 'warp_test_', 
    -- This is SHA256 of 'warp_test_1234567890abcdef'
    'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    'Test API Key',
    ARRAY['cdr.read', 'numbers.read', 'trunks.read'],
    100, true
FROM accounts.accounts WHERE ban = 'TEST001';

-- Test trunk
INSERT INTO routing.trunks (
    account_id, name, auth_type, 
    max_concurrent_calls, calls_per_second_limit, active
)
SELECT 
    id, 'Test SIP Trunk', 'IP_ACL',
    10, 2, true
FROM accounts.accounts WHERE ban = 'TEST001';

-- Test IP ACL
INSERT INTO routing.trunk_acl (trunk_id, ip_address, subnet_mask, description)
SELECT 
    id, '192.168.1.100'::inet, 32, 'Test PBX'
FROM routing.trunks WHERE name = 'Test SIP Trunk';

-- Assign standard partition to test account
INSERT INTO routing.account_partitions (account_id, partition_id)
SELECT 
    a.id, p.id
FROM accounts.accounts a, routing.partitions p
WHERE a.ban = 'TEST001' AND p.name = 'standard';

-- Assign rate plan to test account
INSERT INTO billing.account_rate_plans (account_id, rate_plan_id, active)
SELECT 
    a.id, r.id, true
FROM accounts.accounts a, billing.rate_plans r
WHERE a.ban = 'TEST001' AND r.name = 'standard-wholesale';

-- Initialize account balance
INSERT INTO billing.account_balance (account_id, current_balance, credit_limit)
SELECT 
    id, 0.00, 10000.00
FROM accounts.accounts WHERE ban = 'TEST001';

-- =====================================================
-- Sample Phone Numbers
-- =====================================================

-- Add some test numbers to inventory
INSERT INTO numbers.inventory (
    number, number_type, country_code, npa, nxx,
    rate_center, state, sms_enabled, status
) VALUES
('+14155551000', 'DID', 'USA', '415', '555', 'SAN FRANCISCO', 'CA', true, 'AVAILABLE'),
('+14155551001', 'DID', 'USA', '415', '555', 'SAN FRANCISCO', 'CA', true, 'AVAILABLE'),
('+14155551002', 'DID', 'USA', '415', '555', 'SAN FRANCISCO', 'CA', false, 'AVAILABLE'),
('+12125551000', 'DID', 'USA', '212', '555', 'NEW YORK', 'NY', true, 'AVAILABLE'),
('+12125551001', 'DID', 'USA', '212', '555', 'NEW YORK', 'NY', true, 'AVAILABLE'),
('+18005551234', 'TOLL_FREE', 'USA', '800', '555', NULL, NULL, true, 'AVAILABLE');

-- =====================================================
-- Compliance Data
-- =====================================================

-- Data retention policies
INSERT INTO audit.retention_policies (policy_name, data_type, retention_days, archive_enabled) VALUES
('cdr-retention', 'CDR', 365, true),
('sms-retention', 'SMS', 90, true),
('api-log-retention', 'API_LOGS', 30, true),
('audit-log-retention', 'AUDIT_LOGS', 2555, true); -- 7 years

-- =====================================================
-- Emergency Routes
-- =====================================================

INSERT INTO routing.emergency_routes (country, state, rate_center, primary_route, backup_route) VALUES
('US', 'CA', 'SAN FRANCISCO', 'sip:911@e911-sf.emergency.net', 'sip:911@e911-backup.emergency.net'),
('US', 'NY', 'NEW YORK', 'sip:911@e911-ny.emergency.net', 'sip:911@e911-backup.emergency.net'),
('US', NULL, NULL, 'sip:911@e911-default.emergency.net', 'sip:911@e911-backup.emergency.net'); -- Default route