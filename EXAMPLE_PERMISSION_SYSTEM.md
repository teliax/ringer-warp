# Dynamic Permission System Documentation

## Overview
The application uses a dynamic, database-driven permission system where access control is managed through user types and their associated permissions. Every page and API endpoint goes through a single Gatekeeper controller that determines access based on the user's type.

### Spring Security Model (Simplified December 2024)
- All API endpoints use simple `@PreAuthorize("isAuthenticated()")`
- No complex role-based checking at the Spring Security level  
- Authentication is handled by Spring Security filters
- Authorization is delegated entirely to the GatekeeperController
- This provides a clean separation: Spring handles WHO you are, Gatekeeper handles WHAT you can do

## Database Schema

### Tables

1. **user_types**
   - `id` (UUID) - Primary key
   - `type_name` (VARCHAR) - Unique name like "superAdmin", "manager", "viewer"
   - `description` (TEXT) - Description of the user type
   - `created_at`, `created_by`, `updated_at`

2. **user_type_permissions**
   - `id` (UUID) - Primary key
   - `user_type_id` (UUID) - Foreign key to user_types
   - `resource_path` (VARCHAR) - Path to resource (page or endpoint)
   - `created_at`, `created_by`
   - Unique constraint on (user_type_id, resource_path)

3. **users** (modified)
   - Added: `user_type_id` (UUID) - Foreign key to user_types
   - Deprecated: `is_admin` (BOOLEAN) - Will be removed after migration

## Permission Model

### Resource Paths
Resources are identified by their path:
- **Pages**: `/dashboard/customers`, `/dashboard/ports`
- **API Endpoints**: `/api/v1/admin/customers`, `/api/v1/soa/create`
- **Wildcards**: `/api/v1/admin/customers/*` (matches all customer endpoints)
- **SuperAdmin**: `*` (matches everything)

### User Types
The system comes with default types (can be modified via database):

1. **superAdmin**
   - Has wildcard permission: `*`
   - Access to ALL resources and ALL customers
   - No data filtering applied

2. **admin**
   - Access to most administrative functions
   - Data filtered by customer associations

3. **manager**
   - Access to customer management and operations
   - Cannot manage users
   - Data filtered by customer associations

4. **viewer**
   - Read-only access to assigned resources
   - Data filtered by customer associations

## Customer Scoping

Customer scoping remains unchanged:
- Users belong to one or more customers via `user_customer_access` table
- Each customer has SPIDs
- Non-superAdmin users only see data for their assigned customers
- SuperAdmin users (with `*` permission) see all data

## Gatekeeper API

### Main Endpoint
```
POST /api/v1/gatekeeper/check-access
{
  "resourcePath": "/dashboard/customers"
}

Response (200 OK or 403 Forbidden):
{
  "allowed": true,
  "userType": "admin",
  "accessibleCustomerIds": ["uuid1", "uuid2"],
  "hasWildcardPermission": false
}
```

### Get User Permissions
```
GET /api/v1/gatekeeper/my-permissions

Response:
{
  "userId": "user-uuid",
  "email": "user@example.com",
  "userType": "manager",
  "hasWildcardPermission": false,
  "permissions": [
    "/dashboard",
    "/dashboard/customers",
    "/api/v1/admin/customers/*"
  ],
  "customerAccess": [
    {
      "customerId": "uuid",
      "customerName": "Ringer, Inc.",
      "role": "ADMIN"
    }
  ]
}
```

### Batch Check
```
POST /api/v1/gatekeeper/check-access-batch
{
  "resourcePaths": [
    "/dashboard/customers",
    "/dashboard/users",
    "/api/v1/admin/tokens"
  ]
}

Response:
{
  "/dashboard/customers": true,
  "/dashboard/users": false,
  "/api/v1/admin/tokens": true
}
```

## Implementation Flow

1. **User Authentication** → User logs in and receives JWT token
2. **Resource Access** → User attempts to access a page or API endpoint
3. **Gatekeeper Check** → System calls gatekeeper with user token and resource path
4. **Permission Lookup** → Gatekeeper checks:
   - User → UserType → Permissions → Resource Path
   - If superAdmin (has `*`), allow all
   - If exact match or wildcard match, allow
   - Otherwise, deny
5. **Data Filtering** → If allowed, endpoint filters data by user's customer associations

## Migration Strategy

### Phase 1 - Current State
- New permission system is in place
- Legacy `isAdmin` field still exists
- Gatekeeper falls back to `isAdmin` if user has no type

### Phase 2 - User Migration
```sql
-- Assign types to existing users
UPDATE users SET user_type_id = (SELECT id FROM user_types WHERE type_name = 'admin')
WHERE is_admin = true;

UPDATE users SET user_type_id = (SELECT id FROM user_types WHERE type_name = 'viewer')
WHERE is_admin = false;
```

