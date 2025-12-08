-- Number Inventory Management Schema (JIT Model)
-- Date: 2025-12-08
-- Purpose: Create tables for customer-assigned numbers with JIT provisioning
--
-- Key Design Decisions:
--   - JIT Provisioning: No local pool of unassigned numbers
--   - All searches pass through to ringer-soa in real-time
--   - Only customer-assigned numbers stored locally
--   - Uses customer_id -> accounts.customers (modern JSONB design)
--   - Deprecates: numbers.inventory, numbers.dids, accounts.accounts

-- Ensure numbers schema exists
CREATE SCHEMA IF NOT EXISTS numbers;

-- ============================================================================
-- numbers.assigned_numbers - Primary table for customer-assigned telephone numbers
-- ============================================================================
-- This replaces the legacy numbers.dids table with a clean design using customer_id

CREATE TABLE IF NOT EXISTS numbers.assigned_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE RESTRICT,
    number VARCHAR(20) UNIQUE NOT NULL,  -- E.164 format (e.g., +13035551234)

    -- SOA tracking (for sync with ringer-soa upstream)
    soa_number_id VARCHAR(100),          -- SOA's internal ID for this TN
    soa_last_synced TIMESTAMPTZ,         -- Last successful sync timestamp
    soa_sync_status VARCHAR(20) DEFAULT 'SYNCED' CHECK (soa_sync_status IN ('SYNCED', 'PENDING', 'FAILED')),

    -- Number classification (populated from SOA on assignment)
    number_type VARCHAR(20) DEFAULT 'DID' CHECK (number_type IN ('DID', 'TOLL_FREE')),
    npa VARCHAR(3),                      -- Area code (e.g., 303)
    nxx VARCHAR(3),                      -- Exchange (e.g., 555)
    rate_center VARCHAR(100),            -- Rate center name
    state VARCHAR(2),                    -- US state code

    -- Features enabled
    voice_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    mms_enabled BOOLEAN DEFAULT FALSE,
    fax_enabled BOOLEAN DEFAULT FALSE,

    -- Voice routing configuration
    trunk_id UUID,                       -- FK to voice.trunks (when created)
    voice_destination VARCHAR(500),      -- Primary destination (SIP URI, phone number)
    voice_failover_destination VARCHAR(500), -- Failover destination
    voice_routing_type VARCHAR(50),      -- SIP_URI, FORWARD, IVR, QUEUE

    -- Messaging/TCR configuration
    campaign_id UUID,                    -- FK to tcr.campaigns
    brand_id UUID,                       -- FK to tcr.brands
    tcr_status VARCHAR(50),              -- TCR registration status

    -- E911 configuration
    e911_enabled BOOLEAN DEFAULT FALSE,
    e911_address_id UUID,                -- FK to numbers.e911_addresses

    -- CNAM (Caller ID Name)
    cnam_enabled BOOLEAN DEFAULT FALSE,
    cnam_display_name VARCHAR(15),       -- Max 15 chars per CNAM spec

    -- Display/User-facing
    friendly_name VARCHAR(255),          -- User-assigned name
    description TEXT,                    -- User notes

    -- Status & Lifecycle
    active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    released_at TIMESTAMPTZ,             -- When customer released the number
    release_reason VARCHAR(100),         -- Why it was released

    -- Billing
    monthly_charge DECIMAL(10,2),
    billing_start_date DATE DEFAULT CURRENT_DATE,

    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,                     -- User who assigned the number
    updated_by UUID                      -- User who last modified
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_customer ON numbers.assigned_numbers(customer_id);
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_number ON numbers.assigned_numbers(number);
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_trunk ON numbers.assigned_numbers(trunk_id) WHERE trunk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_campaign ON numbers.assigned_numbers(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_soa_sync ON numbers.assigned_numbers(soa_sync_status) WHERE soa_sync_status != 'SYNCED';
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_active ON numbers.assigned_numbers(customer_id, active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_released ON numbers.assigned_numbers(released_at DESC) WHERE released_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_npa ON numbers.assigned_numbers(npa, nxx);
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_state ON numbers.assigned_numbers(state);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION numbers.update_assigned_numbers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assigned_numbers_updated_at ON numbers.assigned_numbers;
CREATE TRIGGER trg_assigned_numbers_updated_at
    BEFORE UPDATE ON numbers.assigned_numbers
    FOR EACH ROW
    EXECUTE FUNCTION numbers.update_assigned_numbers_timestamp();

-- ============================================================================
-- numbers.audit_log - Compliance and audit tracking for number operations
-- ============================================================================

CREATE TABLE IF NOT EXISTS numbers.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Action details
    action VARCHAR(50) NOT NULL,         -- ASSIGN, RELEASE, CONFIGURE, PORT_CREATE, etc.
    numbers JSONB NOT NULL,              -- Array of affected numbers ["3035551234", "7205551234"]

    -- Actor information
    user_id UUID NOT NULL REFERENCES auth.users(id),
    user_email VARCHAR(255) NOT NULL,

    -- Customer context
    customer_id UUID REFERENCES accounts.customers(id),
    acting_on_behalf_of UUID REFERENCES accounts.customers(id), -- For admin "on behalf of" operations

    -- Request details
    request_path VARCHAR(500),
    request_body JSONB,                  -- Sanitized request (no passwords/secrets)

    -- Result
    success BOOLEAN NOT NULL,
    error_message TEXT,

    -- Client information
    ip_address INET,
    user_agent TEXT,

    -- Timestamp (UTC)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_customer ON numbers.audit_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON numbers.audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON numbers.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON numbers.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_numbers ON numbers.audit_log USING gin(numbers);

-- ============================================================================
-- Update existing tables to add customer_id (for gradual migration)
-- ============================================================================

-- Add customer_id to port_requests if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'numbers'
        AND table_name = 'port_requests'
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE numbers.port_requests
            ADD COLUMN customer_id UUID REFERENCES accounts.customers(id);
        CREATE INDEX IF NOT EXISTS idx_port_requests_customer ON numbers.port_requests(customer_id);
    END IF;
END $$;

-- Add customer_id to usage_history if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'numbers'
        AND table_name = 'usage_history'
        AND column_name = 'customer_id'
    ) THEN
        ALTER TABLE numbers.usage_history
            ADD COLUMN customer_id UUID REFERENCES accounts.customers(id);
        CREATE INDEX IF NOT EXISTS idx_usage_history_customer ON numbers.usage_history(customer_id);
    END IF;
END $$;

-- ============================================================================
-- Permission metadata for Number Inventory APIs
-- ============================================================================

INSERT INTO auth.permission_metadata (resource_path, category, display_name, description, display_order)
VALUES
    -- Customer self-service (numbers)
    ('/api/v1/numbers/inventory', 'Numbers', 'View Inventory', 'View assigned telephone numbers', 300),
    ('/api/v1/numbers/search', 'Numbers', 'Search Numbers', 'Search available numbers from pool', 301),
    ('/api/v1/numbers/reserve', 'Numbers', 'Reserve Numbers', 'Temporarily reserve numbers', 302),
    ('/api/v1/numbers/purchase', 'Numbers', 'Purchase Numbers', 'Purchase/assign numbers to account', 303),
    ('/api/v1/numbers/*', 'Numbers', 'Configure Numbers', 'Configure number routing and features', 304),
    ('/api/v1/numbers/release', 'Numbers', 'Release Numbers', 'Release numbers back to pool', 305),

    -- Admin operations
    ('/api/v1/admin/numbers', 'Numbers (Admin)', 'Admin Number Management', 'Manage numbers across all customers', 310),
    ('/api/v1/admin/numbers/*', 'Numbers (Admin)', 'Admin Number Operations', 'Full admin number operations', 311),

    -- Porting
    ('/api/v1/porting/projects', 'Porting', 'View Port Projects', 'View porting projects', 320),
    ('/api/v1/porting/projects/*', 'Porting', 'Manage Port Projects', 'Create and manage porting projects', 321),
    ('/api/v1/porting/submit', 'Porting', 'Submit Ports', 'Submit port requests to carriers', 322)
ON CONFLICT (resource_path) DO UPDATE
SET category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- ============================================================================
-- Grant permissions to user types
-- ============================================================================

-- SuperAdmin already has wildcard '*' permission

-- Admin: Full access to all number operations
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/numbers/inventory'),
    ('/api/v1/numbers/search'),
    ('/api/v1/numbers/reserve'),
    ('/api/v1/numbers/purchase'),
    ('/api/v1/numbers/*'),
    ('/api/v1/numbers/release'),
    ('/api/v1/admin/numbers'),
    ('/api/v1/admin/numbers/*'),
    ('/api/v1/porting/projects'),
    ('/api/v1/porting/projects/*'),
    ('/api/v1/porting/submit')
) AS perm(resource)
WHERE ut.type_name = 'admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Customer Admin: Can search, reserve, purchase, configure (no release, no admin)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/numbers/inventory'),
    ('/api/v1/numbers/search'),
    ('/api/v1/numbers/reserve'),
    ('/api/v1/numbers/purchase'),
    ('/api/v1/numbers/*'),
    ('/api/v1/porting/projects'),
    ('/api/v1/porting/projects/*')
) AS perm(resource)
WHERE ut.type_name = 'customer_admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Developer: View and configure only (no purchasing)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/numbers/inventory'),
    ('/api/v1/numbers/*')
) AS perm(resource)
WHERE ut.type_name = 'developer'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Billing: View inventory only
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/numbers/inventory')
) AS perm(resource)
WHERE ut.type_name = 'billing'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Viewer: View inventory only
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/numbers/inventory'),
    ('/api/v1/porting/projects')
) AS perm(resource)
WHERE ut.type_name = 'viewer'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE numbers.assigned_numbers IS 'Customer-assigned telephone numbers (JIT model - no local unassigned pool)';
COMMENT ON TABLE numbers.audit_log IS 'Audit trail for all number operations (assignment, release, configuration)';

