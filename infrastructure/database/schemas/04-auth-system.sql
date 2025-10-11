-- WARP Platform Authentication & Permission System
-- Database Schema - Phase 1
-- Adapted from ringer-soa Gatekeeper pattern

-- ============================================================================
-- AUTH SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auth;

-- ============================================================================
-- USER TYPES (Roles)
-- ============================================================================

CREATE TABLE auth.user_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type_name VARCHAR(50) UNIQUE NOT NULL,  -- 'superAdmin', 'admin', 'customer_admin', etc.
    description TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

COMMENT ON TABLE auth.user_types IS 'User role definitions - determines what users can access';
COMMENT ON COLUMN auth.user_types.type_name IS 'Unique identifier for user type (e.g., superAdmin, admin)';

-- ============================================================================
-- USER TYPE PERMISSIONS
-- ============================================================================

CREATE TABLE auth.user_type_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_type_id UUID NOT NULL REFERENCES auth.user_types(id) ON DELETE CASCADE,
    resource_path VARCHAR(255) NOT NULL,  -- Path to page or API endpoint

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),

    UNIQUE(user_type_id, resource_path)
);

COMMENT ON TABLE auth.user_type_permissions IS 'Permissions assigned to each user type';
COMMENT ON COLUMN auth.user_type_permissions.resource_path IS 'Resource path (page or API endpoint) - supports wildcards with /*';

CREATE INDEX idx_user_type_permissions_lookup ON auth.user_type_permissions(user_type_id, resource_path);
CREATE INDEX idx_user_type_permissions_path ON auth.user_type_permissions(resource_path);

-- ============================================================================
-- PERMISSION METADATA (For friendly UI)
-- ============================================================================

CREATE TABLE auth.permission_metadata (
    resource_path VARCHAR(255) PRIMARY KEY,

    -- Display information
    category VARCHAR(100),  -- 'Customer Management', 'Voice Vendors', 'Messaging', etc.
    display_name VARCHAR(255),
    description TEXT,
    display_order INTEGER DEFAULT 100,

    -- Flags
    is_deprecated BOOLEAN DEFAULT FALSE,
    deprecated_reason TEXT,
    requires_wildcard BOOLEAN DEFAULT FALSE,  -- Warning for sensitive permissions
    icon VARCHAR(50),  -- Icon identifier for UI

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auth.permission_metadata IS 'Metadata for permissions to display friendly names and descriptions in UI';

CREATE INDEX idx_permission_metadata_category ON auth.permission_metadata(category, display_order);

-- ============================================================================
-- USERS
-- ============================================================================

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Firebase Authentication
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,

    -- User information
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url VARCHAR(500),

    -- User type (role)
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

COMMENT ON TABLE auth.users IS 'User accounts linked to Firebase authentication';
COMMENT ON COLUMN auth.users.firebase_uid IS 'Firebase user ID from Firebase Authentication';

CREATE INDEX idx_users_firebase_uid ON auth.users(firebase_uid);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_type ON auth.users(user_type_id);
CREATE INDEX idx_users_active ON auth.users(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- USER CUSTOMER ACCESS (Customer Scoping)
-- ============================================================================

CREATE TABLE auth.user_customer_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- Role within customer context
    role VARCHAR(50) DEFAULT 'USER',  -- 'ADMIN', 'USER', 'VIEWER'

    -- Audit fields
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by VARCHAR(100),

    UNIQUE(user_id, customer_id)
);

COMMENT ON TABLE auth.user_customer_access IS 'Maps users to accessible customers for data scoping';
COMMENT ON COLUMN auth.user_customer_access.role IS 'Role within customer context (not system-wide role)';

CREATE INDEX idx_user_customer_access_user ON auth.user_customer_access(user_id);
CREATE INDEX idx_user_customer_access_customer ON auth.user_customer_access(customer_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_user_types_updated_at BEFORE UPDATE ON auth.user_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permission_metadata_updated_at BEFORE UPDATE ON auth.permission_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- DEFAULT USER TYPES
-- ============================================================================

-- Insert default user types
INSERT INTO auth.user_types (type_name, description, created_by) VALUES
    ('superAdmin', 'Ringer internal - Full platform access to all customers and system settings', 'system'),
    ('admin', 'Platform administrator with access to assigned customers', 'system'),
    ('customer_admin', 'Customer account administrator - manages their own customer account', 'system'),
    ('developer', 'Technical/API access only - no billing or user management', 'system'),
    ('billing', 'Billing and financial access only - no technical configuration', 'system'),
    ('viewer', 'Read-only access to assigned resources', 'system');

-- ============================================================================
-- DEFAULT PERMISSIONS
-- ============================================================================

-- SuperAdmin: Wildcard permission (access everything)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, '*', 'system' FROM auth.user_types WHERE type_name = 'superAdmin';

-- Admin: Most administrative functions
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    -- Dashboard pages
    ('/dashboard'),
    ('/dashboard/*'),

    -- Customer management
    ('/api/v1/customers'),
    ('/api/v1/customers/*'),

    -- Voice vendor management
    ('/api/v1/admin/voice-vendors'),
    ('/api/v1/admin/voice-vendors/*'),

    -- SMS vendor management
    ('/api/v1/admin/sms-vendors'),
    ('/api/v1/admin/sms-vendors/*'),

    -- Trunk management
    ('/api/v1/trunks/*'),

    -- DID/Number management
    ('/api/v1/dids/*'),

    -- Messaging
    ('/api/v1/messages'),
    ('/api/v1/messages/*'),

    -- CDRs and usage
    ('/api/v1/cdrs/*'),
    ('/api/v1/analytics/*'),

    -- Partitions
    ('/api/v1/admin/partitions'),
    ('/api/v1/admin/partitions/*')
) AS perms(resource)
WHERE type_name = 'admin';

-- Customer Admin: Their own customer resources only
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/overview'),
    ('/dashboard/trunks'),
    ('/dashboard/numbers'),
    ('/dashboard/messages'),
    ('/dashboard/cdrs'),
    ('/dashboard/usage'),

    -- Can view/manage their trunks
    ('/api/v1/trunks/*'),

    -- Can send messages
    ('/api/v1/messages'),
    ('/api/v1/messages/*'),

    -- Can view their CDRs
    ('/api/v1/cdrs'),

    -- Can view their usage
    ('/api/v1/usage')
) AS perms(resource)
WHERE type_name = 'customer_admin';

