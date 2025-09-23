-- SIP Routing and Trunk Configuration Schema
-- Handles SIP trunks, routing rules, and carrier management

-- Customer SIP trunks
CREATE TABLE routing.trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    tech_prefix VARCHAR(10), -- Optional prefix for routing
    
    -- Authentication
    auth_type trunk_auth_type DEFAULT 'IP_ACL',
    username VARCHAR(100),
    password_encrypted TEXT, -- Encrypted if using registration
    realm VARCHAR(255),
    
    -- Configuration
    max_concurrent_calls INTEGER DEFAULT 10,
    calls_per_second_limit INTEGER DEFAULT 5,
    
    -- Codecs (order matters for preference)
    allowed_codecs TEXT[] DEFAULT ARRAY['G722','PCMU','PCMA','G729','OPUS'],
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE, -- Admin can lock for non-payment
    locked_reason TEXT,
    
    -- Registration status (if applicable)
    registration_status VARCHAR(50),
    last_registration TIMESTAMPTZ,
    registration_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- IP ACL for trunk authentication
CREATE TABLE routing.trunk_acl (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trunk_id UUID NOT NULL REFERENCES routing.trunks(id) ON DELETE CASCADE,
    
    ip_address INET NOT NULL,
    subnet_mask INTEGER DEFAULT 32, -- CIDR notation
    description VARCHAR(255),
    
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(trunk_id, ip_address, subnet_mask)
);

-- Outbound routing rules
CREATE TABLE routing.outbound_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE CASCADE,
    
    -- Route info
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pattern VARCHAR(100) NOT NULL, -- Regex pattern for matching
    
    -- Route configuration
    priority INTEGER DEFAULT 100, -- Lower is higher priority
    routing_strategy routing_strategy DEFAULT 'LCR',
    
    -- Digit manipulation
    strip_digits INTEGER DEFAULT 0,
    prepend_digits VARCHAR(20),
    
    -- Restrictions
    allowed_trunk_ids UUID[], -- If specified, only these trunks can use this route
    time_restrictions JSONB, -- Time of day/week restrictions
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carrier definitions
CREATE TABLE routing.carriers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    
    -- Company info
    company_name VARCHAR(255),
    support_phone VARCHAR(50),
    support_email VARCHAR(255),
    noc_email VARCHAR(255),
    
    -- Technical contact
    tech_contact_name VARCHAR(255),
    tech_contact_phone VARCHAR(50),
    tech_contact_email VARCHAR(255),
    
    -- Billing contact
    billing_contact_name VARCHAR(255),
    billing_contact_phone VARCHAR(50),
    billing_contact_email VARCHAR(255),
    
    -- Configuration
    requires_tech_prefix BOOLEAN DEFAULT FALSE,
    tech_prefix VARCHAR(10),
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Carrier trunks (moved from vendor_mgmt schema)
CREATE TABLE routing.carrier_trunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_id UUID NOT NULL REFERENCES routing.carriers(id),
    
    -- SIP endpoints
    name VARCHAR(255) NOT NULL,
    sip_host VARCHAR(255) NOT NULL,
    sip_port INTEGER DEFAULT 5060,
    transport VARCHAR(10) DEFAULT 'UDP', -- UDP, TCP, TLS
    
    -- Authentication (if required by carrier)
    auth_username VARCHAR(100),
    auth_password_encrypted TEXT,
    from_domain VARCHAR(255),
    
    -- Capacity
    max_channels INTEGER DEFAULT 1000,
    current_calls INTEGER DEFAULT 0, -- Updated in real-time by Kamailio
    
    -- Features
    supports_sms BOOLEAN DEFAULT FALSE,
    supports_emergency BOOLEAN DEFAULT FALSE,
    
    -- Cost (for LCR)
    setup_fee DECIMAL(10,6) DEFAULT 0.00,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    health_check_enabled BOOLEAN DEFAULT TRUE,
    last_health_check TIMESTAMPTZ,
    health_status VARCHAR(50), -- UP, DOWN, DEGRADED
    
    -- Weight for load balancing
    weight INTEGER DEFAULT 100,
    priority INTEGER DEFAULT 100,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- LCR rate deck
CREATE TABLE routing.rate_deck (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_trunk_id UUID NOT NULL REFERENCES routing.carrier_trunks(id),
    
    -- Destination
    prefix VARCHAR(20) NOT NULL, -- Dialing prefix
    destination_name VARCHAR(255), -- Human readable
    country_code VARCHAR(3),
    
    -- Rates (per minute)
    rate DECIMAL(10,6) NOT NULL,
    
    -- Billing increments
    initial_increment INTEGER DEFAULT 1, -- seconds
    subsequent_increment INTEGER DEFAULT 1, -- seconds
    
    -- Connection fees
    connection_fee DECIMAL(10,6) DEFAULT 0.00,
    
    -- Quality metrics (for quality-based routing)
    asr DECIMAL(5,2), -- Answer-Seizure Ratio
    acd DECIMAL(8,2), -- Average Call Duration
    pdd DECIMAL(8,3), -- Post-Dial Delay
    
    -- Effective dates
    effective_date DATE NOT NULL,
    expires_date DATE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(carrier_trunk_id, prefix, effective_date)
);

