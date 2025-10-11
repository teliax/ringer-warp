-- WARP Platform Core Schema
-- PostgreSQL 15+ with JSONB for extensibility
-- Database: warp

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CUSTOMERS & ACCOUNTS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS accounts;

-- Main customer/account table
CREATE TABLE accounts.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Core identifiers
    ban VARCHAR(20) UNIQUE NOT NULL,  -- Billing Account Number
    company_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),

    -- Customer type
    customer_type VARCHAR(20) NOT NULL CHECK (customer_type IN ('PREPAID', 'POSTPAID', 'RESELLER')),
    tier VARCHAR(20) DEFAULT 'STANDARD' CHECK (tier IN ('STANDARD', 'PREMIUM', 'ENTERPRISE')),

    -- Contact information
    contact JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {"name": "John Doe", "email": "john@example.com", "phone": "+1..."}

    -- Business address
    address JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {"line1": "123 Main St", "city": "Denver", "state": "CO", "zip": "80202", "country": "US"}

    -- Billing settings
    billing_cycle VARCHAR(20) DEFAULT 'MONTHLY' CHECK (billing_cycle IN ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
    payment_terms INTEGER DEFAULT 30, -- Net days
    currency VARCHAR(3) DEFAULT 'USD',

    -- Account status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED', 'TRIAL')),
    suspension_reason TEXT,

    -- Financial
    credit_limit DECIMAL(12,2),
    current_balance DECIMAL(12,2) DEFAULT 0.00,
    prepaid_balance DECIMAL(12,2) DEFAULT 0.00,

    -- External integrations
    netsuite_customer_id VARCHAR(50),
    hubspot_company_id VARCHAR(50),
    salesforce_account_id VARCHAR(50),

    -- Extensibility - store any additional custom fields
    custom_fields JSONB DEFAULT '{}'::jsonb,
    -- Example: {"tax_id": "12-3456789", "industry": "telecom", "referral_source": "partner"}

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    -- Search optimization
    tsv tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(company_name, '') || ' ' || coalesce(ban, ''))
    ) STORED
);

CREATE INDEX idx_customers_ban ON accounts.customers(ban);
CREATE INDEX idx_customers_status ON accounts.customers(status);
CREATE INDEX idx_customers_type ON accounts.customers(customer_type);
CREATE INDEX idx_customers_search ON accounts.customers USING GIN(tsv);
CREATE INDEX idx_customers_custom ON accounts.customers USING GIN(custom_fields);

-- Customer notes/activity log
CREATE TABLE accounts.customer_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    note_type VARCHAR(50) NOT NULL, -- 'GENERAL', 'SUPPORT', 'BILLING', 'TECHNICAL'
    subject VARCHAR(255),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_customer_notes_customer ON accounts.customer_notes(customer_id, created_at DESC);

-- ============================================================================
-- VOICE VENDORS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS voice;

-- Upstream voice vendors/carriers
CREATE TABLE voice.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Vendor identification
    vendor_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'level3_primary', 'verizon_backup'
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(50) NOT NULL, -- 'TIER1', 'TIER2', 'REGIONAL', 'INTERNATIONAL'

    -- Billing model determines how we're charged
    billing_model VARCHAR(50) NOT NULL CHECK (billing_model IN ('LRN', 'OCN_LATA', 'DNIS', 'PREFIX')),

    -- SIP endpoints (array of connection strings)
    sip_endpoints JSONB NOT NULL,
    -- Example: [
    --   {"host": "sip.level3.com", "port": 5060, "transport": "UDP", "priority": 1},
    --   {"host": "sip2.level3.com", "port": 5060, "transport": "UDP", "priority": 2}
    -- ]

    -- Authentication
    auth_type VARCHAR(20) CHECK (auth_type IN ('IP_ACL', 'DIGEST', 'CERTIFICATE', 'NONE')),
    auth_credentials JSONB DEFAULT '{}'::jsonb,
    -- Example: {"username": "user", "password_ref": "secret_manager_path"}

    -- Capabilities
    supported_codecs VARCHAR(100)[] DEFAULT ARRAY['PCMU', 'PCMA'],
    supports_fax BOOLEAN DEFAULT FALSE,
    supports_emergency BOOLEAN DEFAULT FALSE,
    max_concurrent_calls INTEGER,

    -- Capacity and rate limiting
    capacity_cps INTEGER, -- Calls per second
    capacity_channels INTEGER, -- Concurrent channels

    -- Quality metrics
    expected_asr DECIMAL(5,2), -- Answer Seizure Ratio
    expected_acd INTEGER, -- Average Call Duration (seconds)

    -- Jurisdiction handling
    jurisdiction_policy VARCHAR(50), -- 'INTERSTATE_ONLY', 'INTRASTATE_ONLY', 'BOTH'
    enhanced_classification BOOLEAN DEFAULT FALSE,

    -- Status
    active BOOLEAN NOT NULL DEFAULT TRUE,
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20), -- 'HEALTHY', 'DEGRADED', 'DOWN'

    -- Extensibility
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendors_code ON voice.vendors(vendor_code);
CREATE INDEX idx_vendors_active ON voice.vendors(active) WHERE active = TRUE;