-- Developer: Technical/API access only
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/overview'),
    ('/dashboard/trunks'),
    ('/dashboard/numbers'),
    ('/dashboard/api-docs'),

    -- API access for integration
    ('/api/v1/trunks/*'),
    ('/api/v1/messages/*'),
    ('/api/v1/cdrs')
) AS perms(resource)
WHERE type_name = 'developer';

-- Billing: Financial access only
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/billing'),
    ('/dashboard/usage'),
    ('/dashboard/invoices'),

    ('/api/v1/usage'),
    ('/api/v1/invoices/*'),
    ('/api/v1/billing/*')
) AS perms(resource)
WHERE type_name = 'billing';

-- Viewer: Read-only access
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/overview'),
    ('/dashboard/cdrs'),
    ('/dashboard/usage'),

    -- Read-only API access (GET only enforced at handler level)
    ('/api/v1/customers'),
    ('/api/v1/trunks'),
    ('/api/v1/cdrs'),
    ('/api/v1/usage')
) AS perms(resource)
WHERE type_name = 'viewer';

-- ============================================================================
-- PERMISSION METADATA (For UI)
-- ============================================================================

INSERT INTO auth.permission_metadata (resource_path, category, display_name, description, display_order) VALUES
    -- Dashboard Pages
    ('/dashboard', 'Dashboard', 'Dashboard Home', 'Main dashboard with overview and statistics', 10),
    ('/dashboard/*', 'Dashboard', 'All Dashboard Pages', 'Access to all dashboard pages (wildcard)', 11),
    ('/dashboard/customers', 'Dashboard', 'Customer Management', 'View and manage customers', 20),
    ('/dashboard/vendors', 'Dashboard', 'Vendor Management', 'View and manage voice/SMS vendors', 30),
    ('/dashboard/trunks', 'Dashboard', 'Trunk Management', 'View and manage SIP trunks', 40),
    ('/dashboard/numbers', 'Dashboard', 'Number Management', 'View and manage phone numbers (DIDs)', 50),
    ('/dashboard/messages', 'Dashboard', 'Messaging', 'Send and view SMS/MMS messages', 60),
    ('/dashboard/cdrs', 'Dashboard', 'Call Detail Records', 'View call history and CDRs', 70),
    ('/dashboard/usage', 'Dashboard', 'Usage & Billing', 'View usage statistics and billing information', 80),
    ('/dashboard/users', 'Dashboard', 'User Management', 'Manage platform users and permissions', 90),
    ('/dashboard/settings', 'Dashboard', 'Settings', 'System settings and configuration', 100),

    -- Customer API
    ('/api/v1/customers', 'Customer API', 'List Customers', 'Retrieve customer list', 100),
    ('/api/v1/customers/*', 'Customer API', 'All Customer Operations', 'Full CRUD access to customer endpoints (wildcard)', 101),

    -- Voice Vendor API
    ('/api/v1/admin/voice-vendors', 'Voice Vendor API', 'Manage Voice Vendors', 'Create and configure voice vendors', 200),
    ('/api/v1/admin/voice-vendors/*', 'Voice Vendor API', 'All Voice Vendor Operations', 'Full voice vendor management (wildcard)', 201),

    -- SMS Vendor API
    ('/api/v1/admin/sms-vendors', 'SMS Vendor API', 'Manage SMS Vendors', 'Create and configure SMS vendors', 300),
    ('/api/v1/admin/sms-vendors/*', 'SMS Vendor API', 'All SMS Vendor Operations', 'Full SMS vendor management (wildcard)', 301),

    -- Trunk API
    ('/api/v1/trunks/*', 'Trunk API', 'Trunk Management', 'Manage SIP trunks', 400),

    -- DID/Number API
    ('/api/v1/dids/*', 'Number API', 'Number Management', 'Manage phone numbers and DIDs', 500),

    -- Messaging API
    ('/api/v1/messages', 'Messaging API', 'Send Messages', 'Send SMS/MMS messages', 600),
    ('/api/v1/messages/*', 'Messaging API', 'All Messaging Operations', 'Full messaging access (wildcard)', 601),

    -- CDR API
    ('/api/v1/cdrs', 'CDR API', 'View CDRs', 'View call detail records', 700),
    ('/api/v1/cdrs/*', 'CDR API', 'All CDR Operations', 'Full CDR access (wildcard)', 701),

    -- Analytics API
    ('/api/v1/analytics/*', 'Analytics API', 'Analytics & Reporting', 'Generate usage reports and analytics', 800),

    -- Partition API
    ('/api/v1/admin/partitions', 'Partition API', 'Manage Partitions', 'Create and configure routing partitions', 900),
    ('/api/v1/admin/partitions/*', 'Partition API', 'All Partition Operations', 'Full partition management (wildcard)', 901),

    -- User Management API
    ('/api/v1/admin/users', 'User Management API', 'Manage Users', 'Create and manage platform users', 1000),
    ('/api/v1/admin/users/*', 'User Management API', 'All User Operations', 'Full user management (wildcard)', 1001),

    -- Role Management API
    ('/api/v1/admin/roles/*', 'Role Management API', 'Role Management', 'Manage user types and permissions', 1100),

    -- Gatekeeper API
    ('/api/v1/gatekeeper/*', 'Gatekeeper API', 'Permission Checks', 'Check user permissions', 1200),

    -- Wildcard (SuperAdmin only)
    ('*', 'System', 'Full Platform Access', 'Unrestricted access to all resources (SuperAdmin only)', 9999);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Firebase Authentication
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,

    -- User information
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url VARCHAR(500),

    -- User type (role)
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

