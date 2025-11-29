-- User Invitation System Schema
-- Enables secure email-based user onboarding with customer assignment
-- Version: 1.0.0
-- Date: October 27, 2025

-- User invitations table
CREATE TABLE IF NOT EXISTS auth.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Invitation security
    token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),

    -- Invited user details
    email VARCHAR(255) NOT NULL,
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id),

    -- Customer assignment (what they'll get access to when accepted)
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'USER', -- USER, ADMIN, OWNER (for user_customer_access table)

    -- Invitation metadata
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    message TEXT, -- Custom message from inviter (optional)
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        -- PENDING: Invitation sent, waiting for acceptance
        -- ACCEPTED: User accepted and account created
        -- EXPIRED: Token expired (7 days passed)
        -- REVOKED: Admin cancelled invitation before acceptance

    sent_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    accepted_by_user_id UUID REFERENCES auth.users(id),

    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT user_invitations_status_check CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    CONSTRAINT user_invitations_role_check CHECK (role IN ('USER', 'ADMIN', 'OWNER')),
    CONSTRAINT user_invitations_expires_future CHECK (expires_at > created_at),

    -- Prevent duplicate pending invitations for same email + customer
    UNIQUE(email, customer_id, status)
);

-- Indexes for performance
CREATE INDEX idx_invitations_token ON auth.user_invitations(token) WHERE status = 'PENDING';
CREATE INDEX idx_invitations_email ON auth.user_invitations(email);
CREATE INDEX idx_invitations_status ON auth.user_invitations(status);
CREATE INDEX idx_invitations_expires ON auth.user_invitations(expires_at) WHERE status = 'PENDING';
CREATE INDEX idx_invitations_customer ON auth.user_invitations(customer_id);
CREATE INDEX idx_invitations_invited_by ON auth.user_invitations(invited_by);

-- Updated trigger
CREATE TRIGGER update_user_invitations_updated_at
    BEFORE UPDATE ON auth.user_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to automatically expire old invitations (run via CronJob)
CREATE OR REPLACE FUNCTION auth.expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE auth.user_invitations
    SET status = 'EXPIRED',
        updated_at = NOW()
    WHERE status = 'PENDING'
    AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;

    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old processed invitations (keep for 90 days)
CREATE OR REPLACE FUNCTION auth.cleanup_old_invitations()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM auth.user_invitations
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status IN ('ACCEPTED', 'EXPIRED', 'REVOKED');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add invitation permissions to permission_metadata
INSERT INTO auth.permission_metadata (resource_path, category, display_name, description, display_order, icon)
VALUES
    ('/api/v1/admin/invitations', 'User Management API', 'Manage Invitations', 'View and manage user invitations', 100, 'mail'),
    ('/api/v1/admin/invitations/*', 'User Management API', 'All Invitation Operations', 'Full invitation management (wildcard)', 101, 'mail'),
    ('/api/v1/admin/customers/*/invitations', 'User Management API', 'Invite Users to Customer', 'Send invitations for customer account access', 102, 'user-plus')
ON CONFLICT (resource_path) DO NOTHING;

-- Grant invitation permissions to superAdmin (already has * wildcard, but explicit for clarity)
-- Grant to admin users
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/admin/invitations/*' FROM auth.user_types WHERE type_name = 'admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant to customer_admin (can invite users to their own customer)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/admin/customers/*/invitations' FROM auth.user_types WHERE type_name = 'customer_admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Add missing customer list permission for customer_admin
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/customers' FROM auth.user_types WHERE type_name = 'customer_admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

COMMENT ON TABLE auth.user_invitations IS 'User invitation system for secure email-based onboarding';
COMMENT ON COLUMN auth.user_invitations.token IS 'Secure UUID token used in invitation link (single-use)';
COMMENT ON COLUMN auth.user_invitations.role IS 'Role in user_customer_access table (USER, ADMIN, OWNER)';
COMMENT ON COLUMN auth.user_invitations.status IS 'Invitation lifecycle status (PENDING, ACCEPTED, EXPIRED, REVOKED)';