COMMENT ON COLUMN numbers.assigned_numbers.customer_id IS 'FK to accounts.customers - the billing entity that owns this number';
COMMENT ON COLUMN numbers.assigned_numbers.soa_number_id IS 'Ringer-SOA internal ID for upstream sync';
COMMENT ON COLUMN numbers.assigned_numbers.soa_sync_status IS 'Sync status with upstream SOA: SYNCED, PENDING, FAILED';
COMMENT ON COLUMN numbers.assigned_numbers.released_at IS 'Timestamp when customer released number (for billing proration)';

-- ============================================================================
-- Summary
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== Number Inventory Migration Complete ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables created:';
    RAISE NOTICE '  - numbers.assigned_numbers (primary table for customer numbers)';
    RAISE NOTICE '  - numbers.audit_log (compliance tracking)';
    RAISE NOTICE '';
    RAISE NOTICE 'Permissions added for:';
    RAISE NOTICE '  - /api/v1/numbers/* (customer self-service)';
    RAISE NOTICE '  - /api/v1/admin/numbers/* (admin operations)';
    RAISE NOTICE '  - /api/v1/porting/* (porting workflow)';
    RAISE NOTICE '';
    RAISE NOTICE 'JIT Model Notes:';
    RAISE NOTICE '  - numbers.inventory is NOT used (available numbers come from SOA)';
    RAISE NOTICE '  - Only assigned numbers are stored locally';
    RAISE NOTICE '  - Uses customer_id -> accounts.customers (modern design)';
    RAISE NOTICE '';
END $$;
