-- SMS/MMS Messaging Schema
-- Handles message routing, delivery, and campaign management

-- Message detail records (MDR) - equivalent to CDR for messages
CREATE TABLE messaging.mdr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Message identifiers
    message_id VARCHAR(255) UNIQUE NOT NULL, -- Our ID
    vendor_message_id VARCHAR(255), -- Vendor's ID
    
    -- Message details
    direction message_direction NOT NULL,
    message_type message_type DEFAULT 'sms',
    
    -- Parties
    from_number VARCHAR(32) NOT NULL,
    to_number VARCHAR(32) NOT NULL,
    
    -- Content
    message_body TEXT,
    segment_count INTEGER DEFAULT 1,
    media_urls TEXT[], -- For MMS
    
    -- Status tracking
    status VARCHAR(50) NOT NULL, -- QUEUED, SENT, DELIVERED, FAILED, EXPIRED
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    
    -- DLR (Delivery Receipt) info
    dlr_status VARCHAR(50),
    dlr_error_code VARCHAR(20),
    dlr_received_at TIMESTAMPTZ,
    
    -- Routing
    vendor_id UUID REFERENCES vendor_mgmt.vendors(id),
    vendor_connector VARCHAR(100), -- Jasmin connector name
    
    -- Billing
    customer_rate DECIMAL(10,6),
    customer_amount DECIMAL(10,4),
    vendor_rate DECIMAL(10,6),
    vendor_amount DECIMAL(10,4),
    margin DECIMAL(10,4),
    
    -- Campaign association (for 10DLC)
    campaign_id UUID REFERENCES messaging.campaigns_10dlc(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'
);

-- Customer SMS authentication (mirrors architecture doc)
CREATE TABLE messaging.customer_sms_auth (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    auth_type VARCHAR(20) CHECK (auth_type IN ('API_KEY', 'SMPP', 'BOTH')),
    
    -- API authentication
    api_key VARCHAR(100) UNIQUE,
    api_secret_hash VARCHAR(255),
    api_rate_limit INTEGER DEFAULT 10, -- per second
    
    -- SMPP authentication
    smpp_system_id VARCHAR(50) UNIQUE,
    smpp_password_hash VARCHAR(255),
    smpp_allowed_ips INET[],
    smpp_max_binds INTEGER DEFAULT 2,
    smpp_throughput INTEGER DEFAULT 100,
    
    -- Common settings
    allowed_source_addresses TEXT[], -- Allowed sender IDs
    force_source_address VARCHAR(20), -- Override sender
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id)
);

-- Inbound message routing
CREATE TABLE messaging.inbound_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    did VARCHAR(20) REFERENCES numbers.dids(number),
    account_id UUID REFERENCES accounts.accounts(id),
    delivery_method VARCHAR(20) CHECK (delivery_method IN ('webhook', 'smpp', 'storage', 'email')),
    
    -- Webhook delivery
    webhook_url VARCHAR(500),
    webhook_method VARCHAR(10) DEFAULT 'POST',
    webhook_secret VARCHAR(255),
    webhook_retry_count INTEGER DEFAULT 3,
    
    -- SMPP delivery
    smpp_system_id VARCHAR(50),
    
    -- Email forwarding
    email_address VARCHAR(255),
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(did)
);

-- 10DLC Campaign tracking
CREATE TABLE messaging.campaigns_10dlc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- TCR (The Campaign Registry) info
    campaign_id VARCHAR(100) UNIQUE, -- TCR campaign ID
    brand_id VARCHAR(100), -- TCR brand ID
    
    -- Campaign details
    use_case VARCHAR(100),
    sub_use_cases TEXT[],
    description TEXT,
    sample_messages TEXT[],
    
    -- Registration info
    message_flow TEXT,
    help_message TEXT,
    stop_message TEXT,
    
    -- Associated numbers
    phone_numbers TEXT[],
    
    -- Limits
    throughput_limit INTEGER, -- Messages per second
    daily_cap INTEGER, -- Messages per day
    
    -- Status
    status VARCHAR(50), -- PENDING, ACTIVE, SUSPENDED, EXPIRED
    tcr_submission_date DATE,
    tcr_approval_date DATE,
    
    -- Compliance scores
    trust_score INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brand registration for 10DLC
CREATE TABLE messaging.brands_10dlc (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- TCR brand info
    brand_id VARCHAR(100) UNIQUE,
    
    -- Company info (must match exactly)
    legal_name VARCHAR(255) NOT NULL,
    dba_name VARCHAR(255),
    tax_id VARCHAR(50),
    
    -- Brand details
    vertical VARCHAR(100), -- Industry vertical
    website VARCHAR(500),
    
    -- Contacts
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    
    -- Status
    status VARCHAR(50), -- PENDING, VERIFIED, UNVERIFIED, VETTED
    vetting_status VARCHAR(50),
    vetting_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message templates (for common messages)
CREATE TABLE messaging.templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts.accounts(id),
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Template content
    message_body TEXT NOT NULL,
    variables TEXT[], -- Variable placeholders like {{name}}, {{code}}
    
    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(account_id, name)
);