-- Vendor rate tables (simplified - full rates in separate table)
CREATE TABLE voice.vendor_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES voice.vendors(id) ON DELETE CASCADE,

    -- Rate identifier (based on billing model)
    rate_type VARCHAR(50) NOT NULL, -- 'LRN', 'OCN_LATA', 'PREFIX', 'ZONE'
    rate_key VARCHAR(100) NOT NULL, -- The actual value (LRN, prefix, etc)

    -- Zone classification
    zone VARCHAR(50), -- 'INTERSTATE', 'INTRASTATE', 'LOCAL', 'INTERNATIONAL', 'TOLLFREE'

    -- Rates
    rate_per_minute DECIMAL(10,6) NOT NULL,
    minimum_duration_seconds INTEGER DEFAULT 6,
    billing_increment_seconds INTEGER DEFAULT 6,

    -- Time-based rates (optional)
    peak_rate DECIMAL(10,6),
    offpeak_rate DECIMAL(10,6),

    -- Validity
    effective_date DATE NOT NULL,
    expiration_date DATE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vendor_rates_lookup ON voice.vendor_rates(vendor_id, rate_type, rate_key, effective_date);
CREATE INDEX idx_vendor_rates_zone ON voice.vendor_rates(vendor_id, zone);

-- ============================================================================
-- ROUTING & PARTITIONS
-- ============================================================================

-- Partitions (routing groups) - implements partition-based routing from PRD
CREATE TABLE voice.partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    partition_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'ABC123', 'PREMIUM_ROUTES'
    partition_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Partition type
    partition_type VARCHAR(50) DEFAULT 'STANDARD', -- 'STANDARD', 'PREMIUM', 'BUDGET', 'CUSTOM'

    -- Configuration
    lcr_enabled BOOLEAN DEFAULT TRUE,
    failover_enabled BOOLEAN DEFAULT TRUE,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition-vendor assignments (which vendors are available in each partition)
CREATE TABLE voice.partition_vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partition_id UUID NOT NULL REFERENCES voice.partitions(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES voice.vendors(id) ON DELETE CASCADE,

    priority INTEGER NOT NULL DEFAULT 100, -- Lower = higher priority
    weight INTEGER DEFAULT 100, -- For load balancing

    active BOOLEAN NOT NULL DEFAULT TRUE,

    UNIQUE(partition_id, vendor_id)
);

CREATE INDEX idx_partition_vendors_lookup ON voice.partition_vendors(partition_id, priority) WHERE active = TRUE;

-- ============================================================================
-- SIP TRUNKS (Customer connections)
-- ============================================================================

-- Customer SIP trunks - the KEY relationship between customers and voice services
CREATE TABLE voice.trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- CRITICAL: Links trunk to customer
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- Trunk identification
    trunk_name VARCHAR(255) NOT NULL,
    trunk_code VARCHAR(50), -- Optional short code

    -- CRITICAL: Links trunk to routing partition
    partition_id UUID REFERENCES voice.partitions(id),

    -- Inbound (Customer → WARP)
    inbound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {
    --   "auth_type": "IP_ACL",
    --   "allowed_ips": ["198.51.100.10/32"],
    --   "digest_credentials": {"username": "trunk1", "password_ref": "secret_path"},
    --   "signaling_addresses": ["sip.warp.ringer.tel", "sip-backup.warp.ringer.tel"],
    --   "port": 5060,
    --   "transport": "UDP"
    -- }

    -- Outbound (WARP → Customer)
    outbound_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example: {
    --   "destination_ips": [
    --     {"ip": "203.0.113.50", "port": 5060, "transport": "UDP", "priority": 1}
    --   ],
    --   "options_ping": true,
    --   "max_forwards": 70
    -- }

    -- Codec settings
    codecs VARCHAR(50)[] DEFAULT ARRAY['PCMU', 'PCMA'],
    dtmf_mode VARCHAR(20) DEFAULT 'RFC2833',

    -- Capacity limits
    max_concurrent_calls INTEGER DEFAULT 100,
    calls_per_second_limit INTEGER DEFAULT 10,

    -- Billing limits
    daily_spend_limit DECIMAL(10,2),
    monthly_minute_limit INTEGER,

    -- Emergency services
    emergency_enabled BOOLEAN DEFAULT TRUE,
    default_e911_address_id UUID, -- Reference to E911 addresses table
    callback_number VARCHAR(20),

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TESTING', 'INACTIVE')),

    -- Extensibility
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(20)
);

