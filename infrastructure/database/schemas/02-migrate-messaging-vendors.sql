-- Migration: Unify SMS vendor tables
-- Drop the JSONB-based messaging.vendors table and replace with go-smpp compatible structure

-- Drop the table we just created (it's empty anyway)
DROP TABLE IF EXISTS messaging.vendors CASCADE;

-- Recreate messaging.vendors with go-smpp compatible structure
CREATE TABLE messaging.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identification
    provider_type VARCHAR(50) NOT NULL DEFAULT 'smpp',
    instance_name VARCHAR(100) UNIQUE NOT NULL,  -- Used as vendor key
    display_name VARCHAR(200),

    -- SMPP Connection details (explicit columns for go-smpp)
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 2775,
    use_tls BOOLEAN DEFAULT FALSE,
    bind_type VARCHAR(20) DEFAULT 'transceiver',  -- transceiver, transmitter, receiver

    -- SMPP Credentials
    username VARCHAR(100) NOT NULL,  -- SMPP system_id
    password VARCHAR(255) NOT NULL,  -- SMPP password
    system_type VARCHAR(20) DEFAULT 'smpp',  -- SMPP system_type

    -- Capacity and routing
    throughput INTEGER DEFAULT 100,  -- messages per second
    priority INTEGER DEFAULT 0,  -- Lower = higher priority
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Rate information
    sms_rate DECIMAL(10,6),
    mms_rate DECIMAL(10,6),

    -- Health monitoring
    health_status VARCHAR(20) DEFAULT 'unknown',
    last_health_check TIMESTAMPTZ,

    -- Capabilities (for future extensibility)
    supports_sms BOOLEAN DEFAULT TRUE,
    supports_mms BOOLEAN DEFAULT FALSE,
    supports_unicode BOOLEAN DEFAULT TRUE,
    max_message_length INTEGER DEFAULT 160,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_messaging_vendors_active ON messaging.vendors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_messaging_vendors_type ON messaging.vendors(provider_type);
CREATE INDEX idx_messaging_vendors_priority ON messaging.vendors(priority, is_active);

-- Migrate data from vendor_mgmt.service_providers to messaging.vendors
INSERT INTO messaging.vendors (
    id, provider_type, instance_name, display_name,
    host, port, use_tls, bind_type,
    username, password, system_type,
    throughput, priority, is_primary, is_active,
    health_status, last_health_check,
    created_at, updated_at
)
SELECT
    id, provider_type, instance_name, display_name,
    host, port, use_tls, bind_type,
    username, password, system_type,
    throughput, priority, is_primary, is_active,
    health_status, last_health_check,
    created_at, updated_at
FROM vendor_mgmt.service_providers
WHERE provider_type = 'smpp';

-- Verify migration
SELECT
    instance_name,
    host,
    port,
    use_tls,
    username,
    is_active,
    created_at
FROM messaging.vendors;

-- Comment for future reference
COMMENT ON TABLE messaging.vendors IS 'Unified SMS/SMPP vendor table used by both go-smpp gateway and API gateway';
COMMENT ON COLUMN messaging.vendors.instance_name IS 'Unique vendor identifier used by go-smpp (e.g., Sinch_Atlanta)';
COMMENT ON COLUMN messaging.vendors.system_type IS 'SMPP system_type parameter (e.g., "cp" for Sinch)';
