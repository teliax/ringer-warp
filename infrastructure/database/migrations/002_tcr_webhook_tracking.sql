-- Database Migration: TCR Webhook Tracking & Sync State
-- Date: 2025-11-30
-- Purpose: Add sync tracking and webhook event logging for TCR integration
-- Related: docs/status/TCR_BAN_PICKER_SESSION_SUMMARY.md (Phase 7)

-- =============================================================================
-- STEP 1: Add Sync Tracking Columns to brands_10dlc
-- =============================================================================

-- Add sync tracking columns to brands table
ALTER TABLE messaging.brands_10dlc
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_status VARCHAR(50);

-- Add column comments for documentation
COMMENT ON COLUMN messaging.brands_10dlc.last_synced_at IS 'Timestamp of last status sync from TCR (webhook or polling)';
COMMENT ON COLUMN messaging.brands_10dlc.sync_source IS 'Source of last sync: webhook, polling, or manual';
COMMENT ON COLUMN messaging.brands_10dlc.last_notification_sent_at IS 'Timestamp of last email notification sent to user';
COMMENT ON COLUMN messaging.brands_10dlc.notification_status IS 'Status of last notification: sent, failed, pending';

-- =============================================================================
-- STEP 2: Add Sync Tracking Columns to campaigns_10dlc
-- =============================================================================

-- Add sync tracking columns to campaigns table
ALTER TABLE messaging.campaigns_10dlc
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_source VARCHAR(20),
    ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notification_status VARCHAR(50);

-- Add column comments for documentation
COMMENT ON COLUMN messaging.campaigns_10dlc.last_synced_at IS 'Timestamp of last status sync from TCR (webhook or polling)';
COMMENT ON COLUMN messaging.campaigns_10dlc.sync_source IS 'Source of last sync: webhook, polling, or manual';
COMMENT ON COLUMN messaging.campaigns_10dlc.last_notification_sent_at IS 'Timestamp of last email notification sent to user';
COMMENT ON COLUMN messaging.campaigns_10dlc.notification_status IS 'Status of last notification: sent, failed, pending';

-- =============================================================================
-- STEP 3: Create Webhook Events Audit Table
-- =============================================================================

-- Create webhook events table for audit trail and replay capability
CREATE TABLE IF NOT EXISTS messaging.tcr_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,           -- E.g., 'brand.verified', 'campaign.approved'
    event_category VARCHAR(50) NOT NULL,        -- E.g., 'brand', 'campaign', 'vetting'
    tcr_brand_id VARCHAR(100),                  -- TCR's brand ID (if applicable)
    tcr_campaign_id VARCHAR(100),               -- TCR's campaign ID (if applicable)
    payload JSONB NOT NULL,                     -- Full webhook payload from TCR
    processed BOOLEAN DEFAULT FALSE,            -- Has this event been processed?
    processed_at TIMESTAMPTZ,                   -- When was it processed?
    processing_error TEXT,                      -- Error message if processing failed
    received_at TIMESTAMPTZ DEFAULT NOW(),      -- When did we receive this webhook?

    -- Add constraints (uppercase values to match TCR API)
    CONSTRAINT event_category_valid CHECK (event_category IN ('BRAND', 'CAMPAIGN', 'VETTING', 'CSP', 'INCIDENCE', 'OTHER'))
);

-- Add table comment
COMMENT ON TABLE messaging.tcr_webhook_events IS 'Audit log of all TCR webhook events received for debugging and replay';

-- Add column comments
COMMENT ON COLUMN messaging.tcr_webhook_events.event_type IS 'Specific event type from TCR (e.g., brand.verified, campaign.approved)';
COMMENT ON COLUMN messaging.tcr_webhook_events.event_category IS 'High-level category: brand, campaign, vetting, or other';
COMMENT ON COLUMN messaging.tcr_webhook_events.tcr_brand_id IS 'TCR brand ID if event relates to a brand';
COMMENT ON COLUMN messaging.tcr_webhook_events.tcr_campaign_id IS 'TCR campaign ID if event relates to a campaign';
COMMENT ON COLUMN messaging.tcr_webhook_events.payload IS 'Full JSON payload from TCR webhook for audit and replay';
COMMENT ON COLUMN messaging.tcr_webhook_events.processed IS 'Whether this event has been processed (update DB, send notification, etc.)';
COMMENT ON COLUMN messaging.tcr_webhook_events.processed_at IS 'Timestamp when event processing completed';
COMMENT ON COLUMN messaging.tcr_webhook_events.processing_error IS 'Error message if event processing failed (for retry logic)';
COMMENT ON COLUMN messaging.tcr_webhook_events.received_at IS 'Timestamp when webhook was received from TCR';

