-- TCR (The Campaign Registry) 10DLC Integration Schema
-- Date: 2025-11-26
-- Purpose: Complete database schema for TCR brand and campaign management
-- See: docs/integrations/TCR_10DLC_INTEGRATION.md

-- ============================================================================
-- BRANDS - 10DLC Brand Registration
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging.brands_10dlc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Customer association
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- TCR brand info
    tcr_brand_id VARCHAR(100) UNIQUE,  -- TCR brand ID (e.g., "B1A2C3D4")

    -- Company info
    display_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),  -- May differ from legal_name
    tax_id VARCHAR(50),  -- US: 9-digit EIN

    -- Entity classification
    entity_type VARCHAR(50) NOT NULL,  -- PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT, GOVERNMENT, SOLE_PROPRIETOR
    identity_status VARCHAR(50),  -- SELF_DECLARED, UNVERIFIED, VERIFIED, VETTED_VERIFIED

    -- Brand details
    vertical VARCHAR(100),  -- Industry vertical
    website VARCHAR(500),

    -- Address
    country VARCHAR(2) DEFAULT 'US',
    state VARCHAR(2),
    city VARCHAR(100),
    street VARCHAR(255),
    postal_code VARCHAR(20),

    -- Public company details (for automatic verification)
    stock_exchange VARCHAR(50),  -- NASDAQ, NYSE, etc.
    stock_symbol VARCHAR(20),

    -- Alternative business ID
    alt_business_id VARCHAR(100),  -- DUNS number, etc.
    alt_business_id_type VARCHAR(50),  -- 'DUNS', etc.

    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),

    -- Business contact (optional, may differ from primary)
    business_contact_first_name VARCHAR(100),
    business_contact_last_name VARCHAR(100),
    business_contact_email VARCHAR(255),
    business_contact_phone VARCHAR(50),

    -- Status and scores
    status VARCHAR(50),  -- PENDING, VERIFIED, UNVERIFIED, VETTED, SUSPENDED
    trust_score INTEGER,  -- TCR trust score (0-100)

    -- Vetting information
    vetting_status VARCHAR(50),  -- NONE, PENDING, APPROVED, REJECTED
    vetting_provider VARCHAR(50),  -- AEGIS, WMC Global, etc.
    vetting_class VARCHAR(50),  -- STANDARD, POLITICAL
    vetting_date DATE,
    vetting_token VARCHAR(500),  -- Token from vetting provider

    -- TCR metadata
    brand_relationship VARCHAR(50) DEFAULT 'DIRECT_CUSTOMER',  -- DIRECT_CUSTOMER, RESELLER
    reference_id VARCHAR(100),  -- Customer's internal reference
    ip_address INET,  -- Registration IP address

    -- TCR timestamps
    tcr_created_at TIMESTAMPTZ,
    tcr_updated_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brands_10dlc_customer ON messaging.brands_10dlc(customer_id);
