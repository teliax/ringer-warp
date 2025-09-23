-- Vendor Management Schema
-- Handles third-party service providers and their configurations

-- Main vendors table
CREATE TABLE vendor_mgmt.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic info
    vendor_code VARCHAR(50) UNIQUE NOT NULL, -- Internal code
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(50) NOT NULL, -- CARRIER, SMS_PROVIDER, LRN_PROVIDER, etc.
    
    -- Company details
    legal_entity_name VARCHAR(255),
    tax_id VARCHAR(50),
    duns_number VARCHAR(20),
    
    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(50),
    
    technical_contact_name VARCHAR(255),
    technical_contact_email VARCHAR(255),
    technical_contact_phone VARCHAR(50),
    
    -- Billing info
    payment_terms VARCHAR(50), -- NET30, NET60, PREPAID
    billing_currency VARCHAR(3) DEFAULT 'USD',
    credit_limit DECIMAL(12,2),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    onboarding_status VARCHAR(50), -- PENDING, IN_PROGRESS, COMPLETE
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor service configurations (plugin architecture from arch doc)
CREATE TABLE vendor_mgmt.service_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID REFERENCES vendor_mgmt.vendors(id),
    
    provider_type VARCHAR(50) NOT NULL, -- 'telique', 'netsuite', 'hubspot', etc.
    instance_name VARCHAR(100) NOT NULL UNIQUE, -- user-defined name
    display_name VARCHAR(200),
    module_version VARCHAR(20), -- version of the provider module
    
    -- Configuration (sensitive data references Secret Manager)
    credentials JSONB, -- encrypted fields reference Secret Manager
    settings JSONB, -- provider-specific settings
    webhooks JSONB, -- webhook configurations
    capabilities TEXT[], -- array of capabilities this instance provides
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- primary provider for its capability
    priority INTEGER DEFAULT 0, -- for failover/load balancing
    health_status VARCHAR(20) DEFAULT 'unknown', -- healthy, degraded, unhealthy
    last_health_check TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    UNIQUE(provider_type, instance_name)
);

-- Provider health checks
CREATE TABLE vendor_mgmt.provider_health_checks (
    id BIGSERIAL PRIMARY KEY,
    provider_id UUID REFERENCES vendor_mgmt.service_providers(id),
    
    check_time TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB
);

-- Provider usage statistics
CREATE TABLE vendor_mgmt.provider_usage_stats (
    provider_id UUID REFERENCES vendor_mgmt.service_providers(id),
    date DATE,
    
    requests_count BIGINT DEFAULT 0,
    errors_count BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER,
    
    PRIMARY KEY (provider_id, date)
);

-- Carrier-specific table (extends vendors)
CREATE TABLE vendor_mgmt.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID UNIQUE NOT NULL REFERENCES vendor_mgmt.vendors(id),
    
    -- Carrier identifiers
    ocn VARCHAR(4), -- Operating Company Number
    
    -- Network info
    as_number INTEGER, -- BGP AS Number
    
    -- Capabilities
    supports_lrn_dip BOOLEAN DEFAULT TRUE,
    supports_cnam_dip BOOLEAN DEFAULT FALSE,
    supports_sms BOOLEAN DEFAULT FALSE,
    supports_mms BOOLEAN DEFAULT FALSE,
    supports_emergency BOOLEAN DEFAULT TRUE,
    
    -- SIP specific
    requires_registration BOOLEAN DEFAULT FALSE,
    supported_codecs TEXT[],
    
    -- Interconnection details
    interconnect_agreement_date DATE,
    nda_on_file BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMPP vendor connectors (for SMS - from architecture)
CREATE TABLE vendor_mgmt.smpp_connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    service_provider_id UUID REFERENCES vendor_mgmt.service_providers(id),
    
    connector_name VARCHAR(50) UNIQUE NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    system_id VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL, -- References Secret Manager
    
    bind_type VARCHAR(20) CHECK (bind_type IN ('transmitter', 'receiver', 'transceiver')),
    max_throughput INTEGER DEFAULT 100,
    priority INTEGER DEFAULT 100,
    
    -- Costs
    cost_per_sms DECIMAL(10,6),
    cost_per_mms DECIMAL(10,6),
    
    -- Features
    supports_alphanumeric BOOLEAN DEFAULT false,
    supports_unicode BOOLEAN DEFAULT true,
    supports_delivery_receipts BOOLEAN DEFAULT true,
    
    active BOOLEAN DEFAULT true,
    last_bind_time TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor API configurations
