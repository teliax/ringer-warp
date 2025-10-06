-- WARP Platform CDR Schema
-- Version: 1.0
-- Description: Complete CDR schema for voice, SMS/MMS, and API usage tracking

-- Create billing schema
CREATE SCHEMA IF NOT EXISTS billing;

-- =====================================================
-- RAW CDR TABLE (From Kamailio Routing Engine)
-- =====================================================
CREATE TABLE billing.raw_cdr (
  -- Primary Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sip_uuid VARCHAR(128) NOT NULL,           -- Unique SIP session identifier
  sip_callid VARCHAR(128) NOT NULL,         -- SIP Call-ID header
  
  -- Timestamps (from Kamailio)
  start_stamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  progress_stamp TIMESTAMP WITH TIME ZONE,  -- 180/183 response time
  answer_stamp TIMESTAMP WITH TIME ZONE,    -- 200 OK time
  end_stamp TIMESTAMP WITH TIME ZONE,       -- BYE time
  
  -- Customer Information
  customer_ban VARCHAR(50) NOT NULL,        -- Billing Account Number
  trunk_id VARCHAR(50),                     -- SIP trunk identifier
  
  -- SIP Headers (Raw Kamailio Pseudo Variables)
  sip_from VARCHAR(255),                    -- $fu - From URI
  sip_from_display VARCHAR(255),            -- $fn - From display name
  sip_rpid VARCHAR(255),                    -- $rpid - Remote-Party-ID
  sip_contact VARCHAR(255),                 -- $ct - Contact header
  sip_ruri VARCHAR(255),                    -- $ru - Request-URI
  sip_pai VARCHAR(255),                     -- P-Asserted-Identity
  sip_pci VARCHAR(255),                     -- P-Charge-Info
  sip_diversion VARCHAR(255),               -- Diversion header
  
  -- Call Party Information
  raw_ani VARCHAR(24),                      -- Calling number (raw from SIP)
  dni VARCHAR(24) NOT NULL,                 -- Called number
  
  -- Call Type and Direction
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('TERMINATING', 'ORIGINATING')),
  call_type VARCHAR(20),                    -- Set by poller: DOMESTIC, TOLLFREE, INTERNATIONAL
  
  -- Routing Information (from routing engine)
  routing_partition VARCHAR(20),            -- PREMIUM, ECONOMY, etc.
  selected_vendor VARCHAR(50),              -- Vendor selected for termination
  vendor_trunk VARCHAR(50),                 -- Specific vendor trunk used
  dialstring VARCHAR(100),                  -- Actual dialstring sent to vendor
  
  -- Basic Call Metrics
  raw_seconds INTEGER,                      -- Raw call duration
  sip_response_code INTEGER,                -- Final SIP response code
  disposition VARCHAR(20),                  -- ANSWERED, BUSY, FAILED, NO_ANSWER, CANCEL
  release_cause VARCHAR(100),               -- Q.850 release cause
  
  -- Network Information
  orig_ip INET,                            -- Originating IP address
  orig_port INTEGER,                        -- Originating port
  egress_ip INET,                          -- Egress IP (to vendor)
  egress_port INTEGER,                      -- Egress port
  
  -- Media Information
  codec VARCHAR(20),                        -- G711, G729, etc.
  
  -- Fields to be populated by Poller
  -- ANI LRN/LERG Data (Calling Party - NANPA calls only)
  ani_lrn BIGINT,                          -- ANI Local Routing Number
  ani_spid VARCHAR(10),                    -- ANI Service Provider ID
  ani_lata INTEGER,                        -- ANI LATA code
  ani_ocn VARCHAR(10),                     -- ANI Operating Company Number
  ani_rate_center VARCHAR(50),             -- ANI Rate center name
  ani_state VARCHAR(2),                    -- ANI State code
  ani_carrier_name VARCHAR(100),           -- ANI Carrier name from LERG
  
  -- DNI LRN/LERG Data (Called Party - NANPA calls only)  
  dni_lrn BIGINT,                          -- DNI Local Routing Number
  dni_spid VARCHAR(10),                    -- DNI Service Provider ID
  dni_lata INTEGER,                        -- DNI LATA code
  dni_ocn VARCHAR(10),                     -- DNI Operating Company Number
  dni_rate_center VARCHAR(50),             -- DNI Rate center name
  dni_state VARCHAR(2),                    -- DNI State code
  dni_carrier_name VARCHAR(100),           -- DNI Carrier name from LERG
  
  -- Toll-Free Data (applies to DNI for toll-free calls)
  ror_id VARCHAR(20),                      -- RespOrg ID (toll-free only)
  ror_name VARCHAR(100),                   -- RespOrg name
  
  -- Jurisdiction (calculated by poller based on ANI/DNI comparison)
  jurisdiction VARCHAR(20),                -- INTERSTATE, INTRASTATE, LOCAL
  rate_zone VARCHAR(50),                   -- Final zone for rating
  
  -- Rating Fields (populated by poller)
  customer_rate NUMERIC(10,7),             -- Rate charged to customer
  vendor_cost NUMERIC(10,7),               -- Cost from vendor
  margin NUMERIC(10,7),                    -- Profit margin
  margin_percentage NUMERIC(5,2),          -- Margin as percentage
  billed_seconds INTEGER,                  -- Billable seconds (after increment)
  billing_increment INTEGER,                -- 1 or 6 second increment
  total_charge NUMERIC(12,5),              -- Total charge to customer
  
  -- Processing Flags
  enriched BOOLEAN DEFAULT FALSE,          -- Has been enriched by poller
  rated BOOLEAN DEFAULT FALSE,             -- Has been rated
  exported_to_bq BOOLEAN DEFAULT FALSE,    -- Exported to BigQuery
  exported_to_ns BOOLEAN DEFAULT FALSE,    -- Exported to NetSuite
  billed BOOLEAN DEFAULT FALSE,            -- Included in invoice
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,                  -- When poller processed
  
  -- Constraints
  CONSTRAINT valid_disposition CHECK (
    disposition IN ('ANSWERED', 'BUSY', 'FAILED', 'NO_ANSWER', 'CANCEL')
  ),
  CONSTRAINT valid_direction CHECK (
    direction IN ('TERMINATING', 'ORIGINATING')
  )
);