CREATE INDEX idx_trunks_customer ON voice.trunks(customer_id);
CREATE INDEX idx_trunks_partition ON voice.trunks(partition_id);
CREATE INDEX idx_trunks_status ON voice.trunks(status) WHERE status = 'ACTIVE';

-- Phone numbers (DIDs) assigned to trunks
CREATE TABLE voice.dids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- CRITICAL: The phone number itself
    number VARCHAR(20) UNIQUE NOT NULL, -- E.164 format: +14155551234

    -- CRITICAL: Links number to customer and trunk
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    trunk_id UUID REFERENCES voice.trunks(id) ON DELETE SET NULL,

    -- Number characteristics
    number_type VARCHAR(50) NOT NULL, -- 'LOCAL', 'TOLLFREE', 'MOBILE', 'SHORTCODE'
    country_code VARCHAR(5) NOT NULL,
    npa VARCHAR(10), -- Area code
    nxx VARCHAR(10),
    rate_center VARCHAR(100),
    lata VARCHAR(10),
    state VARCHAR(5),

    -- Features enabled
    voice_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    mms_enabled BOOLEAN DEFAULT FALSE,
    fax_enabled BOOLEAN DEFAULT FALSE,

    -- E911 configuration
    e911_address_id UUID, -- Reference to E911 addresses
    e911_validated BOOLEAN DEFAULT FALSE,

    -- CNAM (Caller ID Name)
    cnam VARCHAR(15),

    -- Porting information
    ported BOOLEAN DEFAULT FALSE,
    ported_from_carrier VARCHAR(100),
    ported_date DATE,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESERVED', 'PORTING', 'DISCONNECTED')),

    -- Extensibility
    custom_fields JSONB DEFAULT '{}'::jsonb,

    -- Metadata
    acquired_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dids_number ON voice.dids(number);
CREATE INDEX idx_dids_customer ON voice.dids(customer_id);
CREATE INDEX idx_dids_trunk ON voice.dids(trunk_id);
CREATE INDEX idx_dids_status ON voice.dids(status);

-- ============================================================================
-- SMS/MESSAGING
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS messaging;

-- SMS vendor connectors (go-smpp vendors)
CREATE TABLE messaging.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    vendor_name VARCHAR(100) UNIQUE NOT NULL,
    vendor_type VARCHAR(50) NOT NULL, -- 'SMPP', 'HTTP', 'SIP'

    -- SMPP configuration (for go-smpp)
    smpp_config JSONB DEFAULT '{}'::jsonb,
    -- Example: {
    --   "host": "msgbrokersmpp-chi.inteliquent.com",
    --   "port": 3601,
    --   "system_id": "teluMBc1",
    --   "password_ref": "secret_manager_path",
    --   "tls_enabled": true,
    --   "bind_type": "transceiver"
    -- }

    -- Rate information
    sms_rate DECIMAL(10,6) NOT NULL,
    mms_rate DECIMAL(10,6),

    -- Capabilities
    supports_sms BOOLEAN DEFAULT TRUE,
    supports_mms BOOLEAN DEFAULT FALSE,
    supports_unicode BOOLEAN DEFAULT TRUE,
    max_message_length INTEGER DEFAULT 160,

    -- Throughput limits
    throughput_limit INTEGER DEFAULT 100, -- messages per second

    -- Status
    active BOOLEAN NOT NULL DEFAULT TRUE,
    health_status VARCHAR(20),
    last_health_check TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer SMS configuration (links customer to messaging)
CREATE TABLE messaging.customer_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- CRITICAL: Links to customer
    customer_id UUID UNIQUE NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- Default sending configuration
    default_sender_id VARCHAR(20),
    allowed_sender_ids VARCHAR(20)[],

    -- Rate limits
    messages_per_second INTEGER DEFAULT 10,
    daily_message_limit INTEGER,
    monthly_message_limit INTEGER,

    -- Delivery configuration
    delivery_method VARCHAR(20) DEFAULT 'WEBHOOK', -- 'WEBHOOK', 'SMPP', 'STORAGE'
    webhook_url VARCHAR(500),
    webhook_secret VARCHAR(255),

    -- 10DLC compliance
    brand_id VARCHAR(100),
    default_campaign_id VARCHAR(100),

    -- Status
    active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CALL/MESSAGE DETAIL RECORDS - Operational (Recent only)
