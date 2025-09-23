-- Audit and Compliance Schema
-- Handles audit trails, compliance tracking, and system logs

-- Main audit log table
CREATE TABLE audit.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What happened
    event_type VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, LOGIN, API_CALL, etc.
    event_category VARCHAR(50) NOT NULL, -- ACCOUNT, BILLING, ROUTING, SECURITY, etc.
    event_description TEXT,
    
    -- Who did it
    user_id UUID REFERENCES auth.users(id),
    api_key_id UUID REFERENCES auth.api_keys(id),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    
    -- What was affected
    table_name VARCHAR(100),
    record_id UUID,
    
    -- Changes (for updates)
    old_values JSONB,
    new_values JSONB,
    
    -- Result
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API request logs
CREATE TABLE audit.api_request_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request info
    request_id VARCHAR(255) UNIQUE NOT NULL,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(500) NOT NULL,
    query_params JSONB,
    request_headers JSONB,
    request_body TEXT, -- Sanitized
    
    -- Authentication
    auth_type VARCHAR(50), -- JWT, API_KEY, OAUTH
    user_id UUID REFERENCES auth.users(id),
    api_key_id UUID REFERENCES auth.api_keys(id),
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Response
    status_code INTEGER,
    response_time_ms INTEGER,
    response_size_bytes INTEGER,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Errors
    error_type VARCHAR(100),
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configuration changes
CREATE TABLE audit.config_changes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- What changed
    config_type VARCHAR(100) NOT NULL, -- TRUNK, ROUTE, RATE_PLAN, etc.
    config_id UUID NOT NULL,
    config_name VARCHAR(255),
    
    -- Who changed it
    changed_by UUID REFERENCES auth.users(id),
    change_type VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    
    -- Changes
    old_config JSONB,
    new_config JSONB,
    change_summary TEXT,
    
    -- Review/approval
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance records
CREATE TABLE audit.compliance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Compliance type
    compliance_type VARCHAR(100) NOT NULL, -- CPNI, STIR_SHAKEN, 911, TCPA, etc.
    regulation VARCHAR(100) NOT NULL, -- FCC, GDPR, CCPA, etc.
    
    -- What was done
    action VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Evidence
    evidence_type VARCHAR(50), -- CONSENT, CERTIFICATE, REPORT, etc.
    evidence_path VARCHAR(500), -- GCS path
    
    -- Validity
    effective_date DATE NOT NULL,
    expiration_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'COMPLIANT', -- COMPLIANT, NON_COMPLIANT, PENDING
    
    -- Related entities
    account_id UUID REFERENCES accounts.accounts(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- STIR/SHAKEN certificates
CREATE TABLE audit.stir_shaken_certs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Certificate details
    certificate_id VARCHAR(255) UNIQUE NOT NULL,
    service_provider_code VARCHAR(10) NOT NULL,
    
    -- Certificate data
    public_key TEXT NOT NULL,
    private_key_ref VARCHAR(255), -- Secret Manager reference
    certificate_chain TEXT,
    
    -- Validity
    issued_date DATE NOT NULL,
    expiration_date DATE NOT NULL,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    revoked BOOLEAN DEFAULT FALSE,
    revoked_date DATE,
    revoked_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 911 compliance tracking
CREATE TABLE audit.e911_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts.accounts(id),
    
    -- Compliance check
    check_date DATE NOT NULL,
    
    -- Results
    total_dids INTEGER NOT NULL,
    dids_with_e911 INTEGER NOT NULL,
    compliance_percentage DECIMAL(5,2),
    
    -- Non-compliant numbers
    non_compliant_numbers TEXT[],
    
    -- Notifications
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data retention policies
CREATE TABLE audit.retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Policy details
    policy_name VARCHAR(100) UNIQUE NOT NULL,
    data_type VARCHAR(100) NOT NULL, -- CDR, SMS, API_LOGS, etc.
    
    -- Retention period
    retention_days INTEGER NOT NULL,
    
    -- Archive strategy
    archive_enabled BOOLEAN DEFAULT TRUE,
    archive_destination VARCHAR(255), -- GCS bucket
    
    -- Deletion
    delete_after_archive BOOLEAN DEFAULT TRUE,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Data exports (for compliance requests)
CREATE TABLE audit.data_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request details
    request_type VARCHAR(50) NOT NULL, -- GDPR, LAW_ENFORCEMENT, INTERNAL
    requester_name VARCHAR(255),
    requester_email VARCHAR(255),
    
    -- What was exported
    account_id UUID REFERENCES accounts.accounts(id),
    data_types TEXT[], -- CDR, SMS, ACCOUNT_INFO, etc.
    date_range_start DATE,
    date_range_end DATE,
    
    -- Export details
    export_format VARCHAR(20), -- CSV, JSON, PDF
    export_path VARCHAR(500), -- GCS path
    export_size_bytes BIGINT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    
    -- Legal
    legal_basis TEXT,
    approval_required BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ -- When to delete the export
);

-- Security incidents
CREATE TABLE audit.security_incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Incident details
    incident_type VARCHAR(100) NOT NULL, -- BREACH, UNAUTHORIZED_ACCESS, FRAUD, DOS
    severity VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, MEDIUM, LOW
    
    -- Description
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    
    -- Impact
    affected_accounts UUID[], -- Array of affected account IDs
    affected_systems TEXT[],
    data_compromised BOOLEAN DEFAULT FALSE,
    data_types_affected TEXT[],
    
    -- Timeline
    detected_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ,
    contained_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    -- Response
    response_actions TEXT,
    root_cause TEXT,
    
    -- Notifications
    customers_notified BOOLEAN DEFAULT FALSE,
    authorities_notified BOOLEAN DEFAULT FALSE,
    notification_date TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access reviews