-- Indexes for efficient querying
CREATE INDEX idx_raw_cdr_processing ON billing.raw_cdr (enriched, rated, created_at) 
  WHERE NOT enriched OR NOT rated;
CREATE INDEX idx_raw_cdr_customer ON billing.raw_cdr (customer_ban, start_stamp);
CREATE INDEX idx_raw_cdr_sip ON billing.raw_cdr (sip_uuid, sip_callid);
CREATE INDEX idx_raw_cdr_billing ON billing.raw_cdr (customer_ban, billed, start_stamp) 
  WHERE NOT billed;

-- =====================================================
-- VENDOR CDR TABLE (Performance Tracking)
-- =====================================================
CREATE TABLE billing.vendor_cdr (
  -- Primary Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_cdr_id UUID,                    -- Reference to customer CDR
  sip_uuid VARCHAR(128) NOT NULL,
  sip_callid VARCHAR(128),
  
  -- Vendor Information
  vendor_name VARCHAR(50) NOT NULL,
  vendor_trunk VARCHAR(50),
  vendor_gateway VARCHAR(100),             -- Specific gateway used
  
  -- Attempt Information
  attempt_number INTEGER NOT NULL DEFAULT 1,
  attempt_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Call Timestamps
  start_stamp TIMESTAMP WITH TIME ZONE,
  progress_stamp TIMESTAMP WITH TIME ZONE,
  answer_stamp TIMESTAMP WITH TIME ZONE,
  end_stamp TIMESTAMP WITH TIME ZONE,
  
  -- Call Details
  ani VARCHAR(24),
  dni VARCHAR(24),
  modified_dni VARCHAR(24),                -- DNI after manipulation
  
  -- Call Metrics
  duration_seconds INTEGER,
  billed_seconds INTEGER,
  pdd_ms INTEGER,                          -- Post-Dial Delay in milliseconds
  
  -- Call Result
  disposition VARCHAR(20),
  sip_response_code INTEGER,
  q850_cause INTEGER,
  failure_reason TEXT,
  
  -- Quality Metrics
  mos_score NUMERIC(3,2),                  -- Mean Opinion Score (1.0-5.0)
  r_factor NUMERIC(5,2),                   -- R-factor (0-100)
  packet_loss_percentage NUMERIC(5,2),
  jitter_ms INTEGER,
  rtp_packets_sent BIGINT,
  rtp_packets_received BIGINT,
  rtp_packets_lost BIGINT,
  
  -- Cost Information
  vendor_rate NUMERIC(10,7),
  vendor_cost NUMERIC(12,5),
  vendor_currency VARCHAR(3) DEFAULT 'USD',
  
  -- Network Information
  signaling_ip INET,
  media_ip INET,
  codec_used VARCHAR(20),
  
  -- Processing
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for vendor CDR
CREATE INDEX idx_vendor_cdr_customer ON billing.vendor_cdr (customer_cdr_id);
CREATE INDEX idx_vendor_cdr_vendor ON billing.vendor_cdr (vendor_name, start_stamp);
CREATE INDEX idx_vendor_cdr_performance ON billing.vendor_cdr (vendor_name, mos_score, packet_loss_percentage);

-- =====================================================
-- SMS/MMS MDR TABLE (Message Detail Records)
-- =====================================================
CREATE TABLE billing.message_records (
  -- Primary Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_uuid VARCHAR(128) NOT NULL UNIQUE,
  jasmin_message_id VARCHAR(100),          -- ID from Jasmin SMPP
  
  -- Timestamps
  submit_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  delivery_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Customer Information
  customer_ban VARCHAR(50) NOT NULL,
  campaign_id VARCHAR(50),                 -- 10DLC campaign ID
  
  -- Message Type
  message_type VARCHAR(10) NOT NULL CHECK (message_type IN ('SMS', 'MMS', 'RCS')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
  
  -- Party Information
  from_number VARCHAR(24) NOT NULL,
  to_number VARCHAR(24) NOT NULL,
  
  -- Number Type (for rating)
  number_type VARCHAR(20),                 -- 10DLC, TOLLFREE, SHORTCODE
  
  -- Message Content
  message_body TEXT,
  segments INTEGER DEFAULT 1,              -- Number of SMS segments
  media_urls TEXT[],                       -- Array of media URLs for MMS
  
  -- Delivery Information
  delivery_status VARCHAR(20),             -- DELIVERED, FAILED, PENDING
  delivery_receipt_code VARCHAR(10),
  error_code VARCHAR(20),
  error_message TEXT,
  
  -- Vendor Information
  vendor_name VARCHAR(50),
  vendor_message_id VARCHAR(100),
  
  -- Rating (populated by poller)
  customer_rate NUMERIC(10,5),             -- Rate per segment/message
  vendor_cost NUMERIC(10,5),
  carrier_surcharge NUMERIC(10,5),         -- Carrier fees
  total_charge NUMERIC(12,5),
  
  -- Compliance
  opt_out_compliant BOOLEAN DEFAULT TRUE,
  spam_score NUMERIC(3,2),
  
  -- Processing Flags
  enriched BOOLEAN DEFAULT FALSE,
  rated BOOLEAN DEFAULT FALSE,
  exported_to_bq BOOLEAN DEFAULT FALSE,
  exported_to_ns BOOLEAN DEFAULT FALSE,
  billed BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for message records
CREATE INDEX idx_mdr_customer ON billing.message_records (customer_ban, submit_timestamp);
CREATE INDEX idx_mdr_processing ON billing.message_records (enriched, rated, created_at);
CREATE INDEX idx_mdr_jasmin ON billing.message_records (jasmin_message_id);

-- =====================================================
-- TELCO API USAGE TABLE
-- =====================================================
CREATE TABLE billing.api_usage (
  -- Primary Identifiers
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR(128) NOT NULL UNIQUE,
  
  -- Timestamp
  request_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Customer Information
  customer_ban VARCHAR(50) NOT NULL,
  api_key VARCHAR(100),
  
  -- API Details
  api_type VARCHAR(20) NOT NULL,           -- LRN, CNAM, LERG, CIC, RESPORG
  endpoint VARCHAR(255) NOT NULL,
  http_method VARCHAR(10),
  
  -- Request/Response
  request_payload JSONB,
  response_payload JSONB,
  response_code INTEGER,
  response_time_ms INTEGER,
  
  -- Query Details
  query_number VARCHAR(24),                -- Number queried
  query_count INTEGER DEFAULT 1,           -- For batch queries
  
  -- Rating
  unit_rate NUMERIC(10,5),
  total_charge NUMERIC(10,5),
  
  -- Processing
  exported_to_bq BOOLEAN DEFAULT FALSE,
  exported_to_ns BOOLEAN DEFAULT FALSE,
  billed BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for API usage
CREATE INDEX idx_api_usage_customer ON billing.api_usage (customer_ban, request_timestamp);
CREATE INDEX idx_api_usage_billing ON billing.api_usage (customer_ban, billed, request_timestamp);

-- =====================================================
-- RATE DECK TABLES
-- =====================================================

-- Customer Rate Deck
CREATE TABLE billing.customer_rate_deck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_ban VARCHAR(50) NOT NULL,
  
  -- Rate Key Components
  direction VARCHAR(20) NOT NULL,
  call_type VARCHAR(20) NOT NULL,
  jurisdiction VARCHAR(20),
  npanxx VARCHAR(6),                       -- For NPANXX-based rating
  country_code VARCHAR(10),                -- For international
  
  -- Rate Information
  rate NUMERIC(10,7) NOT NULL,             -- Per-minute rate
  connect_fee NUMERIC(10,7) DEFAULT 0,     -- Per-call fee
  billing_increment INTEGER DEFAULT 1,      -- 1 or 6 seconds
  minimum_duration INTEGER DEFAULT 0,       -- Minimum billable seconds
  
  -- Validity
  effective_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP,
  
  -- Metadata
  rate_plan_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure unique rate per customer/route/time
  CONSTRAINT unique_customer_rate UNIQUE (
    customer_ban, direction, call_type, jurisdiction, 
    npanxx, country_code, effective_date
  )
);

-- Indexes for rate lookup
CREATE INDEX idx_customer_rate_lookup ON billing.customer_rate_deck 
  (customer_ban, direction, call_type, jurisdiction, npanxx, effective_date DESC);

-- Vendor Rate Deck
CREATE TABLE billing.vendor_rate_deck (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name VARCHAR(50) NOT NULL,
  
  -- Rate Key Components  
  direction VARCHAR(20) NOT NULL,
  call_type VARCHAR(20) NOT NULL,
  jurisdiction VARCHAR(20),
  npanxx VARCHAR(6),
  country_code VARCHAR(10),
  
  -- Cost Information
  cost NUMERIC(10,7) NOT NULL,             -- Per-minute cost
  connect_fee NUMERIC(10,7) DEFAULT 0,
  billing_increment INTEGER DEFAULT 1,
  
  -- Validity
  effective_date TIMESTAMP NOT NULL,
  expiry_date TIMESTAMP,
  
  -- Metadata
  contract_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for vendor cost lookup
CREATE INDEX idx_vendor_rate_lookup ON billing.vendor_rate_deck 
  (vendor_name, direction, call_type, jurisdiction, npanxx, effective_date DESC);

-- =====================================================
-- BIGQUERY EXPORT TABLE (for tracking exports)
-- =====================================================
CREATE TABLE billing.bigquery_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Export Details
  record_type VARCHAR(20) NOT NULL,        -- CDR, MDR, API_USAGE
  record_count INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  
  -- BigQuery Details
  dataset_name VARCHAR(100) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  job_id VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- NETSUITE EXPORT TABLE (for tracking NetSuite sync)
-- =====================================================
CREATE TABLE billing.netsuite_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Customer and Period
  customer_ban VARCHAR(50) NOT NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  
  -- Export Details
  line_items JSONB NOT NULL,               -- Array of SKU mappings
  total_amount NUMERIC(12,2) NOT NULL,
  record_count INTEGER NOT NULL,
  
  -- NetSuite Details
  netsuite_record_id VARCHAR(100),
  netsuite_invoice_id VARCHAR(100),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for tracking exports
CREATE INDEX idx_netsuite_exports_customer ON billing.netsuite_exports 
  (customer_ban, billing_period_start, status);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to determine jurisdiction
CREATE OR REPLACE FUNCTION billing.determine_jurisdiction(
  ani_ocn VARCHAR,
  dni_ocn VARCHAR,
  ani_state VARCHAR,
  dni_state VARCHAR,
  ani_lata INTEGER,
  dni_lata INTEGER
) RETURNS VARCHAR AS $$
BEGIN
  -- Same OCN typically means same carrier = Local
  IF ani_ocn IS NOT NULL AND dni_ocn IS NOT NULL AND ani_ocn = dni_ocn THEN
    RETURN 'LOCAL';
  END IF;
  
  -- Same LATA can also indicate local
  IF ani_lata IS NOT NULL AND dni_lata IS NOT NULL AND ani_lata = dni_lata THEN
    RETURN 'LOCAL';
  END IF;
  
  -- Same state = Intrastate
  IF ani_state IS NOT NULL AND dni_state IS NOT NULL AND ani_state = dni_state THEN
    RETURN 'INTRASTATE';
  END IF;
  
  -- Different states = Interstate
  RETURN 'INTERSTATE';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate billable seconds
CREATE OR REPLACE FUNCTION billing.calculate_billable_seconds(
  raw_seconds INTEGER,
  increment INTEGER
) RETURNS INTEGER AS $$
BEGIN
  IF increment = 1 THEN
    RETURN raw_seconds;
  ELSIF increment = 6 THEN
    RETURN CEIL(raw_seconds::NUMERIC / 6) * 6;
  ELSE
    RETURN raw_seconds;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- AUDIT AND MONITORING
-- =====================================================

-- Audit log for all billing operations
CREATE TABLE billing.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Operation Details
  operation VARCHAR(50) NOT NULL,          -- RATE_CDR, EXPORT_BQ, EXPORT_NS, etc.
  record_type VARCHAR(20),                 -- CDR, MDR, API_USAGE
  record_id UUID,
  
  -- Context
  customer_ban VARCHAR(50),
  user_id VARCHAR(100),
  service_name VARCHAR(50),                -- Which service performed operation
  
  -- Result
  success BOOLEAN NOT NULL,
  error_message TEXT,
  
  -- Additional Data
  metadata JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for audit queries
CREATE INDEX idx_audit_log_timestamp ON billing.audit_log (timestamp DESC);
CREATE INDEX idx_audit_log_customer ON billing.audit_log (customer_ban, timestamp DESC);
CREATE INDEX idx_audit_log_errors ON billing.audit_log (success, timestamp DESC) WHERE NOT success;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for unprocessed CDRs
CREATE VIEW billing.unprocessed_cdrs AS
SELECT * FROM billing.raw_cdr
WHERE NOT enriched OR NOT rated
ORDER BY created_at;

-- View for today's usage by customer
CREATE VIEW billing.todays_usage AS
SELECT 
  customer_ban,
  COUNT(*) as call_count,
  SUM(billed_seconds)/60.0 as total_minutes,
  SUM(total_charge) as total_charges,
  AVG(margin_percentage) as avg_margin
FROM billing.raw_cdr
WHERE DATE(start_stamp) = CURRENT_DATE
  AND rated = TRUE
GROUP BY customer_ban;

-- View for vendor performance
CREATE VIEW billing.vendor_performance AS
SELECT 
  vendor_name,
  DATE(start_stamp) as call_date,
  COUNT(*) as total_attempts,
  COUNT(CASE WHEN disposition = 'ANSWERED' THEN 1 END) as successful_calls,
  AVG(pdd_ms) as avg_pdd,
  AVG(mos_score) as avg_mos,
  AVG(packet_loss_percentage) as avg_packet_loss,
  SUM(vendor_cost) as total_cost
FROM billing.vendor_cdr
WHERE start_stamp >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY vendor_name, DATE(start_stamp);

-- =====================================================
-- PERMISSIONS
-- =====================================================

-- Create roles
CREATE ROLE billing_reader;
CREATE ROLE billing_writer;
CREATE ROLE billing_admin;

-- Grant permissions
GRANT SELECT ON ALL TABLES IN SCHEMA billing TO billing_reader;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA billing TO billing_writer;
GRANT ALL PRIVILEGES ON SCHEMA billing TO billing_admin;

-- =====================================================
-- MAINTENANCE
-- =====================================================

-- Partition management (if using PostgreSQL 12+)
-- Consider partitioning raw_cdr and vendor_cdr by month for performance

-- Example monthly partition
/*
CREATE TABLE billing.raw_cdr_2025_01 PARTITION OF billing.raw_cdr
FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
*/

-- Regular maintenance tasks
-- 1. Archive old CDRs to cold storage after 90 days
-- 2. Update statistics: ANALYZE billing.raw_cdr;
-- 3. Reindex: REINDEX TABLE billing.raw_cdr;
-- 4. Vacuum: VACUUM ANALYZE billing.raw_cdr;
