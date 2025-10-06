-- Call Detail Records (CDR) Schema
-- Handles voice CDRs with all enrichment data

-- Raw CDR table (before enrichment)
CREATE TABLE cdr.raw_cdr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Kamailio session identifiers
    sip_call_id VARCHAR(255) NOT NULL,
    sip_from_tag VARCHAR(128),
    sip_to_tag VARCHAR(128),
    
    -- Account/trunk info
    account_id UUID REFERENCES accounts.accounts(id),
    trunk_id UUID REFERENCES routing.trunks(id),
    
    -- Call parties (raw from SIP)
    from_uri VARCHAR(500),
    to_uri VARCHAR(500),
    contact_uri VARCHAR(500),
    
    -- SIP pseudo-variables from Kamailio
    sip_from VARCHAR(255),       -- $fu
    sip_rpid VARCHAR(255),       -- $rpid  
    sip_pai VARCHAR(255),        -- $pai (P-Asserted-Identity)
    sip_pci VARCHAR(255),        -- $pci (P-Charge-Info)
    sip_ruri VARCHAR(255),       -- $ru (Request URI)
    sip_contact VARCHAR(255),    -- $ct
    
    -- Basic call info
    direction call_direction,
    ani VARCHAR(32), -- Calling number
    dnis VARCHAR(32), -- Called number
    
    -- Timestamps
    setup_time TIMESTAMPTZ NOT NULL,
    ring_time TIMESTAMPTZ,
    answer_time TIMESTAMPTZ,
    hangup_time TIMESTAMPTZ,
    
    -- Durations (in seconds)
    duration INTEGER DEFAULT 0,
    billable_duration INTEGER DEFAULT 0,
    ring_duration INTEGER DEFAULT 0,
    
    -- Termination info
    sip_code INTEGER,
    sip_reason VARCHAR(255),
    hangup_cause VARCHAR(100),
    hangup_source VARCHAR(50), -- CALLER, CALLEE, SYSTEM
    
    -- Media info
    codec_offer TEXT[],
    codec_answer VARCHAR(50),
    media_ip_local INET,
    media_ip_remote INET,
    rtp_stats JSONB, -- Packet loss, jitter, etc.
    
    -- Routing decision
    selected_carrier_id UUID REFERENCES routing.carriers(id),
    selected_trunk_id UUID REFERENCES routing.carrier_trunks(id),
    routing_partition VARCHAR(50),
    attempts INTEGER DEFAULT 1,
    
    -- Processing flags
    enriched BOOLEAN DEFAULT FALSE,
    rated BOOLEAN DEFAULT FALSE,
    billed BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enriched CDR table (after LRN/LERG/rating)
