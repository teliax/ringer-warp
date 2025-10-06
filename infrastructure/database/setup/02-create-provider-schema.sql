-- WARP Platform Provider Configuration Schema
-- Database: Cloud SQL (PostgreSQL 15)
-- Project: ringer-472421

-- ============================================
-- PROVIDERS SCHEMA - Third-party integrations
-- ============================================
CREATE SCHEMA IF NOT EXISTS providers;

-- ============================================
-- PROVIDER REGISTRY
-- ============================================

-- Master provider registry
CREATE TABLE providers.provider_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Provider Identification
    provider_code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'telique', 'sinch', 'netsuite'
    provider_name VARCHAR(255) NOT NULL,
    provider_category VARCHAR(50) NOT NULL CHECK (provider_category IN (
        'TELECOM', 'MESSAGING', 'PAYMENT', 'ERP', 'CRM', 'TAX', 'SHIPPING'
    )),
    
    -- Module Information
    module_version VARCHAR(20) NOT NULL,
    module_path VARCHAR(255) NOT NULL, -- Go module path
    
    -- Capabilities
    capabilities TEXT[] NOT NULL, -- Array of capability strings
    
    -- Configuration Schema
    config_schema JSONB NOT NULL, -- Full configuration schema
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deprecated BOOLEAN DEFAULT false,
    
    -- Metadata
    description TEXT,
    documentation_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_provider_registry_category ON providers.provider_registry(provider_category);

-- ============================================
-- PROVIDER INSTANCES
-- ============================================

-- Active provider configurations per account
CREATE TABLE providers.provider_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    provider_id UUID REFERENCES providers.provider_registry(id),
    
    -- Instance Details
    instance_name VARCHAR(255) NOT NULL, -- User-friendly name
    instance_code VARCHAR(50) NOT NULL, -- Unique per account
    
    -- Configuration
    configuration JSONB NOT NULL, -- Encrypted sensitive fields
    
    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'ACTIVE', 'INACTIVE', 'TESTING', 'ERROR', 'SUSPENDED'
    )),
    
    -- Health
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(50),
    health_message TEXT,
    
    -- Usage
    is_primary BOOLEAN DEFAULT false, -- Primary provider for category
    priority INTEGER DEFAULT 100, -- For load balancing
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    UNIQUE(account_id, instance_code)
);

CREATE INDEX idx_provider_instances_account ON providers.provider_instances(account_id);
CREATE INDEX idx_provider_instances_status ON providers.provider_instances(status);

-- ============================================
-- TELECOM PROVIDERS (LRN/LERG/CNAM)
-- ============================================

-- Telique specific configuration
CREATE TABLE providers.telique_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- API Configuration
    api_key_encrypted VARCHAR(500) NOT NULL,
    account_id VARCHAR(100) NOT NULL,
    api_url VARCHAR(255) DEFAULT 'https://api-dev.ringer.tel',
    
    -- Settings
    timeout_seconds INTEGER DEFAULT 5,
    retry_attempts INTEGER DEFAULT 3,
    cache_ttl_seconds INTEGER DEFAULT 3600,
    
    -- Features
    enable_lrn BOOLEAN DEFAULT true,
    enable_lerg BOOLEAN DEFAULT true,
    enable_cnam BOOLEAN DEFAULT true,
    enable_bulk BOOLEAN DEFAULT true,
    
    -- Rate Limits
    rate_limit_per_second INTEGER DEFAULT 100,
    bulk_batch_size INTEGER DEFAULT 1000,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BulkVS configuration
CREATE TABLE providers.bulkvs_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- API Configuration
    username VARCHAR(100) NOT NULL,
    password_encrypted VARCHAR(500) NOT NULL,
    api_url VARCHAR(255) DEFAULT 'https://api.bulkvs.com',
    
    -- Features
    enable_lrn BOOLEAN DEFAULT true,
    enable_cnam BOOLEAN DEFAULT true,
    enable_lidb BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MESSAGING PROVIDERS (SMS/MMS)
-- ============================================

-- Sinch configuration
CREATE TABLE providers.sinch_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- Account Details
    account_sid VARCHAR(100) NOT NULL,
    auth_token_encrypted VARCHAR(500) NOT NULL,
    
    -- SMPP Configuration
    smpp_system_id VARCHAR(100),
    smpp_password_encrypted VARCHAR(500),
    smpp_host VARCHAR(255) DEFAULT 'smpp1.sinch.com',
    smpp_port INTEGER DEFAULT 2775,
    smpp_tls_enabled BOOLEAN DEFAULT false,
    
    -- Features
    enable_10dlc BOOLEAN DEFAULT true,
    enable_tollfree BOOLEAN DEFAULT true,
    enable_shortcode BOOLEAN DEFAULT false,
    enable_mms BOOLEAN DEFAULT true,
    
    -- Rate Limits
    throughput_limit INTEGER DEFAULT 100,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bandwidth configuration
