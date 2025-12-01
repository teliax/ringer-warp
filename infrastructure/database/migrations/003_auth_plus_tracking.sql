-- Migration: 003_auth_plus_tracking.sql
-- Description: Add Auth+ progress tracking fields to brands_10dlc table
-- Date: 2025-12-01
-- Sprint: Auth+ Vetting UX - Sprint 2

-- Add Auth+ progress tracking fields to brands_10dlc
ALTER TABLE messaging.brands_10dlc
    ADD COLUMN IF NOT EXISTS auth_plus_domain_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auth_plus_2fa_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auth_plus_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_plus_email_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_plus_requested_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_plus_completed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auth_plus_failed_at TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_domain_verified IS 'Auth+ domain verification passed (step 1 of 2)';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_2fa_verified IS 'Auth+ 2FA verification completed (step 2 of 2)';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_email_sent_at IS 'When 2FA email was sent to business contact';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_email_opened_at IS 'When business contact opened 2FA email';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_requested_at IS 'When Auth+ verification was requested';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_completed_at IS 'When Auth+ verification completed successfully';
COMMENT ON COLUMN messaging.brands_10dlc.auth_plus_failed_at IS 'When Auth+ verification failed';

-- Create Auth+ vetting history table for timeline display
CREATE TABLE IF NOT EXISTS messaging.auth_plus_vetting_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    brand_id UUID NOT NULL REFERENCES messaging.brands_10dlc(id) ON DELETE CASCADE,
    tcr_vetting_id VARCHAR(100) NOT NULL,
    vetting_class VARCHAR(50) DEFAULT 'AUTHPLUS',
    vetting_provider VARCHAR(50) DEFAULT 'AEGIS',
    status VARCHAR(50) NOT NULL, -- PENDING, ACTIVE, FAILED, EXPIRED
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    expiration_date DATE,
    domain_verified BOOLEAN DEFAULT FALSE,
    two_fa_verified BOOLEAN DEFAULT FALSE,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT status_valid CHECK (status IN ('PENDING', 'ACTIVE', 'FAILED', 'EXPIRED'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_plus_history_brand ON messaging.auth_plus_vetting_history(brand_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_plus_history_status ON messaging.auth_plus_vetting_history(status);

-- Add comments
COMMENT ON TABLE messaging.auth_plus_vetting_history IS 'Historical record of all Auth+ vetting attempts for timeline display';
COMMENT ON COLUMN messaging.auth_plus_vetting_history.tcr_vetting_id IS 'TCR vettingId from API response';
COMMENT ON COLUMN messaging.auth_plus_vetting_history.expiration_date IS 'Date when Auth+ verification expires (if ACTIVE)';

-- Create Auth+ appeals tracking table
CREATE TABLE IF NOT EXISTS messaging.auth_plus_appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vetting_history_id UUID NOT NULL REFERENCES messaging.auth_plus_vetting_history(id) ON DELETE CASCADE,
    appeal_categories TEXT[] NOT NULL, -- Array of appeal category strings
    explanation TEXT,
    evidence_uuids TEXT[], -- Array of attachment UUIDs from TCR
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    outcome TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT appeal_status_valid CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

-- Create index for appeals
CREATE INDEX IF NOT EXISTS idx_auth_plus_appeals_vetting ON messaging.auth_plus_appeals(vetting_history_id);

-- Add comments
COMMENT ON TABLE messaging.auth_plus_appeals IS 'Auth+ verification appeals submitted when verification fails';
COMMENT ON COLUMN messaging.auth_plus_appeals.appeal_categories IS 'Array of TCR appeal categories (VERIFY_EMAIL_OWNERSHIP, VERIFY_DOMAIN_OWNERSHIP)';
COMMENT ON COLUMN messaging.auth_plus_appeals.evidence_uuids IS 'Array of attachment UUIDs from TCR evidence upload';
