-- TCR (The Campaign Registry) 10DLC Permission Setup
-- Date: 2025-11-26
-- Purpose: Add permissions for TCR brand and campaign management

-- Add permission metadata for TCR endpoints
INSERT INTO auth.permission_metadata (resource_path, category, display_name, description, display_order)
VALUES
    -- Brand permissions
    ('/api/v1/messaging/brands', 'TCR/10DLC', 'List Brands', 'View registered 10DLC brands', 200),
    ('/api/v1/messaging/brands/*', 'TCR/10DLC', 'Manage Brands', 'Create and manage 10DLC brands', 201),

    -- Campaign permissions
    ('/api/v1/messaging/campaigns', 'TCR/10DLC', 'List Campaigns', 'View registered 10DLC campaigns', 210),
    ('/api/v1/messaging/campaigns/*', 'TCR/10DLC', 'Manage Campaigns', 'Create and manage 10DLC campaigns', 211),

    -- Enumeration/helper permissions
    ('/api/v1/messaging/use-cases', 'TCR/10DLC', 'View Use Cases', 'View available campaign use cases', 220),
    ('/api/v1/messaging/entity-types', 'TCR/10DLC', 'View Entity Types', 'View brand entity types', 221),
    ('/api/v1/messaging/verticals', 'TCR/10DLC', 'View Verticals', 'View industry verticals', 222),
    ('/api/v1/messaging/carriers', 'TCR/10DLC', 'View Carriers', 'View mobile carriers', 223),
    ('/api/v1/messaging/use-case-requirements', 'TCR/10DLC', 'View Requirements', 'View use case requirements', 224),
    ('/api/v1/messaging/throughput-estimate', 'TCR/10DLC', 'Throughput Estimates', 'View throughput estimates', 225)
ON CONFLICT (resource_path) DO UPDATE
SET category = EXCLUDED.category,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

COMMENT ON TABLE auth.permission_metadata IS 'Metadata for display and organization of permissions in admin UI';

-- SuperAdmin already has wildcard '*' permission, so no need to add specific permissions

-- Grant permissions to Admin user type (full access to TCR)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/brands/*'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/campaigns/*'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perm(resource)
WHERE ut.type_name = 'admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant permissions to Customer Admin (can manage campaigns, but cannot create new brands)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/messaging/brands'),           -- Can view brands (read-only)
    ('/api/v1/messaging/campaigns'),        -- Can view campaigns
    ('/api/v1/messaging/campaigns/*'),      -- Can manage campaigns
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perm(resource)
WHERE ut.type_name = 'customer_admin'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant read-only permissions to Viewer (can view but not modify)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perm(resource)
WHERE ut.type_name = 'viewer'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant permissions to Developer (full access like admin)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/brands/*'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/campaigns/*'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/entity-types'),
    ('/api/v1/messaging/verticals'),
    ('/api/v1/messaging/carriers'),
    ('/api/v1/messaging/use-case-requirements'),
    ('/api/v1/messaging/throughput-estimate')
) AS perm(resource)
WHERE ut.type_name = 'developer'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Grant read-only permissions to Billing (can view for reporting)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT ut.id, perm.resource FROM auth.user_types ut, (VALUES
    ('/api/v1/messaging/brands'),
    ('/api/v1/messaging/campaigns'),
    ('/api/v1/messaging/use-cases'),
    ('/api/v1/messaging/carriers')
) AS perm(resource)
WHERE ut.type_name = 'billing'
ON CONFLICT (user_type_id, resource_path) DO NOTHING;

-- Verification queries (commented out - run manually to verify)
/*
-- Check that permissions were added
SELECT resource_path, category, display_name, description
FROM auth.permission_metadata
WHERE category = 'TCR/10DLC'
ORDER BY display_order;

-- Check admin permissions
SELECT ut.type_name, utp.resource_path
FROM auth.user_type_permissions utp
JOIN auth.user_types ut ON utp.user_type_id = ut.id
WHERE utp.resource_path LIKE '/api/v1/messaging/%'
ORDER BY ut.type_name, utp.resource_path;

-- Check how many permissions each user type has for messaging
SELECT ut.type_name, COUNT(utp.resource_path) as messaging_permissions
FROM auth.user_types ut
LEFT JOIN auth.user_type_permissions utp ON ut.id = utp.user_type_id
  AND utp.resource_path LIKE '/api/v1/messaging/%'
GROUP BY ut.type_name
ORDER BY ut.type_name;
*/

-- Summary
DO $$
BEGIN
    RAISE NOTICE '✅ TCR 10DLC permissions successfully added';
    RAISE NOTICE '   - 10 permission metadata entries created';
    RAISE NOTICE '   - Permissions granted to: superAdmin (*), admin, developer, customer_admin, viewer, billing';
    RAISE NOTICE '   - Admin & Developer: Full access (create brands & campaigns)';
    RAISE NOTICE '   - Customer Admin: Manage campaigns only (cannot create brands)';
    RAISE NOTICE '   - Viewer & Billing: Read-only access';
END $$;
