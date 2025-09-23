-- Phone Number Inventory and Management Schema
-- Handles DIDs, toll-free numbers, number porting, and carrier inventory

-- Number inventory (all available numbers)
CREATE TABLE numbers.inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number VARCHAR(20) UNIQUE NOT NULL, -- E.164 format
    
    -- Number classification
    number_type number_type DEFAULT 'DID',
    country_code VARCHAR(3) NOT NULL,
    npa VARCHAR(3), -- Area code
    nxx VARCHAR(3), -- Exchange
    
    -- Location information
    rate_center VARCHAR(100),
    state VARCHAR(2),
    lata VARCHAR(5),
    ocn VARCHAR(4), -- Operating Company Number
    
    -- Carrier information
    carrier_id UUID REFERENCES vendor_mgmt.carriers(id),
    vendor_number_id VARCHAR(100), -- Vendor's ID for the number
    monthly_cost DECIMAL(10,4) DEFAULT 0.00,
    setup_fee DECIMAL(10,4) DEFAULT 0.00,
    
    -- Features
    sms_enabled BOOLEAN DEFAULT FALSE,
    mms_enabled BOOLEAN DEFAULT FALSE,
    voice_enabled BOOLEAN DEFAULT TRUE,
    fax_enabled BOOLEAN DEFAULT FALSE,
    
    -- Status
    status number_status DEFAULT 'AVAILABLE',
    reserved_until TIMESTAMPTZ,
    reserved_by UUID REFERENCES accounts.accounts(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customer assigned numbers (DIDs)
CREATE TABLE numbers.dids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE RESTRICT,
    number VARCHAR(20) UNIQUE NOT NULL REFERENCES numbers.inventory(number),
    
    -- Configuration
    friendly_name VARCHAR(255),
    description TEXT,
    
    -- Features
    sms_enabled BOOLEAN DEFAULT FALSE,
    mms_enabled BOOLEAN DEFAULT FALSE,
    voice_enabled BOOLEAN DEFAULT TRUE,
    fax_enabled BOOLEAN DEFAULT FALSE,
    
    -- Routing (for inbound)
    voice_routing_type VARCHAR(50), -- SIP_URI, FORWARD, IVR, QUEUE
    voice_destination VARCHAR(500),
    voice_failover_destination VARCHAR(500),
    
    -- Emergency services
    e911_enabled BOOLEAN DEFAULT FALSE,
    e911_address_id UUID, -- References e911_addresses table
    
    -- CNAM (Caller ID Name)
    cnam_enabled BOOLEAN DEFAULT FALSE,
    cnam_display_name VARCHAR(15), -- Max 15 chars per spec
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    
    -- Billing
    monthly_charge DECIMAL(10,2),
    billing_start_date DATE,
    billing_end_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Toll-free numbers (special handling)
CREATE TABLE numbers.toll_free (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id) ON DELETE RESTRICT,
    number VARCHAR(20) UNIQUE NOT NULL REFERENCES numbers.inventory(number),
    
    -- RespOrg information
    resp_org_id VARCHAR(10) NOT NULL, -- SOMOS RespOrg ID
    resp_org_change_date DATE,
    
    -- Vanity information
    vanity_pattern VARCHAR(20), -- Like 1-800-FLOWERS
    is_vanity BOOLEAN DEFAULT FALSE,
    
    -- Special routing
    time_of_day_routing JSONB DEFAULT '{}', -- Complex routing rules
    geo_routing JSONB DEFAULT '{}', -- Route by caller location
    percentage_routing JSONB DEFAULT '{}', -- A/B testing
    
    -- Status from SOMOS
    somos_status VARCHAR(50),
    somos_last_updated TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Number porting requests
CREATE TABLE numbers.port_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Port details
    port_type VARCHAR(20) NOT NULL, -- PORT_IN, PORT_OUT
    requested_foc_date DATE,
    actual_foc_date DATE,
    
    -- Carrier information
    losing_carrier VARCHAR(100),
    losing_carrier_ocn VARCHAR(4),
    winning_carrier VARCHAR(100),
    winning_carrier_ocn VARCHAR(4),
    
    -- Authorization
    authorized_person VARCHAR(255) NOT NULL,
    authorized_person_title VARCHAR(100),
    
    -- Status tracking
    status port_status DEFAULT 'PENDING',
    lsr_id VARCHAR(100), -- Local Service Request ID
    pon VARCHAR(100), -- Port Order Number
    
    -- Documents
    loa_document_id UUID REFERENCES accounts.documents(id),
    csr_document_id UUID REFERENCES accounts.documents(id),
    bill_document_id UUID REFERENCES accounts.documents(id),
    
    -- Rejection handling
    rejection_reason TEXT,
    rejection_count INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Numbers in a port request
CREATE TABLE numbers.port_request_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    port_request_id UUID NOT NULL REFERENCES numbers.port_requests(id) ON DELETE CASCADE,
    number VARCHAR(20) NOT NULL,
    
    -- BTN (Billing Telephone Number) info
    is_btn BOOLEAN DEFAULT FALSE,
    btn VARCHAR(20),
    
    -- Current service info
    current_provider VARCHAR(100),
    account_number VARCHAR(100),
    pin_passcode VARCHAR(50),
    
    -- Status
    ported_successfully BOOLEAN,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- E911 addresses
CREATE TABLE numbers.e911_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Address information
    name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    country VARCHAR(2) DEFAULT 'US',
    
    -- Additional info for emergency services
    location_info VARCHAR(255), -- Floor, Suite, etc.
    
    -- Validation
    validated BOOLEAN DEFAULT FALSE,
    validation_date TIMESTAMPTZ,
    msag_valid BOOLEAN, -- Master Street Address Guide
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Number usage history (for billing)
CREATE TABLE numbers.usage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    number VARCHAR(20) NOT NULL,
    
    -- Usage period
    usage_month DATE NOT NULL,
    
    -- Metrics
    days_active INTEGER NOT NULL,
    voice_minutes_inbound BIGINT DEFAULT 0,
    voice_minutes_outbound BIGINT DEFAULT 0,
    sms_inbound_count BIGINT DEFAULT 0,
    sms_outbound_count BIGINT DEFAULT 0,
    mms_inbound_count BIGINT DEFAULT 0,
    mms_outbound_count BIGINT DEFAULT 0,
    
    -- Charges
    monthly_charge DECIMAL(10,2),
    usage_charges DECIMAL(10,2),
    total_charge DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, number, usage_month)
);

