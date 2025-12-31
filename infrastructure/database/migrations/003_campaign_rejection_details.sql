-- Migration: Add campaign-level rejection details
-- Date: 2025-12-30
-- Purpose: Store CNP/DCA rejection reasons for better user visibility

-- Add rejection tracking fields to campaigns
ALTER TABLE messaging.campaigns_10dlc
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS rejection_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS rejection_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_by VARCHAR(100); -- Which entity rejected (carrier name, CNP name, etc.)

-- Add index for querying rejected campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_rejection
    ON messaging.campaigns_10dlc(status, rejected_at)
    WHERE status = 'REJECTED';

COMMENT ON COLUMN messaging.campaigns_10dlc.rejection_reason IS 'Full rejection message from TCR/CNP/Carrier';
COMMENT ON COLUMN messaging.campaigns_10dlc.rejection_code IS 'Comma-separated rejection codes (e.g., CR7004,CR7005,CR4015)';
COMMENT ON COLUMN messaging.campaigns_10dlc.rejection_category IS 'Rejection category (e.g., CALL_TO_ACTION, MANDATORY_MESSAGE_TERMINOLOGY)';
COMMENT ON COLUMN messaging.campaigns_10dlc.rejected_by IS 'Entity that rejected (e.g., Sinch, AT&T, T-Mobile)';