CREATE TABLE cdr.enriched_cdr (
    id UUID PRIMARY KEY REFERENCES cdr.raw_cdr(id),
    
    -- Enriched number info
    ani_lrn VARCHAR(32), -- After LRN dip
    dnis_lrn VARCHAR(32),
    
    -- LERG data for origination
    orig_rate_center VARCHAR(100),
    orig_state VARCHAR(2),
    orig_lata VARCHAR(5),
    orig_ocn VARCHAR(4),
    orig_carrier_name VARCHAR(255),
    
    -- LERG data for termination
    term_rate_center VARCHAR(100),
    term_state VARCHAR(2),
    term_lata VARCHAR(5),
    term_ocn VARCHAR(4),
    term_carrier_name VARCHAR(255),
    
    -- Jurisdiction determination
    jurisdiction VARCHAR(20), -- INTERSTATE, INTRASTATE, INTERNATIONAL, LOCAL
    orig_country VARCHAR(3),
    term_country VARCHAR(3),
    
    -- Toll-free specific (if applicable)
    toll_free_resp_org VARCHAR(10),
    toll_free_vanity VARCHAR(20),
    
    -- Rating information
    customer_rate DECIMAL(10,6),
    customer_rate_increment INTEGER,
    customer_amount DECIMAL(10,4),
    
    vendor_rate DECIMAL(10,6),
    vendor_rate_increment INTEGER,
    vendor_amount DECIMAL(10,4),
    
    margin_amount DECIMAL(10,4),
    margin_percentage DECIMAL(5,2),
    
    -- Billing increments applied
    billed_duration INTEGER, -- After increment rounding
    
    -- Quality metrics
    pdd DECIMAL(8,3), -- Post-dial delay in seconds
    mos_score DECIMAL(3,2), -- Mean Opinion Score if available
    
    -- Enrichment metadata
    enriched_at TIMESTAMPTZ DEFAULT NOW(),
    lrn_provider VARCHAR(50),
    lrn_dip_time_ms INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CDR summary for fast queries (hourly aggregates)
CREATE TABLE cdr.hourly_summary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Time bucket
    hour_bucket TIMESTAMPTZ NOT NULL,
    
    -- Call counts
    total_calls INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    
    -- Duration metrics
    total_duration INTEGER DEFAULT 0,
    total_billable_duration INTEGER DEFAULT 0,
    
    -- Direction breakdown
    inbound_calls INTEGER DEFAULT 0,
    outbound_calls INTEGER DEFAULT 0,
    inbound_duration INTEGER DEFAULT 0,
    outbound_duration INTEGER DEFAULT 0,
    
    -- Financial
    total_customer_amount DECIMAL(12,2) DEFAULT 0.00,
    total_vendor_amount DECIMAL(12,2) DEFAULT 0.00,
    total_margin DECIMAL(12,2) DEFAULT 0.00,
    
    -- Quality metrics
    asr DECIMAL(5,2), -- Answer-Seizure Ratio
    acd DECIMAL(8,2), -- Average Call Duration
    avg_pdd DECIMAL(8,3), -- Average PDD
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, hour_bucket)
);

-- Failed call tracking
CREATE TABLE cdr.failed_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_cdr_id UUID REFERENCES cdr.raw_cdr(id),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Failure details
    failure_stage VARCHAR(50), -- ROUTING, CARRIER, MEDIA, etc.
    sip_code INTEGER,
    sip_reason VARCHAR(255),
    internal_cause VARCHAR(100),
    
    -- What was attempted
    attempted_number VARCHAR(32),
    attempted_carrier VARCHAR(255),
    
    -- For troubleshooting
    sip_callid VARCHAR(255),
    pcap_filename VARCHAR(255), -- If we captured packets
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor CDRs (for reconciliation)
CREATE TABLE cdr.vendor_cdr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrier_id UUID REFERENCES routing.carriers(id),
    
    -- Their reference
    vendor_cdr_id VARCHAR(255),
    vendor_call_id VARCHAR(255),
    
    -- Our reference
    our_call_id VARCHAR(255),
    raw_cdr_id UUID REFERENCES cdr.raw_cdr(id),
    
    -- Call details from vendor
    start_time TIMESTAMPTZ,
    duration INTEGER,
    billable_duration INTEGER,
    
    from_number VARCHAR(32),
    to_number VARCHAR(32),
    
    -- Their billing
    rate DECIMAL(10,6),
    amount DECIMAL(10,4),
    
    -- Reconciliation
    matched BOOLEAN DEFAULT FALSE,
    discrepancy_flag BOOLEAN DEFAULT FALSE,
    discrepancy_reason VARCHAR(255),
    
    -- Raw record for debugging
    raw_record JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_raw_cdr_account_id ON cdr.raw_cdr(account_id);
CREATE INDEX idx_raw_cdr_setup_time ON cdr.raw_cdr(setup_time);
CREATE INDEX idx_raw_cdr_sip_call_id ON cdr.raw_cdr(sip_call_id);
CREATE INDEX idx_raw_cdr_ani_dnis ON cdr.raw_cdr(ani, dnis);
CREATE INDEX idx_raw_cdr_direction ON cdr.raw_cdr(direction);
CREATE INDEX idx_raw_cdr_enriched ON cdr.raw_cdr(enriched) WHERE enriched = FALSE;

CREATE INDEX idx_enriched_cdr_jurisdiction ON cdr.enriched_cdr(jurisdiction);
CREATE INDEX idx_enriched_cdr_created ON cdr.enriched_cdr(created_at);