CREATE TABLE vendor_mgmt.api_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    service_provider_id UUID REFERENCES vendor_mgmt.service_providers(id),
    
    api_name VARCHAR(100) NOT NULL,
    api_type VARCHAR(50) NOT NULL, -- REST, SOAP, GRAPHQL
    
    -- Endpoints
    base_url VARCHAR(500) NOT NULL,
    auth_endpoint VARCHAR(500),
    
    -- Authentication
    auth_method VARCHAR(50) NOT NULL, -- API_KEY, OAUTH2, BASIC, CUSTOM
    credentials_ref VARCHAR(255), -- Secret Manager reference
    
    -- Rate limits
    rate_limit_per_second INTEGER,
    rate_limit_per_minute INTEGER,
    rate_limit_per_hour INTEGER,
    
    -- Configuration
    timeout_seconds INTEGER DEFAULT 30,
    retry_attempts INTEGER DEFAULT 3,
    custom_headers JSONB DEFAULT '{}',
    
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor contracts
CREATE TABLE vendor_mgmt.contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    
    contract_number VARCHAR(100) UNIQUE NOT NULL,
    contract_type VARCHAR(50) NOT NULL, -- MSA, SOW, NDA, AMENDMENT
    
    -- Contract details
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    auto_renew BOOLEAN DEFAULT FALSE,
    renewal_notice_days INTEGER DEFAULT 90,
    
    -- Financial
    minimum_commitment DECIMAL(12,2),
    commitment_period VARCHAR(20), -- MONTHLY, QUARTERLY, ANNUAL
    
    -- Documents
    document_path VARCHAR(500), -- GCS path
    
    -- Status
    status VARCHAR(50) DEFAULT 'ACTIVE', -- DRAFT, ACTIVE, EXPIRED, TERMINATED
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor SLAs
CREATE TABLE vendor_mgmt.slas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    contract_id UUID REFERENCES vendor_mgmt.contracts(id),
    
    metric_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- UPTIME, LATENCY, DELIVERY_RATE, etc.
    
    -- Targets
    target_value DECIMAL(10,4) NOT NULL,
    target_unit VARCHAR(20) NOT NULL, -- PERCENT, MS, SECONDS
    measurement_period VARCHAR(20) NOT NULL, -- MONTHLY, QUARTERLY
    
    -- Penalties
    penalty_threshold DECIMAL(10,4),
    penalty_amount DECIMAL(12,2),
    penalty_type VARCHAR(20), -- CREDIT, REFUND
    
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor performance metrics
CREATE TABLE vendor_mgmt.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    service_type VARCHAR(50) NOT NULL, -- VOICE, SMS, API, etc.
    
    -- Measurement period
    metric_date DATE NOT NULL,
    
    -- Performance data
    uptime_percentage DECIMAL(5,2),
    average_latency_ms INTEGER,
    error_rate DECIMAL(5,2),
    
    -- Volume
    total_requests BIGINT DEFAULT 0,
    successful_requests BIGINT DEFAULT 0,
    failed_requests BIGINT DEFAULT 0,
    
    -- Quality (for voice)
    asr DECIMAL(5,2), -- Answer-Seizure Ratio
    acd DECIMAL(8,2), -- Average Call Duration
    pdd DECIMAL(8,3), -- Post-Dial Delay
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(vendor_id, service_type, metric_date)
);

-- Vendor incidents
CREATE TABLE vendor_mgmt.incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES vendor_mgmt.vendors(id),
    
    incident_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Severity
    severity VARCHAR(20) NOT NULL, -- CRITICAL, MAJOR, MINOR, INFORMATIONAL
    impact VARCHAR(255),
    
    -- Timeline
    detected_at TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Resolution
    root_cause TEXT,
    resolution TEXT,
    
    -- SLA impact
    sla_breached BOOLEAN DEFAULT FALSE,
    credit_amount DECIMAL(12,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vendors_active ON vendor_mgmt.vendors(active);
CREATE INDEX idx_vendors_type ON vendor_mgmt.vendors(vendor_type);
CREATE INDEX idx_service_providers_vendor ON vendor_mgmt.service_providers(vendor_id);
CREATE INDEX idx_service_providers_type ON vendor_mgmt.service_providers(provider_type);
CREATE INDEX idx_service_providers_active ON vendor_mgmt.service_providers(is_active);
CREATE INDEX idx_health_checks_provider ON vendor_mgmt.provider_health_checks(provider_id);
CREATE INDEX idx_usage_stats_provider_date ON vendor_mgmt.provider_usage_stats(provider_id, date);
CREATE INDEX idx_carriers_vendor ON vendor_mgmt.carriers(vendor_id);
CREATE INDEX idx_smpp_connectors_vendor ON vendor_mgmt.smpp_connectors(vendor_id);
CREATE INDEX idx_api_configurations_vendor ON vendor_mgmt.api_configurations(vendor_id);
CREATE INDEX idx_contracts_vendor ON vendor_mgmt.contracts(vendor_id);
CREATE INDEX idx_contracts_status ON vendor_mgmt.contracts(status);
CREATE INDEX idx_slas_vendor ON vendor_mgmt.slas(vendor_id);
CREATE INDEX idx_performance_metrics_lookup ON vendor_mgmt.performance_metrics(vendor_id, service_type, metric_date);
CREATE INDEX idx_incidents_vendor ON vendor_mgmt.incidents(vendor_id);
CREATE INDEX idx_incidents_severity ON vendor_mgmt.incidents(severity);

-- Triggers
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendor_mgmt.vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_providers_updated_at BEFORE UPDATE ON vendor_mgmt.service_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smpp_connectors_updated_at BEFORE UPDATE ON vendor_mgmt.smpp_connectors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_configurations_updated_at BEFORE UPDATE ON vendor_mgmt.api_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON vendor_mgmt.contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON vendor_mgmt.incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get active service providers by capability
CREATE OR REPLACE FUNCTION vendor_mgmt.get_providers_by_capability(
    p_capability VARCHAR(100)
)
RETURNS TABLE (
    provider_id UUID,
    instance_name VARCHAR(100),
    priority INTEGER,
    health_status VARCHAR(20)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.instance_name,
        sp.priority,
        sp.health_status
    FROM vendor_mgmt.service_providers sp
    WHERE p_capability = ANY(sp.capabilities)
    AND sp.is_active = TRUE
    ORDER BY sp.is_primary DESC, sp.priority DESC, sp.last_health_check DESC;
END;
$$ LANGUAGE plpgsql;