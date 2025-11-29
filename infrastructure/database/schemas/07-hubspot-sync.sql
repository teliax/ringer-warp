-- HubSpot Bidirectional Sync Schema
-- Tracks sync state at the attribute level for conflict resolution and reconciliation

-- Sync Operations Log
CREATE TABLE IF NOT EXISTS accounts.hubspot_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entity reference
    entity_type VARCHAR(50) NOT NULL, -- 'customer', 'contact', 'trunk', 'number'
    entity_id UUID NOT NULL,
    hubspot_object_id VARCHAR(100), -- HubSpot's ID for the object

    -- Operation details
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE', 'RECONCILE')),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('WARP_TO_HUBSPOT', 'HUBSPOT_TO_WARP', 'BIDIRECTIONAL')),

    -- Field-level tracking
    fields_synced JSONB NOT NULL DEFAULT '[]',
    -- Example: ["company_name", "status", "credit_limit"]

    field_changes JSONB NOT NULL DEFAULT '{}',
    /* Example:
       {
         "company_name": {"old": "Acme Inc", "new": "Acme Corp", "source": "hubspot"},
         "credit_limit": {"old": 5000, "new": 10000, "source": "warp"}
       }
    */

    -- Sync status
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'CONFLICT')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    -- Metadata
    triggered_by VARCHAR(100), -- 'webhook', 'manual', 'reconciliation', 'api'
    triggered_by_user VARCHAR(100),

    CONSTRAINT fk_hubspot_sync_customer FOREIGN KEY (entity_id)
        REFERENCES accounts.customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_log_entity ON accounts.hubspot_sync_log(entity_type, entity_id);
CREATE INDEX idx_sync_log_status ON accounts.hubspot_sync_log(status);
CREATE INDEX idx_sync_log_started_at ON accounts.hubspot_sync_log(started_at DESC);
CREATE INDEX idx_sync_log_hubspot_id ON accounts.hubspot_sync_log(hubspot_object_id);

-- Field-Level Sync State (Current State)
CREATE TABLE IF NOT EXISTS accounts.hubspot_field_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entity reference
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    hubspot_object_id VARCHAR(100) NOT NULL,

    -- Field details
    field_name VARCHAR(100) NOT NULL,
    field_path VARCHAR(255), -- For JSONB fields: 'contact.email', 'external_ids.hubspot_company_id'

    -- Current values
    warp_value JSONB,
    hubspot_value JSONB,

    -- Last sync info
    last_synced_at TIMESTAMPTZ,
    last_synced_direction VARCHAR(20), -- 'WARP_TO_HUBSPOT', 'HUBSPOT_TO_WARP'
    last_modified_at_warp TIMESTAMPTZ,
    last_modified_at_hubspot TIMESTAMPTZ,

    -- Sync configuration
    sync_direction VARCHAR(20) NOT NULL DEFAULT 'BIDIRECTIONAL'
        CHECK (sync_direction IN ('WARP_TO_HUBSPOT', 'HUBSPOT_TO_WARP', 'BIDIRECTIONAL', 'NONE')),
    conflict_resolution VARCHAR(20) NOT NULL DEFAULT 'LATEST_WINS'
        CHECK (conflict_resolution IN ('WARP_WINS', 'HUBSPOT_WINS', 'LATEST_WINS', 'MANUAL')),

    -- Status
    is_in_conflict BOOLEAN DEFAULT FALSE,
    conflict_detected_at TIMESTAMPTZ,
    conflict_resolved_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(entity_type, entity_id, field_name),
    CONSTRAINT fk_field_state_customer FOREIGN KEY (entity_id)
        REFERENCES accounts.customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_field_state_entity ON accounts.hubspot_field_state(entity_type, entity_id);
CREATE INDEX idx_field_state_hubspot_id ON accounts.hubspot_field_state(hubspot_object_id);
CREATE INDEX idx_field_state_conflicts ON accounts.hubspot_field_state(is_in_conflict) WHERE is_in_conflict = TRUE;
CREATE INDEX idx_field_state_field_name ON accounts.hubspot_field_state(field_name);