CREATE TABLE providers.bandwidth_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- API Configuration
    account_id VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted VARCHAR(500) NOT NULL,
    
    -- Endpoints
    api_url VARCHAR(255) DEFAULT 'https://api.bandwidth.com',
    voice_url VARCHAR(255) DEFAULT 'https://voice.bandwidth.com',
    messaging_url VARCHAR(255) DEFAULT 'https://messaging.bandwidth.com',
    
    -- Features
    enable_voice BOOLEAN DEFAULT true,
    enable_messaging BOOLEAN DEFAULT true,
    enable_number_ordering BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAYMENT PROVIDERS
-- ============================================

-- Authorize.Net configuration
CREATE TABLE providers.authorizenet_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- API Credentials
    api_login_id VARCHAR(100) NOT NULL,
    transaction_key_encrypted VARCHAR(500) NOT NULL,
    
    -- Environment
    environment VARCHAR(20) DEFAULT 'production' CHECK (environment IN ('production', 'sandbox')),
    
    -- Features
    enable_cim BOOLEAN DEFAULT true, -- Customer Information Manager
    enable_arb BOOLEAN DEFAULT true, -- Automated Recurring Billing
    enable_fraud_detection BOOLEAN DEFAULT true,
    
    -- Settings
    duplicate_window INTEGER DEFAULT 120, -- Seconds
    
    -- Webhook
    webhook_signature_key_encrypted VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wells Fargo configuration
CREATE TABLE providers.wellsfargo_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- Bank Details
    account_number_encrypted VARCHAR(500) NOT NULL,
    routing_number VARCHAR(20) NOT NULL,
    company_id VARCHAR(100) NOT NULL,
    
    -- API Access
    api_key_encrypted VARCHAR(500),
    sftp_username VARCHAR(100),
    sftp_key_encrypted TEXT, -- SSH private key
    
    -- File Formats
    ach_file_format VARCHAR(20) DEFAULT 'NACHA',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ERP PROVIDERS
-- ============================================

-- NetSuite configuration
CREATE TABLE providers.netsuite_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- OAuth Credentials
    account_id VARCHAR(100) NOT NULL,
    consumer_key_encrypted VARCHAR(500) NOT NULL,
    consumer_secret_encrypted VARCHAR(500) NOT NULL,
    token_id_encrypted VARCHAR(500) NOT NULL,
    token_secret_encrypted VARCHAR(500) NOT NULL,
    
    -- API Settings
    api_version VARCHAR(20) DEFAULT '2023.2',
    
    -- NetSuite IDs
    subsidiary_id VARCHAR(50),
    location_id VARCHAR(50),
    department_id VARCHAR(50),
    class_id VARCHAR(50),
    custom_form_id VARCHAR(50),
    tax_item_id VARCHAR(50),
    
    -- Field Mappings
    field_mappings JSONB DEFAULT '{}'::jsonb,
    
    -- Sync Settings
    enable_customer_sync BOOLEAN DEFAULT true,
    enable_invoice_sync BOOLEAN DEFAULT true,
    enable_payment_sync BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HubSpot configuration
CREATE TABLE providers.hubspot_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- Authentication
    portal_id VARCHAR(100) NOT NULL,
    api_key_encrypted VARCHAR(500), -- Legacy
    access_token_encrypted VARCHAR(500), -- OAuth2
    refresh_token_encrypted VARCHAR(500),
    app_id VARCHAR(100),
    
    -- Settings
    sync_interval_minutes INTEGER DEFAULT 15,
    enable_bidirectional_sync BOOLEAN DEFAULT true,
    
    -- Default IDs
    default_pipeline_id VARCHAR(50),
    default_owner_id VARCHAR(50),
    
    -- Field Mappings
    contact_field_mappings JSONB DEFAULT '{}'::jsonb,
    company_field_mappings JSONB DEFAULT '{}'::jsonb,
    deal_field_mappings JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAX PROVIDERS
-- ============================================

-- Avalara configuration
CREATE TABLE providers.avalara_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- API Credentials
    account_id VARCHAR(100) NOT NULL,
    license_key_encrypted VARCHAR(500) NOT NULL,
    
    -- Settings
    api_url VARCHAR(255) DEFAULT 'https://rest.avatax.com',
    company_code VARCHAR(50) NOT NULL,
    
    -- Features
    commit_transactions BOOLEAN DEFAULT false,
    enable_address_validation BOOLEAN DEFAULT true,
    enable_tax_calculation BOOLEAN DEFAULT true,
    
    -- Defaults
    default_tax_code VARCHAR(50) DEFAULT 'P0000000',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROVIDER WEBHOOKS
-- ============================================

-- Webhook configurations
CREATE TABLE providers.webhook_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id) ON DELETE CASCADE,
    
    -- Webhook Details
    event_type VARCHAR(100) NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    
    -- Authentication
    auth_type VARCHAR(20) CHECK (auth_type IN ('NONE', 'BASIC', 'BEARER', 'HMAC')),
    auth_credentials_encrypted VARCHAR(500),
    
    -- Settings
    is_active BOOLEAN DEFAULT true,
    retry_attempts INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_configs_instance ON providers.webhook_configs(instance_id);

