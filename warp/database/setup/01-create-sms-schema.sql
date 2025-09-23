-- WARP Platform SMS Schema
-- Database: Cloud SQL (PostgreSQL 15)
-- Project: ringer-472421

-- ============================================
-- SMS SCHEMA - Messaging & Campaign Management
-- ============================================
CREATE SCHEMA IF NOT EXISTS sms;

-- ============================================
-- 10DLC CAMPAIGN MANAGEMENT
-- ============================================

-- Campaign Registry Information
CREATE TABLE sms.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    campaign_id VARCHAR(50) UNIQUE NOT NULL, -- TCR Campaign ID
    
    -- Campaign Details
    use_case VARCHAR(50) NOT NULL,
    sub_use_case VARCHAR(50),
    description TEXT NOT NULL,
    sample_messages TEXT[],
    
    -- Brand Information
    brand_id VARCHAR(50) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    
    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN ('DRAFT', 'PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REJECTED')),
    tcr_status VARCHAR(50),
    
    -- Compliance
    attestation_date DATE,
    opt_in_keywords TEXT[] DEFAULT ARRAY['START', 'YES', 'UNSTOP'],
    opt_out_keywords TEXT[] DEFAULT ARRAY['STOP', 'QUIT', 'CANCEL', 'UNSUBSCRIBE'],
    help_keywords TEXT[] DEFAULT ARRAY['HELP', 'INFO'],
    
    -- Message Templates
    opt_in_message TEXT,
    opt_out_message TEXT DEFAULT 'You have been unsubscribed. Reply START to resubscribe.',
    help_message TEXT,
    
    -- Throughput
    daily_limit INTEGER,
    rate_limit INTEGER, -- Messages per second
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_account ON sms.campaigns(account_id);
CREATE INDEX idx_campaigns_status ON sms.campaigns(status);

-- Campaign Phone Numbers Association
CREATE TABLE sms.campaign_numbers (
    campaign_id UUID REFERENCES sms.campaigns(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) REFERENCES numbers.dids(number),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (campaign_id, phone_number)
);

-- ============================================
-- MESSAGE QUEUES & ROUTING
-- ============================================

-- Outbound Message Queue
CREATE TABLE sms.outbound_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Message Details
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    message_type VARCHAR(10) DEFAULT 'SMS' CHECK (message_type IN ('SMS', 'MMS')),
    
    -- MMS Specific
    media_urls TEXT[],
    
    -- Campaign & Compliance
    campaign_id UUID REFERENCES sms.campaigns(id),
    
    -- Routing
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    scheduled_time TIMESTAMPTZ,
    
    -- Jasmin Integration
    jasmin_message_id VARCHAR(100),
    jasmin_username VARCHAR(50),
    
    -- Status Tracking
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 
        'FAILED', 'REJECTED', 'EXPIRED', 'THROTTLED'
    )),
    
    -- Vendor Information
    vendor_name VARCHAR(50),
    vendor_message_id VARCHAR(100),
    
    -- Retry Logic
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Delivery Receipt
    dlr_status VARCHAR(50),
    dlr_error_code VARCHAR(20),
    delivered_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outbound_queue_status ON sms.outbound_queue(status) 
    WHERE status IN ('PENDING', 'QUEUED', 'SENDING');
CREATE INDEX idx_outbound_queue_scheduled ON sms.outbound_queue(scheduled_time) 
    WHERE scheduled_time IS NOT NULL AND status = 'PENDING';
CREATE INDEX idx_outbound_queue_retry ON sms.outbound_queue(next_retry_at) 
    WHERE next_retry_at IS NOT NULL;

-- Inbound Message Log
CREATE TABLE sms.inbound_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Message Details
    from_number VARCHAR(20) NOT NULL,
    to_number VARCHAR(20) NOT NULL,
    message_body TEXT,
    message_type VARCHAR(10) DEFAULT 'SMS',
    
    -- MMS Specific
    media_urls TEXT[],
    
    -- Vendor Information
    vendor_name VARCHAR(50),
    vendor_message_id VARCHAR(100),
    jasmin_message_id VARCHAR(100),
    
    -- Processing
    processed BOOLEAN DEFAULT false,
    webhook_delivered BOOLEAN DEFAULT false,
    webhook_url TEXT,
    webhook_attempts INTEGER DEFAULT 0,
    
    -- Opt-out Detection
    is_opt_out BOOLEAN DEFAULT false,
    is_opt_in BOOLEAN DEFAULT false,
    is_help BOOLEAN DEFAULT false,
    
    -- Metadata
    received_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_inbound_messages_to ON sms.inbound_messages(to_number, received_at);
CREATE INDEX idx_inbound_messages_unprocessed ON sms.inbound_messages(processed) 
    WHERE NOT processed;

-- ============================================
-- OPT-OUT MANAGEMENT
-- ============================================

-- Opt-out List
CREATE TABLE sms.opt_outs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    campaign_id UUID REFERENCES sms.campaigns(id),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Opt-out Details
    opted_out_at TIMESTAMPTZ DEFAULT NOW(),
    opt_out_method VARCHAR(50) DEFAULT 'SMS', -- SMS, API, MANUAL
    opt_out_message TEXT,
    
    -- Re-opt-in tracking
    opted_in_at TIMESTAMPTZ,
    opt_in_method VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Compliance
    retention_until TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 years',
    
    UNIQUE(phone_number, campaign_id)
);