CREATE INDEX idx_hourly_summary_lookup ON cdr.hourly_summary(account_id, hour_bucket);
CREATE INDEX idx_failed_calls_account ON cdr.failed_calls(account_id);
CREATE INDEX idx_vendor_cdr_lookup ON cdr.vendor_cdr(carrier_id, vendor_cdr_id);

-- Partitioning for raw_cdr (by month)
-- This is PostgreSQL 11+ declarative partitioning
CREATE TABLE cdr.raw_cdr_2025_01 PARTITION OF cdr.raw_cdr
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE cdr.raw_cdr_2025_02 PARTITION OF cdr.raw_cdr
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- Function to auto-create monthly partitions
CREATE OR REPLACE FUNCTION cdr.create_monthly_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
    end_date := start_date + interval '1 month';
    partition_name := 'raw_cdr_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS cdr.%I PARTITION OF cdr.raw_cdr FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate hourly summaries
CREATE OR REPLACE FUNCTION cdr.calculate_hourly_summary(p_hour TIMESTAMPTZ)
RETURNS void AS $$
BEGIN
    INSERT INTO cdr.hourly_summary (
        account_id, hour_bucket,
        total_calls, completed_calls, failed_calls,
        total_duration, total_billable_duration,
        inbound_calls, outbound_calls,
        inbound_duration, outbound_duration,
        total_customer_amount, total_vendor_amount, total_margin,
        asr, acd, avg_pdd
    )
    SELECT 
        r.account_id,
        date_trunc('hour', p_hour) as hour_bucket,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN r.answer_time IS NOT NULL THEN 1 END) as completed_calls,
        COUNT(CASE WHEN r.answer_time IS NULL THEN 1 END) as failed_calls,
        COALESCE(SUM(r.duration), 0) as total_duration,
        COALESCE(SUM(r.billable_duration), 0) as total_billable_duration,
        COUNT(CASE WHEN r.direction = 'TERMINATING' THEN 1 END) as inbound_calls,
        COUNT(CASE WHEN r.direction = 'ORIGINATING' THEN 1 END) as outbound_calls,
        COALESCE(SUM(CASE WHEN r.direction = 'TERMINATING' THEN r.duration END), 0) as inbound_duration,
        COALESCE(SUM(CASE WHEN r.direction = 'ORIGINATING' THEN r.duration END), 0) as outbound_duration,
        COALESCE(SUM(e.customer_amount), 0) as total_customer_amount,
        COALESCE(SUM(e.vendor_amount), 0) as total_vendor_amount,
        COALESCE(SUM(e.margin_amount), 0) as total_margin,
        CASE WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN r.answer_time IS NOT NULL THEN 1 END)::DECIMAL / COUNT(*)::DECIMAL * 100)
            ELSE 0 
        END as asr,
        AVG(CASE WHEN r.answer_time IS NOT NULL THEN r.duration END) as acd,
        AVG(e.pdd) as avg_pdd
    FROM cdr.raw_cdr r
    LEFT JOIN cdr.enriched_cdr e ON r.id = e.id
    WHERE r.setup_time >= date_trunc('hour', p_hour)
    AND r.setup_time < date_trunc('hour', p_hour) + interval '1 hour'
    GROUP BY r.account_id
    ON CONFLICT (account_id, hour_bucket) DO UPDATE SET
        total_calls = EXCLUDED.total_calls,
        completed_calls = EXCLUDED.completed_calls,
        failed_calls = EXCLUDED.failed_calls,
        total_duration = EXCLUDED.total_duration,
        total_billable_duration = EXCLUDED.total_billable_duration,
        inbound_calls = EXCLUDED.inbound_calls,
        outbound_calls = EXCLUDED.outbound_calls,
        inbound_duration = EXCLUDED.inbound_duration,
        outbound_duration = EXCLUDED.outbound_duration,
        total_customer_amount = EXCLUDED.total_customer_amount,
        total_vendor_amount = EXCLUDED.total_vendor_amount,
        total_margin = EXCLUDED.total_margin,
        asr = EXCLUDED.asr,
        acd = EXCLUDED.acd,
        avg_pdd = EXCLUDED.avg_pdd;
END;
$$ LANGUAGE plpgsql;