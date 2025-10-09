-- Migration: Create service_providers table for vendor management
-- This table stores SMPP vendor configurations and other third-party service providers

CREATE TABLE IF NOT EXISTS vendor_mgmt.service_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type VARCHAR(50) NOT NULL, -- 'smpp', 'telique', 'tcr', 'netsuite', etc.
    instance_name VARCHAR(100) NOT NULL UNIQUE, -- User-defined name (e.g., "Sinch Chicago")
    display_name VARCHAR(200),
    module_version VARCHAR(20),

    -- Connection details (SMPP-specific stored in settings JSONB)
    host VARCHAR(255),
    port INTEGER,
    use_tls BOOLEAN DEFAULT false,
    bind_type VARCHAR(20), -- transceiver, transmitter, receiver

    -- Configuration
    settings JSONB, -- Provider-specific settings
    credentials JSONB, -- Encrypted fields (if needed, mostly NULL for IP-based)
    capabilities TEXT[], -- Array of capabilities

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    throughput INTEGER DEFAULT 100, -- Messages per second
    health_status VARCHAR(20) DEFAULT 'unknown', -- healthy, degraded, unhealthy
    last_health_check TIMESTAMP,

    -- Audit
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),

    CONSTRAINT unique_provider_instance UNIQUE(provider_type, instance_name)
);

-- Create index for fast lookups
CREATE INDEX idx_service_providers_type ON vendor_mgmt.service_providers(provider_type);
CREATE INDEX idx_service_providers_active ON vendor_mgmt.service_providers(is_active) WHERE is_active = true;
CREATE INDEX idx_service_providers_primary ON vendor_mgmt.service_providers(is_primary) WHERE is_primary = true;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION vendor_mgmt.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_providers_updated_at
    BEFORE UPDATE ON vendor_mgmt.service_providers
    FOR EACH ROW
    EXECUTE FUNCTION vendor_mgmt.update_updated_at_column();

-- Comments
COMMENT ON TABLE vendor_mgmt.service_providers IS 'Stores configurations for all third-party service providers (SMPP vendors, APIs, etc.)';
COMMENT ON COLUMN vendor_mgmt.service_providers.provider_type IS 'Type of provider: smpp, telique, tcr, netsuite, etc.';
COMMENT ON COLUMN vendor_mgmt.service_providers.instance_name IS 'Unique user-defined name for this provider instance';
COMMENT ON COLUMN vendor_mgmt.service_providers.bind_type IS 'SMPP bind type: transceiver (bidirectional), transmitter (MT only), receiver (MO only)';
COMMENT ON COLUMN vendor_mgmt.service_providers.throughput IS 'Maximum messages per second for SMPP vendors';
