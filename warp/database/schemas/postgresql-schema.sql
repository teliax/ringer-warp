-- WARP Platform PostgreSQL Schema
-- Database: Cloud SQL (PostgreSQL 15)
-- Project: ringer-472421

-- ============================================
-- EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For compound indexes

-- ============================================
-- SCHEMAS
-- ============================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS accounts;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS trunks;
CREATE SCHEMA IF NOT EXISTS numbers;
CREATE SCHEMA IF NOT EXISTS routing;
CREATE SCHEMA IF NOT EXISTS audit;

-- ============================================
-- AUTH SCHEMA - Authentication & Authorization
-- ============================================

-- Users table (managed by Google Identity Platform, cached locally)
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL, -- Firebase Auth UID
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_auth_users_email ON auth.users(email);
CREATE INDEX idx_auth_users_firebase_uid ON auth.users(firebase_uid);

-- Roles
CREATE TABLE auth.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Role associations
CREATE TABLE auth.user_roles (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES auth.roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (user_id, role_id)
);

-- API Keys for service accounts
CREATE TABLE auth.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA256 hash of the key
    name VARCHAR(100) NOT NULL,
    account_id UUID NOT NULL, -- References accounts.accounts(id)
    permissions JSONB DEFAULT '[]'::jsonb,
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    is_active BOOLEAN DEFAULT true
);

-- ============================================
-- ACCOUNTS SCHEMA - Customer Management
-- ============================================

-- Customer accounts
CREATE TABLE accounts.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number VARCHAR(20) UNIQUE NOT NULL, -- BAN equivalent
    company_name VARCHAR(255) NOT NULL,
    dba_name VARCHAR(255),
    type VARCHAR(50) NOT NULL CHECK (type IN ('PREPAID', 'POSTPAID', 'ENTERPRISE')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'PENDING', 'CLOSED')),

    -- Contact information
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(20),

    -- Billing address
    billing_address_line1 VARCHAR(255),
    billing_address_line2 VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(2),
    billing_postal_code VARCHAR(10),
    billing_country VARCHAR(2) DEFAULT 'US',

    -- Financial
    credit_limit DECIMAL(10,2) DEFAULT 0,
    current_balance DECIMAL(10,2) DEFAULT 0,
    auto_recharge_enabled BOOLEAN DEFAULT false,
    auto_recharge_amount DECIMAL(10,2),
    auto_recharge_threshold DECIMAL(10,2),

    -- Compliance
    tax_exempt BOOLEAN DEFAULT false,
    tax_exempt_certificate VARCHAR(255),
    reseller_certificate VARCHAR(255),

    -- Integration IDs
    hubspot_id VARCHAR(255) UNIQUE,
    netsuite_id VARCHAR(255) UNIQUE,

    -- Metadata
    tags TEXT[],
    custom_fields JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounts_status ON accounts.accounts(status);
CREATE INDEX idx_accounts_type ON accounts.accounts(type);
CREATE INDEX idx_accounts_hubspot_id ON accounts.accounts(hubspot_id);

-- Account users association
CREATE TABLE accounts.account_users (
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'USER', 'BILLING', 'READONLY')),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (account_id, user_id)
);

-- ============================================
-- TRUNKS SCHEMA - SIP Trunk Configuration
-- ============================================

-- SIP Trunks
CREATE TABLE trunks.trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    trunk_name VARCHAR(255) NOT NULL,
    trunk_type VARCHAR(50) NOT NULL CHECK (trunk_type IN ('INBOUND', 'OUTBOUND', 'BIDIRECTIONAL')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TESTING', 'PROVISIONING')),

    -- Authentication
    auth_type VARCHAR(50) CHECK (auth_type IN ('IP_ACL', 'DIGEST', 'BOTH', 'NONE')),
    username VARCHAR(100),
    password_hash VARCHAR(255),
    tech_prefix VARCHAR(20),

    -- Configuration
    machine_id INTEGER, -- Routing partition/machine
    max_concurrent_calls INTEGER DEFAULT 100,
    calls_per_second_limit INTEGER DEFAULT 10,

    -- Codec support
    codecs TEXT[] DEFAULT ARRAY['PCMU', 'PCMA', 'G729'],
    dtmf_mode VARCHAR(20) DEFAULT 'RFC2833',

    -- Media handling
    rtp_proxy VARCHAR(50) DEFAULT 'ALWAYS',
    transcoding_enabled BOOLEAN DEFAULT false,
    recording_enabled BOOLEAN DEFAULT false,

    -- Routing
    outbound_caller_id VARCHAR(20),
    emergency_caller_id VARCHAR(20),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_registration TIMESTAMPTZ,
    UNIQUE(account_id, trunk_name)
);

CREATE INDEX idx_trunks_account_id ON trunks.trunks(account_id);
CREATE INDEX idx_trunks_status ON trunks.trunks(status);
CREATE INDEX idx_trunks_machine_id ON trunks.trunks(machine_id);