CREATE INDEX IF NOT EXISTS idx_brands_10dlc_tcr_id ON messaging.brands_10dlc(tcr_brand_id) WHERE tcr_brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_10dlc_status ON messaging.brands_10dlc(status);
CREATE INDEX IF NOT EXISTS idx_brands_10dlc_reference ON messaging.brands_10dlc(reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_brands_10dlc_entity_type ON messaging.brands_10dlc(entity_type);

COMMENT ON TABLE messaging.brands_10dlc IS 'TCR brand registrations for 10DLC compliance';
COMMENT ON COLUMN messaging.brands_10dlc.tcr_brand_id IS 'Unique brand ID assigned by TCR after registration';
COMMENT ON COLUMN messaging.brands_10dlc.entity_type IS 'Business entity type: PRIVATE_PROFIT, PUBLIC_PROFIT, NON_PROFIT, GOVERNMENT, SOLE_PROPRIETOR';
COMMENT ON COLUMN messaging.brands_10dlc.identity_status IS 'Brand verification status from TCR';
COMMENT ON COLUMN messaging.brands_10dlc.trust_score IS 'TCR-assigned trust score (0-100), affects throughput limits';

-- ============================================================================
-- CAMPAIGNS - 10DLC Campaign Registration
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging.campaigns_10dlc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Associations
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES messaging.brands_10dlc(id) ON DELETE CASCADE,

    -- TCR campaign info
    tcr_campaign_id VARCHAR(100) UNIQUE,  -- TCR campaign ID (e.g., "C1D2E3F4")
    reseller_id VARCHAR(50),  -- WARP reseller ID with TCR

    -- Campaign classification
    use_case VARCHAR(100) NOT NULL,  -- 2FA, ACCOUNT_NOTIFICATION, MARKETING, etc.
    sub_use_cases TEXT[],  -- Array of sub-use cases

    -- Campaign details
    description TEXT NOT NULL,  -- Min 40 chars, explains campaign purpose
    message_flow TEXT NOT NULL,  -- Min 40 chars, explains user journey

    -- Message samples (1-5 required depending on use case)
    sample_messages TEXT[] NOT NULL,  -- Array of sample messages

    -- Subscriber opt-in/opt-out
    subscriber_optin BOOLEAN DEFAULT false,  -- Requires opt-in before sending
    subscriber_optout BOOLEAN DEFAULT true,  -- Must support opt-out
    subscriber_help BOOLEAN DEFAULT true,  -- Must respond to HELP

    optin_keywords VARCHAR(255),  -- Comma-separated: START,YES
    optin_message TEXT,  -- Opt-in confirmation message

    optout_keywords VARCHAR(255) DEFAULT 'STOP,CANCEL,UNSUBSCRIBE',  -- Comma-separated
    optout_message TEXT,  -- Opt-out confirmation message
    stop_message TEXT,  -- Legacy column for opt-out message

    help_keywords VARCHAR(255) DEFAULT 'HELP,INFO',  -- Comma-separated
    help_message TEXT,  -- Help response message

    -- Content characteristics
    embedded_link BOOLEAN DEFAULT false,  -- Messages contain URLs
    embedded_phone BOOLEAN DEFAULT false,  -- Messages contain phone numbers
    number_pool BOOLEAN DEFAULT false,  -- Using phone number pool
    age_gated BOOLEAN DEFAULT false,  -- Age-restricted content (18+)
    direct_lending BOOLEAN DEFAULT false,  -- Loan/lending related

    -- Legal requirements
    privacy_policy_url VARCHAR(500),  -- Required
    terms_url VARCHAR(500),  -- Terms & conditions URL

    -- Renewal settings
    auto_renewal BOOLEAN DEFAULT true,  -- Auto-renew annually
    expiration_date DATE,  -- Campaign expiration
    next_billing_date DATE,  -- Next renewal billing date

    -- Throughput and limits (set by TCR based on brand trust)
    throughput_limit INTEGER,  -- Messages per second
    daily_cap INTEGER,  -- Max messages per day

    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING, ACTIVE, REJECTED, SUSPENDED, EXPIRED

    -- TCR submission tracking
    tcr_submission_date DATE,
    tcr_approval_date DATE,

    -- Compliance scores
    trust_score INTEGER,  -- Campaign trust score

    -- Customer reference
    reference_id VARCHAR(100),  -- Customer's internal reference

    -- TCR timestamps
    tcr_created_at TIMESTAMPTZ,
    tcr_updated_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id),

    -- Constraints
    CONSTRAINT chk_description_length CHECK (char_length(description) >= 40),
    CONSTRAINT chk_message_flow_length CHECK (char_length(message_flow) >= 40),
    CONSTRAINT chk_sample_messages_count CHECK (array_length(sample_messages, 1) >= 1 AND array_length(sample_messages, 1) <= 5),
    CONSTRAINT chk_status_valid CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'EXPIRED'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_customer ON messaging.campaigns_10dlc(customer_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_brand ON messaging.campaigns_10dlc(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_tcr_id ON messaging.campaigns_10dlc(tcr_campaign_id) WHERE tcr_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_status ON messaging.campaigns_10dlc(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_use_case ON messaging.campaigns_10dlc(use_case);
CREATE INDEX IF NOT EXISTS idx_campaigns_10dlc_reference ON messaging.campaigns_10dlc(reference_id) WHERE reference_id IS NOT NULL;

COMMENT ON TABLE messaging.campaigns_10dlc IS 'TCR campaign registrations for specific messaging use cases';
COMMENT ON COLUMN messaging.campaigns_10dlc.use_case IS 'Primary campaign use case (2FA, MARKETING, etc.)';
COMMENT ON COLUMN messaging.campaigns_10dlc.throughput_limit IS 'Messages per second allowed by TCR based on brand trust';
COMMENT ON COLUMN messaging.campaigns_10dlc.daily_cap IS 'Maximum messages per day based on brand verification level';

-- ============================================================================
-- CAMPAIGN PHONE NUMBERS - Junction Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging.campaign_phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Associations
    campaign_id UUID NOT NULL REFERENCES messaging.campaigns_10dlc(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,  -- E.164 format: +14155551234

    -- Assignment tracking
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id),
    removed_at TIMESTAMPTZ,
    removed_by UUID REFERENCES auth.users(id),

    -- Computed active status
    is_active BOOLEAN GENERATED ALWAYS AS (removed_at IS NULL) STORED,

    -- Constraints: Each number can only be in one active campaign
    CONSTRAINT uq_campaign_phone_numbers UNIQUE(campaign_id, phone_number, removed_at),
    EXCLUDE USING btree (phone_number WITH =) WHERE (is_active = true)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_campaign ON messaging.campaign_phone_numbers(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_phone ON messaging.campaign_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaign_phone_numbers_active ON messaging.campaign_phone_numbers(is_active) WHERE is_active = true;

COMMENT ON TABLE messaging.campaign_phone_numbers IS 'Junction table mapping phone numbers to 10DLC campaigns';
COMMENT ON COLUMN messaging.campaign_phone_numbers.is_active IS 'Computed: TRUE if removed_at IS NULL';

-- ============================================================================
-- MNO STATUS TRACKING - Per-Carrier Approval Status
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging.campaign_mno_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Campaign association
    campaign_id UUID NOT NULL REFERENCES messaging.campaigns_10dlc(id) ON DELETE CASCADE,

    -- MNO (Mobile Network Operator) identification
    mno_id VARCHAR(20) NOT NULL,  -- TCR MNO ID (e.g., "10017" for T-Mobile)
    mno_name VARCHAR(100) NOT NULL,  -- Human-readable: "T-Mobile", "AT&T", "Verizon"

    -- Status per carrier
    status VARCHAR(50) NOT NULL,  -- REGISTERED, REVIEW, REJECTED, SUSPENDED
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Rejection details
    rejection_reason TEXT,
    rejection_code VARCHAR(50),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT uq_campaign_mno UNIQUE(campaign_id, mno_id),
    CONSTRAINT chk_mno_status_valid CHECK (status IN ('REGISTERED', 'REVIEW', 'REJECTED', 'SUSPENDED'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_mno_status_campaign ON messaging.campaign_mno_status(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_mno_status_mno ON messaging.campaign_mno_status(mno_id);
CREATE INDEX IF NOT EXISTS idx_campaign_mno_status_status ON messaging.campaign_mno_status(status);

COMMENT ON TABLE messaging.campaign_mno_status IS 'Per-carrier approval status for campaigns (T-Mobile, AT&T, Verizon)';
COMMENT ON COLUMN messaging.campaign_mno_status.mno_id IS 'TCR MNO identifier: 10017=T-Mobile, 10035=AT&T, 10036=Verizon';
COMMENT ON COLUMN messaging.campaign_mno_status.status IS 'Carrier-specific approval status';

-- ============================================================================
-- AUDIT LOG - Campaign and Brand Changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS messaging.campaign_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entity identification
    entity_type VARCHAR(50) NOT NULL,  -- 'brand' or 'campaign'
    entity_id UUID NOT NULL,  -- brand_id or campaign_id

    -- Action tracking
    action VARCHAR(50) NOT NULL,  -- CREATED, UPDATED, SUBMITTED, APPROVED, REJECTED, SUSPENDED, etc.

    -- Change details
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- JSONB for flexible change tracking
    old_values JSONB,
    new_values JSONB,

    -- Optional notes
    notes TEXT,

    -- Constraints
    CONSTRAINT chk_entity_type_valid CHECK (entity_type IN ('brand', 'campaign'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_entity ON messaging.campaign_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON messaging.campaign_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON messaging.campaign_audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON messaging.campaign_audit_log(changed_by) WHERE changed_by IS NOT NULL;

COMMENT ON TABLE messaging.campaign_audit_log IS 'Comprehensive audit trail for all brand and campaign changes';

-- ============================================================================
-- UPDATE EXISTING CUSTOMER CONFIG - Add TCR References
-- ============================================================================

-- Add TCR campaign reference to existing customer config (if not already exists)
DO $$
BEGIN
    -- Check if columns already exist before adding
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messaging'
        AND table_name = 'customer_config'
        AND column_name = 'default_brand_id'
    ) THEN
        ALTER TABLE messaging.customer_config
            ADD COLUMN default_brand_id UUID REFERENCES messaging.brands_10dlc(id) ON DELETE SET NULL;
    END IF;

    -- Rename brand_id to tcr_brand_reference if it exists and is just VARCHAR
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messaging'
        AND table_name = 'customer_config'
        AND column_name = 'brand_id'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE messaging.customer_config
            RENAME COLUMN brand_id TO tcr_brand_reference;
    END IF;

    -- Rename default_campaign_id to tcr_campaign_reference if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messaging'
        AND table_name = 'customer_config'
        AND column_name = 'default_campaign_id'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE messaging.customer_config
            RENAME COLUMN default_campaign_id TO tcr_campaign_reference;
    END IF;

    -- Add new FK reference column for campaign
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'messaging'
        AND table_name = 'customer_config'
        AND column_name = 'default_campaign_id_fk'
    ) THEN
        ALTER TABLE messaging.customer_config
            ADD COLUMN default_campaign_id_fk UUID REFERENCES messaging.campaigns_10dlc(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN messaging.customer_config.default_brand_id IS 'FK reference to default brand for this customer';
COMMENT ON COLUMN messaging.customer_config.default_campaign_id_fk IS 'FK reference to default campaign for this customer';

-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- View: Active campaigns with brand and MNO status
CREATE OR REPLACE VIEW messaging.v_campaigns_with_status AS
SELECT
    c.id,
    c.customer_id,
    cust.company_name,
    c.tcr_campaign_id,
    c.use_case,
    c.description,
    c.status AS campaign_status,
    c.throughput_limit,
    c.daily_cap,
    c.created_at,

    -- Brand information
    b.tcr_brand_id,
    b.display_name AS brand_name,
    b.entity_type AS brand_entity_type,
    b.trust_score AS brand_trust_score,
    b.status AS brand_status,

    -- Phone numbers (count)
    (SELECT COUNT(*) FROM messaging.campaign_phone_numbers cpn
     WHERE cpn.campaign_id = c.id AND cpn.is_active = true) AS active_phone_count,

    -- MNO status summary
    (SELECT json_object_agg(mno_name, status)
     FROM messaging.campaign_mno_status cms
     WHERE cms.campaign_id = c.id) AS mno_statuses

FROM messaging.campaigns_10dlc c
JOIN messaging.brands_10dlc b ON c.brand_id = b.id
JOIN accounts.customers cust ON c.customer_id = cust.id;

COMMENT ON VIEW messaging.v_campaigns_with_status IS 'Consolidated view of campaigns with brand info, phone count, and MNO statuses';

-- View: Campaign throughput utilization (requires CDR data)
CREATE OR REPLACE VIEW messaging.v_campaign_utilization AS
SELECT
    c.id AS campaign_id,
    c.tcr_campaign_id,
    c.use_case,
    c.throughput_limit,
    c.daily_cap,

    -- Today's usage (would need to join with MDRs)
    0 AS messages_today,  -- Placeholder, update when MDR integration complete
    0.0 AS throughput_utilization_pct,  -- Placeholder
    0.0 AS daily_cap_utilization_pct  -- Placeholder

FROM messaging.campaigns_10dlc c
WHERE c.status = 'ACTIVE';

COMMENT ON VIEW messaging.v_campaign_utilization IS 'Campaign usage metrics (placeholder for MDR integration)';

-- ============================================================================
-- TRIGGER FUNCTIONS - Auto-Update Timestamps
-- ============================================================================

-- Trigger function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION messaging.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to brands
DROP TRIGGER IF EXISTS trg_brands_10dlc_updated_at ON messaging.brands_10dlc;
CREATE TRIGGER trg_brands_10dlc_updated_at
    BEFORE UPDATE ON messaging.brands_10dlc
    FOR EACH ROW
    EXECUTE FUNCTION messaging.update_updated_at_column();

-- Apply trigger to campaigns
DROP TRIGGER IF EXISTS trg_campaigns_10dlc_updated_at ON messaging.campaigns_10dlc;
CREATE TRIGGER trg_campaigns_10dlc_updated_at
    BEFORE UPDATE ON messaging.campaigns_10dlc
    FOR EACH ROW
    EXECUTE FUNCTION messaging.update_updated_at_column();

-- Apply trigger to MNO status
DROP TRIGGER IF EXISTS trg_campaign_mno_status_updated_at ON messaging.campaign_mno_status;
CREATE TRIGGER trg_campaign_mno_status_updated_at
    BEFORE UPDATE ON messaging.campaign_mno_status
    FOR EACH ROW
    EXECUTE FUNCTION messaging.update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Note: TCR integration requires real API calls for production data
-- This is just sample structure for development/testing

-- Sample brand (not registered with TCR yet)
INSERT INTO messaging.brands_10dlc (
    customer_id,
    display_name,
    legal_name,
    entity_type,
    vertical,
    website,
    country,
    state,
    city,
    street,
    postal_code,
    primary_contact_name,
    primary_contact_email,
    primary_contact_phone,
    status,
    reference_id
)
SELECT
    id,
    'ACME Communications',
    'ACME Communications LLC',
    'PRIVATE_PROFIT',
    'TECHNOLOGY',
    'https://acme.com',
    'US',
    'NY',
    'New York',
    '123 Business Ave',
    '10001',
    'John Smith',
    'john.smith@acme.com',
    '+15550123',
    'PENDING',
    'sample-brand-001'
FROM accounts.customers
WHERE company_name = 'Acme Communications'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed for your auth setup)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA messaging TO warp_api;
GRANT SELECT ON ALL TABLES IN SCHEMA messaging TO warp_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA messaging TO warp_api;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Verification queries (run after migration)
/*
-- Check brand table
SELECT COUNT(*) FROM messaging.brands_10dlc;

-- Check campaign table
SELECT COUNT(*) FROM messaging.campaigns_10dlc;

-- Check campaign-number junction
SELECT COUNT(*) FROM messaging.campaign_phone_numbers;

-- Check MNO status tracking
SELECT COUNT(*) FROM messaging.campaign_mno_status;

-- Check audit log
SELECT COUNT(*) FROM messaging.campaign_audit_log;

-- View consolidated campaign status
SELECT * FROM messaging.v_campaigns_with_status;
*/