COMMENT ON TABLE auth.users IS 'Platform users authenticated via Firebase';
COMMENT ON COLUMN auth.users.firebase_uid IS 'Firebase UID from Firebase Authentication - unique identifier';

CREATE INDEX idx_users_firebase_uid ON auth.users(firebase_uid);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_type ON auth.users(user_type_id);
CREATE INDEX idx_users_active ON auth.users(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- USER CUSTOMER ACCESS (Data Scoping)
-- ============================================================================

CREATE TABLE auth.user_customer_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,

    -- Role within customer context (not system-wide role)
    role VARCHAR(50) DEFAULT 'USER',  -- 'ADMIN', 'USER', 'VIEWER'

    -- Audit fields
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by VARCHAR(100),

    UNIQUE(user_id, customer_id)
);

COMMENT ON TABLE auth.user_customer_access IS 'Defines which customers each user can access';
COMMENT ON COLUMN auth.user_customer_access.role IS 'Role within this customer (ADMIN can manage, USER can view/use, VIEWER read-only)';

CREATE INDEX idx_user_customer_access_user ON auth.user_customer_access(user_id);
CREATE INDEX idx_user_customer_access_customer ON auth.user_customer_access(customer_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE TRIGGER update_user_types_updated_at BEFORE UPDATE ON auth.user_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permission_metadata_updated_at BEFORE UPDATE ON auth.permission_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- GRANT PERMISSIONS TO USERS
-- ============================================================================

-- Grant warp and warp_app users access to auth schema
GRANT USAGE ON SCHEMA auth TO warp, warp_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO warp, warp_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO warp, warp_app;

-- For future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO warp, warp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO warp, warp_app;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count user types
SELECT type_name, description FROM auth.user_types ORDER BY type_name;

-- Count permissions by user type
SELECT
    ut.type_name,
    COUNT(utp.id) as permission_count
FROM auth.user_types ut
LEFT JOIN auth.user_type_permissions utp ON utp.user_type_id = ut.id
GROUP BY ut.id, ut.type_name
ORDER BY ut.type_name;

-- Show permission metadata count
SELECT COUNT(*) as metadata_count FROM auth.permission_metadata;

COMMENT ON SCHEMA auth IS 'Authentication and authorization system - users, roles, permissions';