-- IP ACL for trunk authentication
CREATE TABLE trunks.ip_acl (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trunk_id UUID REFERENCES trunks.trunks(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    subnet_mask INTEGER DEFAULT 32,
    description VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trunk_id, ip_address)
);

-- Dialstrings for trunks (vendor trunks)
CREATE TABLE trunks.dialstrings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trunk_id UUID REFERENCES trunks.trunks(id) ON DELETE CASCADE,
    priority INTEGER DEFAULT 1,
    dialstring VARCHAR(500) NOT NULL, -- e.g., "sip:+${number}@gateway.provider.com:5060"
    weight INTEGER DEFAULT 100, -- For load balancing
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NUMBERS SCHEMA - DID Management
-- ============================================

-- DID Inventory
CREATE TABLE numbers.dids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number VARCHAR(20) UNIQUE NOT NULL, -- E.164 format
    account_id UUID REFERENCES accounts.accounts(id),
    trunk_id UUID REFERENCES trunks.trunks(id),

    -- Number details
    country_code VARCHAR(3) DEFAULT '1',
    npa VARCHAR(3), -- Area code
    nxx VARCHAR(3), -- Exchange
    line VARCHAR(4), -- Line number

    -- Classification
    number_type VARCHAR(50) CHECK (number_type IN ('LOCAL', 'TOLLFREE', 'MOBILE', 'INTERNATIONAL')),

    -- Routing
    forward_to VARCHAR(255), -- Where to route calls
    failover_to VARCHAR(255),

    -- Features
    sms_enabled BOOLEAN DEFAULT false,
    mms_enabled BOOLEAN DEFAULT false,
    fax_enabled BOOLEAN DEFAULT false,
    e911_enabled BOOLEAN DEFAULT false,
    cnam_enabled BOOLEAN DEFAULT false,

    -- E911 Information
    e911_name VARCHAR(255),
    e911_address_line1 VARCHAR(255),
    e911_address_line2 VARCHAR(255),
    e911_city VARCHAR(100),
    e911_state VARCHAR(2),
    e911_postal_code VARCHAR(10),

    -- CNAM
    cnam_name VARCHAR(15), -- Max 15 chars for CNAM

    -- Status
    status VARCHAR(50) CHECK (status IN ('AVAILABLE', 'RESERVED', 'ACTIVE', 'PORTING', 'RELEASED')),
    reserved_until TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,

    -- Porting
    port_in_date DATE,
    losing_carrier VARCHAR(255),
    port_in_status VARCHAR(50),

    -- Metadata
    monthly_cost DECIMAL(10,2) DEFAULT 0,
    per_minute_cost DECIMAL(10,4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dids_account_id ON numbers.dids(account_id);
CREATE INDEX idx_dids_trunk_id ON numbers.dids(trunk_id);
CREATE INDEX idx_dids_status ON numbers.dids(status);
CREATE INDEX idx_dids_number_type ON numbers.dids(number_type);
CREATE INDEX idx_dids_npa_nxx ON numbers.dids(npa, nxx);

-- ============================================
-- ROUTING SCHEMA - LCR and Rate Tables
-- ============================================

-- Providers (Vendors)
CREATE TABLE routing.providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(255) UNIQUE NOT NULL,
    provider_type VARCHAR(50) CHECK (provider_type IN ('LRN', 'OCNLATA', 'DNIS', 'TOLLFREE', 'INTERNATIONAL')),
    status VARCHAR(50) CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TESTING')),

    -- Jurisdiction
    jurisdiction_status VARCHAR(50) CHECK (jurisdiction_status IN ('ENHANCED', 'NONENHANCED', 'DIALER', 'UNKNOWN')),
    ij_policy VARCHAR(50) CHECK (ij_policy IN ('INTERSTATE', 'INTRASTATE', 'POI', 'MIXED')),
    poi_state VARCHAR(2), -- For POI policy

    -- Configuration
    dialstring_template VARCHAR(500), -- Template for generating dialstrings
    max_channels INTEGER,
    current_channels INTEGER DEFAULT 0,

    -- Quality metrics
    target_asr DECIMAL(5,2) DEFAULT 40.00, -- Target Answer-Seizure Ratio
    target_acd DECIMAL(5,2) DEFAULT 180.00, -- Target Average Call Duration (seconds)

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rate tables
CREATE TABLE routing.rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID REFERENCES routing.providers(id) ON DELETE CASCADE,

    -- Matching criteria
    prefix VARCHAR(20) NOT NULL, -- Number prefix for matching
    zone VARCHAR(50) NOT NULL, -- INTERSTATE, INTRASTATE, LOCAL, INTL, TOLLFREE

    -- Rates
    rate DECIMAL(10,7) NOT NULL, -- Rate per minute
    connection_fee DECIMAL(10,4) DEFAULT 0,

    -- Billing increments
    initial_increment INTEGER DEFAULT 6, -- First billing increment (seconds)
    subsequent_increment INTEGER DEFAULT 6, -- Subsequent increments

    -- Validity
    effective_date DATE NOT NULL,
    expiration_date DATE,

    -- Priority
    priority INTEGER DEFAULT 100, -- Higher = preferred

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(provider_id, prefix, zone, effective_date)
);