-- ============================================================================

-- NOTE: Full CDRs/MDRs stored in BigQuery
-- This table keeps last 7 days for real-time queries

CREATE TABLE voice.cdrs_recent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id VARCHAR(100) UNIQUE NOT NULL,

    -- CRITICAL: Customer relationship
    customer_id UUID NOT NULL REFERENCES accounts.customers(id),
    trunk_id UUID REFERENCES voice.trunks(id),

    -- Call details
    start_time TIMESTAMPTZ NOT NULL,
    answer_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,

    ani VARCHAR(20) NOT NULL,
    dnis VARCHAR(20) NOT NULL,

    -- Routing
    zone VARCHAR(50), -- Derived: INTERSTATE, INTRASTATE, LOCAL, etc
    selected_vendor_id UUID REFERENCES voice.vendors(id),
    partition_id UUID REFERENCES voice.partitions(id),

    -- Duration
    duration_seconds INTEGER,
    billable_seconds INTEGER,

    -- Rating (simplified - full in BigQuery)
    vendor_rate DECIMAL(10,6),
    customer_rate DECIMAL(10,6),
    rated_amount DECIMAL(12,4),

    -- Status
    call_status VARCHAR(50),
    release_cause INTEGER,

    -- Metadata for BigQuery sync
    synced_to_bigquery BOOLEAN DEFAULT FALSE,
    bigquery_sync_time TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition by day, auto-delete after 7 days
CREATE INDEX idx_cdrs_recent_customer ON voice.cdrs_recent(customer_id, start_time DESC);
CREATE INDEX idx_cdrs_recent_time ON voice.cdrs_recent(start_time DESC);
CREATE INDEX idx_cdrs_recent_sync ON voice.cdrs_recent(synced_to_bigquery) WHERE synced_to_bigquery = FALSE;

-- Similar for messages
CREATE TABLE messaging.mdrs_recent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(100) UNIQUE NOT NULL,

    -- CRITICAL: Customer relationship
    customer_id UUID NOT NULL REFERENCES accounts.customers(id),

    -- Message details
    created_at TIMESTAMPTZ NOT NULL,
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,

    message_type VARCHAR(10), -- 'SMS', 'MMS'
    direction VARCHAR(10), -- 'INBOUND', 'OUTBOUND'
    segments INTEGER DEFAULT 1,

    -- Routing
    selected_vendor_id UUID REFERENCES messaging.vendors(id),

    -- Status
    status VARCHAR(50),
    dlr_status VARCHAR(50),

    -- Rating
    rate_per_segment DECIMAL(10,6),
    rated_amount DECIMAL(12,4),

    -- Metadata
    synced_to_bigquery BOOLEAN DEFAULT FALSE,
    bigquery_sync_time TIMESTAMPTZ
);

CREATE INDEX idx_mdrs_recent_customer ON messaging.mdrs_recent(customer_id, created_at DESC);
CREATE INDEX idx_mdrs_recent_time ON messaging.mdrs_recent(created_at DESC);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON accounts.customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON voice.vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trunks_updated_at BEFORE UPDATE ON voice.trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dids_updated_at BEFORE UPDATE ON voice.dids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert a test customer
INSERT INTO accounts.customers (
    ban, company_name, customer_type, tier,
    contact, address, billing_cycle, status
) VALUES (
    'TEST-001',
    'Acme Telecom Corp',
    'POSTPAID',
    'ENTERPRISE',
    '{"name": "John Doe", "email": "john@acme.com", "phone": "+13035551234"}'::jsonb,
    '{"line1": "123 Main St", "city": "Denver", "state": "CO", "zip": "80202", "country": "US"}'::jsonb,
    'MONTHLY',
    'ACTIVE'
);

-- Insert a partition
INSERT INTO voice.partitions (partition_code, partition_name, description) VALUES
    ('STANDARD', 'Standard Routes', 'Default routing partition for standard customers');

COMMENT ON SCHEMA accounts IS 'Customer and account management';
COMMENT ON SCHEMA voice IS 'Voice services, vendors, trunks, routing';
COMMENT ON SCHEMA messaging IS 'SMS/MMS services and vendors';