CREATE INDEX idx_opt_outs_phone ON sms.opt_outs(phone_number);
CREATE INDEX idx_opt_outs_campaign ON sms.opt_outs(campaign_id);

-- ============================================
-- JASMIN INTEGRATION
-- ============================================

-- Jasmin User Configuration
CREATE TABLE sms.jasmin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    
    -- Jasmin Credentials
    username VARCHAR(50) UNIQUE NOT NULL,
    password_encrypted VARCHAR(255) NOT NULL,
    uid VARCHAR(50) UNIQUE NOT NULL,
    gid VARCHAR(50) DEFAULT 'customers',
    
    -- Connection Type
    connection_type VARCHAR(20) DEFAULT 'HTTP' CHECK (connection_type IN ('HTTP', 'SMPP')),
    
    -- Rate Limits
    mt_quota INTEGER DEFAULT 10, -- Messages per second
    
    -- SMPP Specific
    smpp_bind_type VARCHAR(20) DEFAULT 'transceiver',
    allowed_source_addresses TEXT[],
    default_source_address VARCHAR(20),
    
    -- Routing
    default_route VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jasmin Routes
CREATE TABLE sms.jasmin_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Route Identification
    route_id VARCHAR(50) UNIQUE NOT NULL,
    route_type VARCHAR(20) DEFAULT 'MO' CHECK (route_type IN ('MO', 'MT')),
    
    -- Matching Criteria
    filter_type VARCHAR(50), -- 'UserFilter', 'DestinationFilter', etc.
    filter_value TEXT,
    
    -- Target Connector
    connector_id VARCHAR(50) NOT NULL,
    rate NUMERIC(5,2) DEFAULT 1.0,
    
    -- Priority
    priority INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROVIDER CONFIGURATION
-- ============================================

-- SMS Provider Configuration
CREATE TABLE sms.provider_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name VARCHAR(50) UNIQUE NOT NULL,
    provider_type VARCHAR(20) CHECK (provider_type IN ('PRIMARY', 'BACKUP', 'SPECIALTY')),
    
    -- Connection Details
    smpp_host VARCHAR(255),
    smpp_port INTEGER DEFAULT 2775,
    smpp_tls_port INTEGER DEFAULT 2776,
    system_id VARCHAR(100),
    password_encrypted VARCHAR(255),
    
    -- Capabilities
    supports_10dlc BOOLEAN DEFAULT true,
    supports_tollfree BOOLEAN DEFAULT true,
    supports_shortcode BOOLEAN DEFAULT false,
    supports_mms BOOLEAN DEFAULT true,
    supports_international BOOLEAN DEFAULT false,
    
    -- Rate Limits
    max_throughput INTEGER DEFAULT 100,
    
    -- Cost Structure
    sms_cost_per_segment NUMERIC(10,5),
    mms_cost_per_message NUMERIC(10,5),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default provider (Sinch)
INSERT INTO sms.provider_config (
    provider_name,
    provider_type,
    smpp_host,
    supports_10dlc,
    supports_tollfree,
    supports_mms
) VALUES (
    'sinch',
    'PRIMARY',
    'smpp1.sinch.com',
    true,
    true,
    true
);

-- ============================================
-- DELIVERY REPORTS & ANALYTICS
-- ============================================

-- Delivery Report Log
CREATE TABLE sms.delivery_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID REFERENCES sms.outbound_queue(id),
    
    -- DLR Details
    dlr_status VARCHAR(50) NOT NULL,
    dlr_error_code VARCHAR(20),
    dlr_error_message TEXT,
    
    -- Timestamps
    submitted_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- Vendor Information
    vendor_dlr_id VARCHAR(100),
    vendor_status VARCHAR(50),
    
    -- Raw DLR
    raw_dlr JSONB,
    
    received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dlr_message ON sms.delivery_reports(message_id);
CREATE INDEX idx_dlr_received ON sms.delivery_reports(received_at);

-- Message Analytics Summary
CREATE TABLE sms.message_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id),
    campaign_id UUID REFERENCES sms.campaigns(id),
    
    -- Time Period
    period_date DATE NOT NULL,
    
    -- Volume Metrics
    messages_sent INTEGER DEFAULT 0,
    messages_delivered INTEGER DEFAULT 0,
    messages_failed INTEGER DEFAULT 0,
    
    -- Performance
    delivery_rate NUMERIC(5,2),
    average_delivery_time_seconds INTEGER,
    
    -- Opt-outs
    opt_outs_received INTEGER DEFAULT 0,
    opt_ins_received INTEGER DEFAULT 0,
    
    -- Costs
    total_segments INTEGER DEFAULT 0,
    total_cost NUMERIC(10,2) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, campaign_id, period_date)
);

CREATE INDEX idx_message_analytics_period ON sms.message_analytics(period_date);

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamps
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON sms.campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_queue_updated_at BEFORE UPDATE ON sms.outbound_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jasmin_users_updated_at BEFORE UPDATE ON sms.jasmin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PERMISSIONS
-- ============================================

-- Grant permissions to application user
GRANT USAGE ON SCHEMA sms TO warp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sms TO warp_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA sms TO warp_app;