-- ============================================
-- PROVIDER LOGS
-- ============================================

-- API call logs
CREATE TABLE providers.api_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id),
    
    -- Request Details
    api_method VARCHAR(10) NOT NULL,
    api_endpoint VARCHAR(500) NOT NULL,
    request_headers JSONB,
    request_body JSONB,
    
    -- Response Details
    response_code INTEGER,
    response_headers JSONB,
    response_body JSONB,
    response_time_ms INTEGER,
    
    -- Status
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- Metadata
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient log queries
CREATE INDEX idx_api_logs_instance ON providers.api_logs(instance_id, created_at DESC);
CREATE INDEX idx_api_logs_errors ON providers.api_logs(success, created_at DESC) WHERE NOT success;

-- ============================================
-- PROVIDER METRICS
-- ============================================

-- Provider performance metrics
CREATE TABLE providers.performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    instance_id UUID REFERENCES providers.provider_instances(id),
    
    -- Time Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Volume Metrics
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    
    -- Performance Metrics
    avg_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    
    -- Availability
    uptime_percentage NUMERIC(5,2),
    total_downtime_seconds INTEGER DEFAULT 0,
    
    -- Cost (if applicable)
    total_cost NUMERIC(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_performance_metrics_instance ON providers.performance_metrics(instance_id, period_start DESC);

-- ============================================
-- INITIAL PROVIDER DATA
-- ============================================

-- Insert default provider definitions
INSERT INTO providers.provider_registry (provider_code, provider_name, provider_category, module_version, module_path, capabilities, config_schema) VALUES
-- Telecom
('telique', 'Telique', 'TELECOM', '1.0.0', 'github.com/ringer-warp/providers/telique', 
 ARRAY['lrn_lookup', 'lerg_lookup', 'cnam_lookup', 'bulk_lookup'],
 '{"credentials": {"api_key": {"type": "secret", "required": true}}}'::jsonb),

('bulkvs', 'BulkVS', 'TELECOM', '1.0.0', 'github.com/ringer-warp/providers/bulkvs',
 ARRAY['lrn_lookup', 'cnam_lookup', 'lidb_lookup'],
 '{"credentials": {"username": {"type": "string", "required": true}}}'::jsonb),

-- Messaging
('sinch', 'Sinch', 'MESSAGING', '1.0.0', 'github.com/ringer-warp/providers/sinch',
 ARRAY['sms_send', 'mms_send', '10dlc_support', 'tollfree_support'],
 '{"credentials": {"account_sid": {"type": "string", "required": true}}}'::jsonb),

('bandwidth', 'Bandwidth', 'MESSAGING', '1.0.0', 'github.com/ringer-warp/providers/bandwidth',
 ARRAY['voice_calling', 'sms_send', 'mms_send', 'number_ordering'],
 '{"credentials": {"account_id": {"type": "string", "required": true}}}'::jsonb),

-- Payment
('authorizenet', 'Authorize.Net', 'PAYMENT', '1.0.0', 'github.com/ringer-warp/providers/authorizenet',
 ARRAY['credit_card_processing', 'ach_processing', 'recurring_billing', 'payment_profiles'],
 '{"credentials": {"api_login_id": {"type": "string", "required": true}}}'::jsonb),

('wellsfargo', 'Wells Fargo', 'PAYMENT', '1.0.0', 'github.com/ringer-warp/providers/wellsfargo',
 ARRAY['ach_processing', 'wire_transfers', 'positive_pay'],
 '{"credentials": {"account_number": {"type": "secret", "required": true}}}'::jsonb),

-- ERP/CRM
('netsuite', 'NetSuite', 'ERP', '1.0.0', 'github.com/ringer-warp/providers/netsuite',
 ARRAY['invoice_sync', 'customer_sync', 'payment_sync', 'item_sync'],
 '{"credentials": {"account_id": {"type": "string", "required": true}}}'::jsonb),

('hubspot', 'HubSpot', 'CRM', '1.0.0', 'github.com/ringer-warp/providers/hubspot',
 ARRAY['contact_sync', 'company_sync', 'deal_management', 'ticket_management'],
 '{"credentials": {"portal_id": {"type": "string", "required": true}}}'::jsonb),

-- Tax
('avalara', 'Avalara', 'TAX', '1.0.0', 'github.com/ringer-warp/providers/avalara',
 ARRAY['tax_calculation', 'address_validation', 'tax_reporting'],
 '{"credentials": {"account_id": {"type": "string", "required": true}}}'::jsonb);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps
CREATE TRIGGER update_provider_registry_updated_at BEFORE UPDATE ON providers.provider_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_provider_instances_updated_at BEFORE UPDATE ON providers.provider_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant permissions to application user
GRANT USAGE ON SCHEMA providers TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA providers TO warp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA providers TO warp_app;