-- =============================================================================
-- STEP 4: Create Indexes for Performance
-- =============================================================================

-- Index for finding unprocessed webhook events (polling worker will use this)
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
    ON messaging.tcr_webhook_events (processed, received_at)
    WHERE processed = FALSE;

-- Index for finding events by TCR brand ID
CREATE INDEX IF NOT EXISTS idx_webhook_events_brand_id
    ON messaging.tcr_webhook_events (tcr_brand_id, received_at DESC)
    WHERE tcr_brand_id IS NOT NULL;

-- Index for finding events by TCR campaign ID
CREATE INDEX IF NOT EXISTS idx_webhook_events_campaign_id
    ON messaging.tcr_webhook_events (tcr_campaign_id, received_at DESC)
    WHERE tcr_campaign_id IS NOT NULL;

-- Index for finding events by category and type (analytics queries)
CREATE INDEX IF NOT EXISTS idx_webhook_events_category_type
    ON messaging.tcr_webhook_events (event_category, event_type, received_at DESC);

-- Index for finding brands that need sync (polling worker)
CREATE INDEX IF NOT EXISTS idx_brands_needs_sync
    ON messaging.brands_10dlc (last_synced_at, status)
    WHERE status IN ('REGISTERED', 'UNVERIFIED');

-- Index for finding campaigns that need sync (polling worker)
CREATE INDEX IF NOT EXISTS idx_campaigns_needs_sync
    ON messaging.campaigns_10dlc (last_synced_at, status)
    WHERE status = 'REVIEW';

-- Index for finding brands needing notification
CREATE INDEX IF NOT EXISTS idx_brands_needs_notification
    ON messaging.brands_10dlc (last_notification_sent_at, status)
    WHERE notification_status IS NULL OR notification_status = 'pending';

-- Index for finding campaigns needing notification
CREATE INDEX IF NOT EXISTS idx_campaigns_needs_notification
    ON messaging.campaigns_10dlc (last_notification_sent_at, status)
    WHERE notification_status IS NULL OR notification_status = 'pending';

-- =============================================================================
-- STEP 5: Verify Migration
-- =============================================================================

-- Show all columns in brands_10dlc
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    COALESCE(col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position), '') as comment
FROM information_schema.columns
WHERE table_schema = 'messaging'
  AND table_name = 'brands_10dlc'
  AND column_name IN ('last_synced_at', 'sync_source', 'last_notification_sent_at', 'notification_status')
ORDER BY ordinal_position;

-- Show all columns in campaigns_10dlc
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    COALESCE(col_description((table_schema||'.'||table_name)::regclass::oid, ordinal_position), '') as comment
FROM information_schema.columns
WHERE table_schema = 'messaging'
  AND table_name = 'campaigns_10dlc'
  AND column_name IN ('last_synced_at', 'sync_source', 'last_notification_sent_at', 'notification_status')
ORDER BY ordinal_position;

-- Show webhook events table structure
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'messaging'
  AND table_name = 'tcr_webhook_events'
ORDER BY ordinal_position;

-- Show all indexes created
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'messaging'
  AND tablename IN ('brands_10dlc', 'campaigns_10dlc', 'tcr_webhook_events')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- =============================================================================
-- Migration Complete
-- =============================================================================
-- Next Steps:
-- 1. Implement TCR webhook handlers (Phase 3)
-- 2. Create background polling worker (Phase 4)
-- 3. Implement WebSocket real-time updates (Phase 5)
-- 4. Add email notification system (Phase 6)