-- Opt-out management
CREATE TABLE messaging.opt_outs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(32) NOT NULL,
    
    -- What they opted out from
    opt_out_scope VARCHAR(50), -- GLOBAL, ACCOUNT, CAMPAIGN
    account_id UUID REFERENCES accounts.accounts(id),
    campaign_id UUID REFERENCES messaging.campaigns_10dlc(id),
    from_number VARCHAR(32), -- Which number they texted STOP to
    
    -- Opt-out details
    opt_out_date TIMESTAMPTZ DEFAULT NOW(),
    opt_out_message TEXT,
    
    -- Re-opt-in tracking
    opted_in_date TIMESTAMPTZ,
    opt_in_message TEXT,
    
    active BOOLEAN DEFAULT TRUE,
    
    UNIQUE(phone_number, opt_out_scope, COALESCE(account_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(campaign_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- Webhook delivery attempts
CREATE TABLE messaging.webhook_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mdr_id UUID REFERENCES messaging.mdr(id),
    
    -- Webhook details
    url VARCHAR(500) NOT NULL,
    method VARCHAR(10) DEFAULT 'POST',
    
    -- Attempt info
    attempt_number INTEGER NOT NULL,
    
    -- Request/Response
    request_headers JSONB,
    request_body TEXT,
    response_status INTEGER,
    response_headers JSONB,
    response_body TEXT,
    
    -- Timing
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    response_time_ms INTEGER,
    
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT
);

-- Message queue status (Jasmin integration)
CREATE TABLE messaging.queue_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Queue metrics
    queue_name VARCHAR(100) NOT NULL,
    messages_pending INTEGER DEFAULT 0,
    messages_processing INTEGER DEFAULT 0,
    
    -- Throughput
    messages_per_second DECIMAL(10,2),
    
    -- Health
    queue_health VARCHAR(20), -- HEALTHY, DEGRADED, DOWN
    last_error TEXT,
    
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(queue_name, measured_at)
);

-- Indexes
CREATE INDEX idx_mdr_account_id ON messaging.mdr(account_id);
CREATE INDEX idx_mdr_message_id ON messaging.mdr(message_id);
CREATE INDEX idx_mdr_created_at ON messaging.mdr(created_at);
CREATE INDEX idx_mdr_from_to ON messaging.mdr(from_number, to_number);
CREATE INDEX idx_mdr_status ON messaging.mdr(status);
CREATE INDEX idx_mdr_campaign ON messaging.mdr(campaign_id);

CREATE INDEX idx_customer_sms_auth_account ON messaging.customer_sms_auth(account_id);
CREATE INDEX idx_inbound_routes_did ON messaging.inbound_routes(did);
CREATE INDEX idx_campaigns_10dlc_account ON messaging.campaigns_10dlc(account_id);
CREATE INDEX idx_campaigns_10dlc_status ON messaging.campaigns_10dlc(status);
CREATE INDEX idx_brands_10dlc_account ON messaging.brands_10dlc(account_id);
CREATE INDEX idx_templates_account ON messaging.templates(account_id);
CREATE INDEX idx_opt_outs_phone ON messaging.opt_outs(phone_number);
CREATE INDEX idx_webhook_attempts_mdr ON messaging.webhook_attempts(mdr_id);

-- Triggers
CREATE TRIGGER update_campaigns_10dlc_updated_at BEFORE UPDATE ON messaging.campaigns_10dlc
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brands_10dlc_updated_at BEFORE UPDATE ON messaging.brands_10dlc
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON messaging.templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check opt-out status
CREATE OR REPLACE FUNCTION messaging.check_opt_out(
    p_from_number VARCHAR(32),
    p_to_number VARCHAR(32),
    p_account_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    opted_out BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM messaging.opt_outs
        WHERE phone_number = p_to_number
        AND active = TRUE
        AND (
            opt_out_scope = 'GLOBAL'
            OR (opt_out_scope = 'ACCOUNT' AND account_id = p_account_id)
            OR (opt_out_scope = 'CAMPAIGN' AND from_number = p_from_number)
        )
    ) INTO opted_out;
    
    RETURN opted_out;
END;
$$ LANGUAGE plpgsql;

-- Function to process STOP/START keywords
CREATE OR REPLACE FUNCTION messaging.process_keyword(
    p_message_body TEXT,
    p_from_number VARCHAR(32),
    p_to_number VARCHAR(32),
    p_account_id UUID
)
RETURNS VARCHAR(20) AS $$
DECLARE
    keyword VARCHAR(20);
BEGIN
    keyword := UPPER(TRIM(p_message_body));
    
    IF keyword IN ('STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT') THEN
        INSERT INTO messaging.opt_outs (
            phone_number, opt_out_scope, account_id, from_number, opt_out_message
        ) VALUES (
            p_from_number, 'ACCOUNT', p_account_id, p_to_number, p_message_body
        )
        ON CONFLICT (phone_number, opt_out_scope, account_id, campaign_id) 
        DO UPDATE SET active = TRUE, opt_out_date = NOW(), opt_out_message = p_message_body;
        
        RETURN 'OPT_OUT';
        
    ELSIF keyword IN ('START', 'YES', 'UNSTOP', 'SUBSCRIBE') THEN
        UPDATE messaging.opt_outs
        SET active = FALSE, opted_in_date = NOW(), opt_in_message = p_message_body
        WHERE phone_number = p_from_number
        AND account_id = p_account_id
        AND active = TRUE;
        
        RETURN 'OPT_IN';
        
    ELSIF keyword IN ('HELP', 'INFO') THEN
        RETURN 'HELP';
        
    ELSE
        RETURN 'NONE';
    END IF;
END;
$$ LANGUAGE plpgsql;