CREATE TABLE audit.access_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Review details
    review_type VARCHAR(50) NOT NULL, -- USER_ACCESS, API_KEYS, PERMISSIONS
    review_period VARCHAR(20) NOT NULL, -- QUARTERLY, ANNUAL
    
    -- Scope
    account_id UUID REFERENCES accounts.accounts(id),
    
    -- Results
    total_users INTEGER,
    active_users INTEGER,
    inactive_users INTEGER,
    excessive_permissions INTEGER,
    
    -- Actions taken
    users_deactivated INTEGER DEFAULT 0,
    permissions_revoked INTEGER DEFAULT 0,
    
    -- Review metadata
    reviewed_by UUID REFERENCES auth.users(id),
    review_date DATE NOT NULL,
    next_review_date DATE,
    
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_log_event ON audit.audit_log(event_type, event_category);
CREATE INDEX idx_audit_log_user ON audit.audit_log(user_id);
CREATE INDEX idx_audit_log_account ON audit.audit_log(account_id);
CREATE INDEX idx_audit_log_created ON audit.audit_log(created_at);
CREATE INDEX idx_audit_log_table_record ON audit.audit_log(table_name, record_id);

CREATE INDEX idx_api_request_log_request_id ON audit.api_request_log(request_id);
CREATE INDEX idx_api_request_log_account ON audit.api_request_log(account_id);
CREATE INDEX idx_api_request_log_created ON audit.api_request_log(created_at);
CREATE INDEX idx_api_request_log_path ON audit.api_request_log(path);

CREATE INDEX idx_config_changes_type ON audit.config_changes(config_type, config_id);
CREATE INDEX idx_config_changes_created ON audit.config_changes(created_at);

CREATE INDEX idx_compliance_records_type ON audit.compliance_records(compliance_type);
CREATE INDEX idx_compliance_records_account ON audit.compliance_records(account_id);
CREATE INDEX idx_compliance_records_status ON audit.compliance_records(status);

CREATE INDEX idx_stir_shaken_certs_active ON audit.stir_shaken_certs(active);
CREATE INDEX idx_e911_compliance_account_date ON audit.e911_compliance(account_id, check_date);
CREATE INDEX idx_data_exports_account ON audit.data_exports(account_id);
CREATE INDEX idx_data_exports_status ON audit.data_exports(status);
CREATE INDEX idx_security_incidents_severity ON audit.security_incidents(severity);
CREATE INDEX idx_access_reviews_date ON audit.access_reviews(review_date);

-- Triggers
CREATE TRIGGER update_retention_policies_updated_at BEFORE UPDATE ON audit.retention_policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_incidents_updated_at BEFORE UPDATE ON audit.security_incidents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create generic audit log entries
CREATE OR REPLACE FUNCTION audit.log_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit.audit_log (
        event_type,
        event_category,
        event_description,
        table_name,
        record_id,
        old_values,
        new_values
    ) VALUES (
        TG_OP,
        TG_TABLE_SCHEMA,
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME || ' ' || TG_OP,
        TG_TABLE_NAME,
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.id
            ELSE NEW.id
        END,
        CASE 
            WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD)
            ELSE NULL
        END,
        CASE 
            WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW)
            ELSE NULL
        END
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check compliance status
CREATE OR REPLACE FUNCTION audit.check_e911_compliance(p_account_id UUID)
RETURNS void AS $$
DECLARE
    v_total_dids INTEGER;
    v_compliant_dids INTEGER;
    v_non_compliant TEXT[];
BEGIN
    -- Count total DIDs
    SELECT COUNT(*) INTO v_total_dids
    FROM numbers.dids
    WHERE account_id = p_account_id
    AND active = TRUE;
    
    -- Count compliant DIDs
    SELECT COUNT(*) INTO v_compliant_dids
    FROM numbers.dids
    WHERE account_id = p_account_id
    AND active = TRUE
    AND e911_enabled = TRUE
    AND e911_address_id IS NOT NULL;
    
    -- Get non-compliant numbers
    SELECT ARRAY_AGG(number) INTO v_non_compliant
    FROM numbers.dids
    WHERE account_id = p_account_id
    AND active = TRUE
    AND (e911_enabled = FALSE OR e911_address_id IS NULL);
    
    -- Insert compliance record
    INSERT INTO audit.e911_compliance (
        account_id,
        check_date,
        total_dids,
        dids_with_e911,
        compliance_percentage,
        non_compliant_numbers
    ) VALUES (
        p_account_id,
        CURRENT_DATE,
        v_total_dids,
        v_compliant_dids,
        CASE 
            WHEN v_total_dids > 0 THEN (v_compliant_dids::DECIMAL / v_total_dids::DECIMAL * 100)
            ELSE 100
        END,
        v_non_compliant
    );
END;
$$ LANGUAGE plpgsql;

-- Partitioning for large audit tables
-- API request logs partitioned by month
CREATE TABLE audit.api_request_log_2025_01 PARTITION OF audit.api_request_log
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE audit.api_request_log_2025_02 PARTITION OF audit.api_request_log
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');