CREATE INDEX idx_rates_prefix ON routing.rates(prefix);
CREATE INDEX idx_rates_zone ON routing.rates(zone);
CREATE INDEX idx_rates_effective ON routing.rates(effective_date, expiration_date);

-- Rate overrides (customer-specific rates)
CREATE TABLE routing.rate_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Override type
    override_type VARCHAR(50) CHECK (override_type IN ('STATIC', 'NPANXX', 'OCN_LATA', 'PREFIX', 'CIC')),

    -- Matching pattern
    pattern VARCHAR(255) NOT NULL, -- The pattern to match

    -- Override rates
    rate DECIMAL(10,7) NOT NULL,
    our_cost DECIMAL(10,7), -- What we pay the provider

    -- Max rate ceiling
    max_rate DECIMAL(10,7),

    -- Billing
    min_duration INTEGER DEFAULT 6,
    increment INTEGER DEFAULT 6,

    -- Status
    is_active BOOLEAN DEFAULT true,
    effective_date DATE NOT NULL,
    expiration_date DATE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, override_type, pattern, effective_date)
);

-- Provider exclusions (customer blocks specific providers)
CREATE TABLE routing.exclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES routing.providers(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    PRIMARY KEY (account_id, provider_id)
);

-- Routing machines/partitions
CREATE TABLE routing.machines (
    id SERIAL PRIMARY KEY,
    machine_name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BILLING SCHEMA - Invoicing and Payments
-- ============================================

-- Invoices
CREATE TABLE billing.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Billing period
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,

    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) NOT NULL,

    -- Status
    status VARCHAR(50) CHECK (status IN ('DRAFT', 'SENT', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED')),

    -- Dates
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    paid_date DATE,

    -- Integration
    netsuite_id VARCHAR(255) UNIQUE,
    hubspot_deal_id VARCHAR(255),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoices_account_id ON billing.invoices(account_id);
CREATE INDEX idx_invoices_status ON billing.invoices(status);
CREATE INDEX idx_invoices_due_date ON billing.invoices(due_date);

-- Invoice line items
CREATE TABLE billing.invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES billing.invoices(id) ON DELETE CASCADE,

    -- Item details (see PRODUCT_CATALOG.md for full list)
    item_type VARCHAR(50) NOT NULL, -- VOICE_TERM_*, DID_*_USAGE, SMS_*, API_*_LOOKUP, etc.
    description TEXT NOT NULL,

    -- Quantity and rates
    quantity DECIMAL(10,4) NOT NULL,
    unit_price DECIMAL(10,7) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb, -- Store zone, jurisdiction, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE billing.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,

    -- Payment details
    payment_method VARCHAR(50) CHECK (payment_method IN ('CREDIT_CARD', 'ACH', 'CHECK', 'WIRE', 'CREDIT')),
    amount DECIMAL(10,2) NOT NULL,

    -- Status
    status VARCHAR(50) CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED')),

    -- Processing
    processor VARCHAR(50), -- AUTHORIZE_NET, WELLS_FARGO, etc.
    processor_transaction_id VARCHAR(255),
    processor_response JSONB,

    -- Dates
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,

    -- Metadata
    notes TEXT,
    created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_payments_account_id ON billing.payments(account_id);
CREATE INDEX idx_payments_status ON billing.payments(status);

-- ============================================
-- AUDIT SCHEMA - Compliance and Logging
-- ============================================

-- Audit log for all changes
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(255) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_log_table ON audit.audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit.audit_log(changed_by);
CREATE INDEX idx_audit_log_timestamp ON audit.audit_log(changed_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts.accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trunks_updated_at BEFORE UPDATE ON trunks.trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dids_updated_at BEFORE UPDATE ON numbers.dids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert default roles
INSERT INTO auth.roles (name, description, permissions) VALUES
    ('SUPER_ADMIN', 'Full system access', '["*"]'::jsonb),
    ('ACCOUNT_ADMIN', 'Full account access', '["account:*"]'::jsonb),
    ('BILLING_ADMIN', 'Billing and payment access', '["billing:*"]'::jsonb),
    ('SUPPORT_AGENT', 'Customer support access', '["read:*", "trunk:view", "number:view"]'::jsonb),
    ('READ_ONLY', 'Read only access', '["read:*"]'::jsonb);

-- Insert default machines/partitions
INSERT INTO routing.machines (machine_name, description) VALUES
    ('DEFAULT', 'Default routing partition'),
    ('PREMIUM', 'Premium quality routes'),
    ('ECONOMY', 'Cost-optimized routes'),
    ('INTERNATIONAL', 'International traffic partition');

-- ============================================
-- GRANTS (for application user)
-- ============================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA auth, accounts, billing, trunks, numbers, routing, audit TO warp_app;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA accounts TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA trunks TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA numbers TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA routing TO warp_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA audit TO warp_app;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA routing TO warp_app;