-- Number search cache (for fast availability searches)
CREATE TABLE numbers.search_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    search_type VARCHAR(50) NOT NULL, -- AREA_CODE, RATE_CENTER, CONTAINS, TOLL_FREE_PREFIX
    search_value VARCHAR(100) NOT NULL,
    
    -- Results
    available_count INTEGER DEFAULT 0,
    numbers JSONB DEFAULT '[]', -- Array of available numbers
    
    -- Cache management
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
    
    UNIQUE(search_type, search_value)
);

-- Indexes
CREATE INDEX idx_inventory_status ON numbers.inventory(status);
CREATE INDEX idx_inventory_number_type ON numbers.inventory(number_type);
CREATE INDEX idx_inventory_npa_nxx ON numbers.inventory(npa, nxx);
CREATE INDEX idx_inventory_rate_center ON numbers.inventory(rate_center);
CREATE INDEX idx_inventory_carrier ON numbers.inventory(carrier_id);
CREATE INDEX idx_dids_account_id ON numbers.dids(account_id);
CREATE INDEX idx_dids_active ON numbers.dids(active);
CREATE INDEX idx_toll_free_account_id ON numbers.toll_free(account_id);
CREATE INDEX idx_port_requests_account_id ON numbers.port_requests(account_id);
CREATE INDEX idx_port_requests_status ON numbers.port_requests(status);
CREATE INDEX idx_port_request_numbers_port_id ON numbers.port_request_numbers(port_request_id);
CREATE INDEX idx_e911_addresses_account_id ON numbers.e911_addresses(account_id);
CREATE INDEX idx_usage_history_account_number_month ON numbers.usage_history(account_id, number, usage_month);
CREATE INDEX idx_search_cache_expires ON numbers.search_cache(expires_at);

-- Triggers
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON numbers.inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dids_updated_at BEFORE UPDATE ON numbers.dids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_toll_free_updated_at BEFORE UPDATE ON numbers.toll_free
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_port_requests_updated_at BEFORE UPDATE ON numbers.port_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_e911_addresses_updated_at BEFORE UPDATE ON numbers.e911_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reserve a number
CREATE OR REPLACE FUNCTION numbers.reserve_number(
    p_number VARCHAR(20),
    p_account_id UUID,
    p_duration INTERVAL DEFAULT '15 minutes'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE numbers.inventory
    SET status = 'RESERVED',
        reserved_by = p_account_id,
        reserved_until = NOW() + p_duration
    WHERE number = p_number
    AND status = 'AVAILABLE';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired reservations
CREATE OR REPLACE FUNCTION numbers.cleanup_expired_reservations()
RETURNS void AS $$
BEGIN
    UPDATE numbers.inventory
    SET status = 'AVAILABLE',
        reserved_by = NULL,
        reserved_until = NULL
    WHERE status = 'RESERVED'
    AND reserved_until < NOW();
END;
$$ LANGUAGE plpgsql;