-- Routing partitions for multi-tenant routing
CREATE TABLE routing.partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    
    -- Carrier assignments
    carrier_trunk_ids UUID[], -- Array of carrier trunk IDs in this partition
    
    -- Default for new accounts
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Quality requirements
    min_asr DECIMAL(5,2) DEFAULT 30.00,
    min_acd DECIMAL(8,2) DEFAULT 60.00, -- seconds
    max_pdd DECIMAL(8,3) DEFAULT 5.000, -- seconds
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Account partition assignments
CREATE TABLE routing.account_partitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    partition_id UUID NOT NULL REFERENCES routing.partitions(id),
    
    -- Override quality requirements for this account
    override_min_asr DECIMAL(5,2),
    override_min_acd DECIMAL(8,2),
    override_max_pdd DECIMAL(8,3),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id)
);

-- Emergency routing (911)
CREATE TABLE routing.emergency_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Location matching
    country VARCHAR(2) DEFAULT 'US',
    state VARCHAR(2),
    rate_center VARCHAR(100),
    
    -- PSAP routing
    psap_id VARCHAR(50),
    primary_route VARCHAR(500), -- SIP URI
    backup_route VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routing blacklist (fraud prevention)
CREATE TABLE routing.blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What to block
    block_type VARCHAR(20) NOT NULL, -- NUMBER, PREFIX, COUNTRY
    block_value VARCHAR(50) NOT NULL,
    
    -- Why blocked
    reason VARCHAR(255),
    
    -- Scope
    account_id UUID REFERENCES accounts.accounts(id), -- NULL = global
    
    -- Duration
    expires_at TIMESTAMPTZ, -- NULL = permanent
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    UNIQUE(block_type, block_value, account_id)
);

-- Indexes
CREATE INDEX idx_trunks_account_id ON routing.trunks(account_id);
CREATE INDEX idx_trunks_active ON routing.trunks(active);
CREATE INDEX idx_trunk_acl_trunk_id ON routing.trunk_acl(trunk_id);
CREATE INDEX idx_trunk_acl_ip ON routing.trunk_acl(ip_address);
CREATE INDEX idx_outbound_routes_account_id ON routing.outbound_routes(account_id);
CREATE INDEX idx_outbound_routes_pattern ON routing.outbound_routes(pattern);
CREATE INDEX idx_outbound_routes_priority ON routing.outbound_routes(priority);
CREATE INDEX idx_carrier_trunks_carrier_id ON routing.carrier_trunks(carrier_id);
CREATE INDEX idx_carrier_trunks_active ON routing.carrier_trunks(active);
CREATE INDEX idx_rate_deck_carrier_trunk ON routing.rate_deck(carrier_trunk_id);
CREATE INDEX idx_rate_deck_prefix ON routing.rate_deck(prefix);
CREATE INDEX idx_rate_deck_effective ON routing.rate_deck(effective_date);
CREATE INDEX idx_partitions_name ON routing.partitions(name);
CREATE INDEX idx_account_partitions_account ON routing.account_partitions(account_id);
CREATE INDEX idx_emergency_routes_location ON routing.emergency_routes(country, state, rate_center);
CREATE INDEX idx_blacklist_value ON routing.blacklist(block_type, block_value);

-- Triggers
CREATE TRIGGER update_trunks_updated_at BEFORE UPDATE ON routing.trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outbound_routes_updated_at BEFORE UPDATE ON routing.outbound_routes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carriers_updated_at BEFORE UPDATE ON routing.carriers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carrier_trunks_updated_at BEFORE UPDATE ON routing.carrier_trunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_deck_updated_at BEFORE UPDATE ON routing.rate_deck
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for LCR calculation
CREATE OR REPLACE FUNCTION routing.calculate_lcr(
    p_destination VARCHAR(20),
    p_partition_id UUID,
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    carrier_trunk_id UUID,
    carrier_name VARCHAR(255),
    rate DECIMAL(10,6),
    quality_score DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH partition_trunks AS (
        SELECT unnest(carrier_trunk_ids) AS trunk_id
        FROM routing.partitions
        WHERE id = p_partition_id
    ),
    matching_rates AS (
        SELECT 
            rd.carrier_trunk_id,
            c.name as carrier_name,
            rd.rate,
            rd.asr,
            rd.acd,
            rd.pdd,
            length(rd.prefix) as prefix_length
        FROM routing.rate_deck rd
        JOIN routing.carrier_trunks ct ON rd.carrier_trunk_id = ct.id
        JOIN routing.carriers c ON ct.carrier_id = c.id
        WHERE p_destination LIKE rd.prefix || '%'
        AND rd.active = TRUE
        AND ct.active = TRUE
        AND c.active = TRUE
        AND rd.effective_date <= CURRENT_DATE
        AND (rd.expires_date IS NULL OR rd.expires_date >= CURRENT_DATE)
        AND ct.id IN (SELECT trunk_id FROM partition_trunks)
    )
    SELECT 
        carrier_trunk_id,
        carrier_name,
        rate,
        -- Quality score calculation
        CASE 
            WHEN asr IS NOT NULL AND acd IS NOT NULL AND pdd IS NOT NULL THEN
                (COALESCE(asr, 50) / 100.0 * 0.4 + 
                 LEAST(COALESCE(acd, 60) / 300.0, 1) * 0.4 +
                 (1 - LEAST(COALESCE(pdd, 5) / 10.0, 1)) * 0.2) * 100
            ELSE 50.00
        END as quality_score
    FROM matching_rates
    ORDER BY prefix_length DESC, rate ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;