-- Sync Queue (for failed/pending syncs)
CREATE TABLE IF NOT EXISTS accounts.hubspot_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Entity reference
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    hubspot_object_id VARCHAR(100),

    -- Queue details
    operation VARCHAR(20) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    payload JSONB NOT NULL,

    -- Priority & scheduling
    priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    max_retries INTEGER DEFAULT 3,
    retry_count INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED'
        CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    last_error TEXT,

    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,

    CONSTRAINT fk_sync_queue_customer FOREIGN KEY (entity_id)
        REFERENCES accounts.customers(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_queue_status ON accounts.hubspot_sync_queue(status, priority, scheduled_for);
CREATE INDEX idx_sync_queue_entity ON accounts.hubspot_sync_queue(entity_type, entity_id);

-- Sync Configuration (per customer or global)
CREATE TABLE IF NOT EXISTS accounts.hubspot_sync_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Scope
    customer_id UUID REFERENCES accounts.customers(id) ON DELETE CASCADE,
    is_global BOOLEAN DEFAULT FALSE,

    -- Configuration
    config_name VARCHAR(100) NOT NULL,
    field_mappings JSONB NOT NULL,
    /* Example:
       {
         "company_name": {
           "hubspot_property": "name",
           "warp_field": "company_name",
           "sync_direction": "BIDIRECTIONAL",
           "conflict_resolution": "LATEST_WINS",
           "transform": null
         },
         "credit_limit": {
           "hubspot_property": "warp_credit_limit",
           "warp_field": "credit_limit",
           "sync_direction": "WARP_TO_HUBSPOT",
           "conflict_resolution": "WARP_WINS",
           "transform": "multiply_by_100"
         }
       }
    */

    -- Options
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_frequency_minutes INTEGER DEFAULT 60,
    batch_size INTEGER DEFAULT 50,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

CREATE INDEX idx_sync_config_customer ON accounts.hubspot_sync_config(customer_id);
CREATE INDEX idx_sync_config_global ON accounts.hubspot_sync_config(is_global) WHERE is_global = TRUE;
CREATE UNIQUE INDEX idx_sync_config_unique_global ON accounts.hubspot_sync_config(config_name) WHERE is_global = TRUE;

-- Webhook Events (raw from HubSpot)
CREATE TABLE IF NOT EXISTS accounts.hubspot_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- HubSpot webhook data
    event_id VARCHAR(100) UNIQUE, -- HubSpot's event ID (for idempotency)
    event_type VARCHAR(100) NOT NULL, -- 'company.propertyChange', 'company.creation', etc.
    object_type VARCHAR(50) NOT NULL, -- 'company', 'contact', etc.
    object_id VARCHAR(100) NOT NULL, -- HubSpot object ID

    -- Event data
    property_name VARCHAR(100),
    property_value JSONB,
    previous_value JSONB,

    -- Full webhook payload
    raw_payload JSONB NOT NULL,

    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,

    -- Timing
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Security
    signature_valid BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_webhook_events_processed ON accounts.hubspot_webhook_events(processed, received_at);
CREATE INDEX idx_webhook_events_object ON accounts.hubspot_webhook_events(object_type, object_id);
CREATE INDEX idx_webhook_events_event_type ON accounts.hubspot_webhook_events(event_type);
CREATE UNIQUE INDEX idx_webhook_events_event_id ON accounts.hubspot_webhook_events(event_id);

-- Reconciliation Runs
CREATE TABLE IF NOT EXISTS accounts.hubspot_reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Run details
    run_type VARCHAR(50) NOT NULL, -- 'FULL', 'INCREMENTAL', 'CUSTOMER_SPECIFIC'
    entity_type VARCHAR(50) NOT NULL,
    customer_id UUID REFERENCES accounts.customers(id),

    -- Statistics
    total_records INTEGER DEFAULT 0,
    records_in_sync INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    conflicts_detected INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'RUNNING'
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),

    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_seconds INTEGER,

    -- Metadata
    triggered_by VARCHAR(100),
    notes TEXT
);

CREATE INDEX idx_reconciliation_runs_status ON accounts.hubspot_reconciliation_runs(status, started_at DESC);
CREATE INDEX idx_reconciliation_runs_customer ON accounts.hubspot_reconciliation_runs(customer_id);

-- Add HubSpot sync fields to customers table if not exists
DO $$
BEGIN
    -- Add last_synced_to_hubspot if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'last_synced_to_hubspot'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN last_synced_to_hubspot TIMESTAMPTZ;
    END IF;

    -- Add last_synced_from_hubspot if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'last_synced_from_hubspot'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN last_synced_from_hubspot TIMESTAMPTZ;
    END IF;

    -- Add hubspot_sync_enabled if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'accounts'
        AND table_name = 'customers'
        AND column_name = 'hubspot_sync_enabled'
    ) THEN
        ALTER TABLE accounts.customers
        ADD COLUMN hubspot_sync_enabled BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Create indexes on new columns
CREATE INDEX IF NOT EXISTS idx_customers_last_synced_hubspot
    ON accounts.customers(last_synced_to_hubspot DESC NULLS LAST);

-- Comments
COMMENT ON TABLE accounts.hubspot_sync_log IS 'Audit log of all sync operations between WARP and HubSpot';
COMMENT ON TABLE accounts.hubspot_field_state IS 'Current sync state for each field, used for conflict detection';
COMMENT ON TABLE accounts.hubspot_sync_queue IS 'Queue for pending sync operations with retry logic';
COMMENT ON TABLE accounts.hubspot_sync_config IS 'Field mapping configuration for sync behavior';
COMMENT ON TABLE accounts.hubspot_webhook_events IS 'Raw webhook events from HubSpot for idempotent processing';
COMMENT ON TABLE accounts.hubspot_reconciliation_runs IS 'Periodic reconciliation job tracking';

-- Sample sync configuration (global default)
INSERT INTO accounts.hubspot_sync_config (config_name, is_global, field_mappings)
VALUES (
    'default_customer_sync',
    TRUE,
    '{"company_name": {"hubspot_property": "name", "warp_field": "company_name", "sync_direction": "BIDIRECTIONAL", "conflict_resolution": "LATEST_WINS"}, "ban": {"hubspot_property": "warp_ban", "warp_field": "ban", "sync_direction": "WARP_TO_HUBSPOT", "conflict_resolution": "WARP_WINS"}, "status": {"hubspot_property": "warp_status", "warp_field": "status", "sync_direction": "BIDIRECTIONAL", "conflict_resolution": "WARP_WINS"}, "credit_limit": {"hubspot_property": "warp_credit_limit", "warp_field": "credit_limit", "sync_direction": "BIDIRECTIONAL", "conflict_resolution": "HUBSPOT_WINS"}, "contact_email": {"hubspot_property": "domain", "warp_field": "contact.email", "warp_field_path": "contact->>''email''", "sync_direction": "BIDIRECTIONAL", "conflict_resolution": "LATEST_WINS"}}'::jsonb
);