### Phase 3 - Cleanup (COMPLETED December 2024)
- ✅ Removed `isAdmin` field from users table
- ✅ Removed all complex permission checks from controllers  
- ✅ Simplified all `@PreAuthorize` to `isAuthenticated()`
- ✅ All authorization goes through Gatekeeper

## Adding New User Types

```sql
-- Create new user type
INSERT INTO user_types (type_name, description, created_by)
VALUES ('specialist', 'Specialized access for specific operations', 'admin');

-- Grant permissions
INSERT INTO user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, '/dashboard/ports', 'admin' FROM user_types WHERE type_name = 'specialist';

INSERT INTO user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, '/api/v1/soa/*', 'admin' FROM user_types WHERE type_name = 'specialist';

-- Assign to user
UPDATE users SET user_type_id = (SELECT id FROM user_types WHERE type_name = 'specialist')
WHERE email = 'specialist@example.com';
```

## Frontend Integration

The frontend should check permissions before displaying UI elements:

```javascript
// Check single permission
const canViewCustomers = await checkAccess('/dashboard/customers');

// Check multiple permissions
const permissions = await checkAccessBatch([
  '/dashboard/customers',
  '/dashboard/users',
  '/dashboard/settings'
]);

// Hide/show UI elements based on permissions
{permissions['/dashboard/users'] && (
  <Link href="/dashboard/users">User Management</Link>
)}
```

## Permission Metadata System

As of v1.17.14, the system includes a `permission_metadata` table that stores rich information about each permission for better UX.

### Database Schema

**permission_metadata** table:
- `resource_path` (VARCHAR 255) - Primary key, matches paths in user_type_permissions
- `category` (VARCHAR 100) - Grouping for UI (e.g., "Customer Management API")
- `display_name` (VARCHAR 255) - Friendly name (e.g., "List Customers")
- `description` (TEXT) - Detailed explanation of what the permission grants
- `display_order` (INTEGER) - Sort order within category
- `is_deprecated` (BOOLEAN) - Flag for old permissions
- `deprecated_reason` (TEXT) - Why the permission is deprecated
- `requires_wildcard` (BOOLEAN) - Warning for sensitive permissions
- `icon` (VARCHAR 50) - Optional icon identifier
- `created_at`, `updated_at` (TIMESTAMP) - Audit fields

### Adding New Permissions with Metadata

When adding a new endpoint or page, add its permission with metadata:

```sql
-- Add the permission to a user type
INSERT INTO user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, '/api/v1/new-feature/*', 'system'
FROM user_types WHERE type_name = 'admin';

-- Add metadata for better UX
INSERT INTO permission_metadata (
    resource_path, 
    category, 
    display_name, 
    description,
    display_order
) VALUES (
    '/api/v1/new-feature/*',
    'New Feature API',
    'Manage New Feature',
    'Full access to create, update, and delete new feature items',
    100
);
```

### API Endpoints

**Get Permissions with Metadata:**
```
GET /api/v1/admin/roles/available-resources-with-metadata

Response:
[{
  "resourcePath": "/api/v1/admin/customers",
  "category": "Customer Management API",
  "displayName": "List Customers",
  "description": "Retrieve customer list",
  "displayOrder": 100,
  "isDeprecated": false,
  "requiresWildcard": false,
  "icon": null
}, ...]
```

### Frontend Integration

The role management UI at `/dashboard/settings/roles` automatically uses metadata to show:
- Friendly display names instead of technical paths
- Descriptions for each permission
- Visual indicators for sensitive or deprecated permissions
- Organized by category with proper sorting

If metadata doesn't exist for a permission, the system auto-generates a basic display name from the path.

## Benefits

1. **Dynamic Configuration** - Add/remove permissions without code changes
2. **Centralized Control** - Single gatekeeper for all authorization
3. **Scalable** - Easy to add new user types and permissions
4. **Auditable** - All permissions in database, easy to review
5. **Consistent** - Same permission model for pages and APIs
6. **Clean Code** - Controllers focus on business logic, not authorization
7. **User-Friendly** - Rich metadata makes permission management intuitive
8. **Self-Documenting** - Permissions include their own documentation

## Implementation Status (Completed December 2024)

- ✅ Removed `isAdmin` field from users table
- ✅ Removed all complex permission checks from controllers  
- ✅ Simplified all `@PreAuthorize` to `isAuthenticated()`
- ✅ All authorization goes through Gatekeeper
- ✅ Permission metadata system implemented (v1.17.14)
- ✅ Enhanced role management UI with metadata (v1.17.15)
- ✅ Database-driven permission discovery