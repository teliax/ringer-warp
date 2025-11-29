# WARP Platform - Authentication & Permission System

**Version**: 2.0.0
**Date**: October 27, 2025
**Status**: Production
**Owner**: Platform Engineering Team

---

## Executive Summary

WARP uses a **database-driven, endpoint-based authorization system** with multi-tenant customer scoping. Key principles:

1. ✅ **User Types are NOT hard-coded** - They're just named groups of permissions stored in database
2. ✅ **Authorization is endpoint-based** - Gatekeeper matches requested resource paths against permitted paths
3. ✅ **Multi-tenant isolation** - Users see only their assigned customers' data via `user_customer_access` table
4. ✅ **Frontends are secure** - All third-party APIs accessed via backend proxy only, never direct

**Current State**:
- Users: 1 (david.aldworth@ringer.tel - SuperAdmin)
- User Types: 6 (superAdmin, admin, customer_admin, developer, billing, viewer)
- Permissions: 48 across 12 API categories
- Customer Assignments: 0 (only SuperAdmin, no scoped users yet)

---

## Core Principles

### Principle 1: User Types are Database Records, Not Code

**NOT like traditional RBAC**:
```go
// ❌ WRONG - This doesn't exist in our code
if (user.type == "admin") {
    return allCustomers()
} else if (user.type == "viewer") {
    return readOnlyData()
}
```

**How WARP works**:
```go
// ✅ CORRECT - Database-driven
userTypeID := user.UserTypeID // e.g., UUID for "admin"
permissions := db.Query("SELECT resource_path FROM auth.user_type_permissions WHERE user_type_id = $1", userTypeID)
// Returns: ["/api/v1/customers", "/api/v1/customers/*", "/dashboard", ...]

// Check if requested path matches any permission
for _, perm := range permissions {
    if MatchesPermission(perm, requestedPath) {
        return ALLOWED
    }
}
return DENIED
```

**Benefit**: Add/remove permissions without touching code - just UPDATE database!

---

### Principle 2: Authorization is Purely Path-Based

**Request Flow**:
```
1. User requests: GET /v1/customers/123
2. JWT middleware extracts: user_id, user_type_id
3. Gatekeeper queries: SELECT resource_path FROM user_type_permissions WHERE user_type_id = ?
4. Gatekeeper matches: Does "/v1/customers/123" match any returned paths?
   - "/api/v1/customers/*" → YES ✅
5. Gatekeeper sets context: accessible_customer_ids = [...]
6. Handler filters: WHERE id = ANY(accessible_customer_ids)
7. Response: Only accessible data
```

**No hardcoded role checks anywhere in handler code!**

---

### Principle 3: Multi-Tenant Customer Scoping

**Three-Level Access Model**:

```
Level 1: Permission Check (Can user access endpoint?)
  → Gatekeeper checks: user_type_permissions
  → Result: ALLOW or DENY endpoint access

Level 2: Customer Scoping (Which customers can user see?)
  → Query: user_customer_access table
  → Result: nil (all), []uuid (specific), or empty (none)

Level 3: Data Filtering (Apply scoping to query)
  → Repository adds: WHERE customer_id = ANY($customerFilter)
  → Result: Only accessible customer data returned
```

**Example**:
```sql
-- Admin user assigned to Customer A only
SELECT customer_id FROM auth.user_customer_access WHERE user_id = '<admin-uuid>';
-- Returns: ['customer-A-uuid']

-- When admin lists customers
SELECT * FROM accounts.customers WHERE id = ANY(['customer-A-uuid']);
-- Returns: Only Customer A (NOT B, C, D, etc.)
```

---

### Principle 4: Frontends Never Call Third-Party APIs

**Architecture**:
```
┌──────────────┐
│   Frontend   │
│ (React/Vite) │
└──────┬───────┘
       │ All requests to: api.rns.ringer.tel
       │ Authorization: Bearer <JWT>
       ↓
┌──────────────────────┐
│  WARP API Gateway    │
│  (Go/Gin)            │
├──────────────────────┤
│ JWT Auth ✅          │
│ Gatekeeper ✅        │
│ Customer Scoping ✅  │
└──┬───────┬───────┬───┘
   │       │       │
   │       │       │ Backend proxies to:
   ↓       ↓       ↓
HubSpot Teliport Telique
(CRM)   (Numbers)(LERG/LRN)
```

**Why**:
- ✅ API keys stay on backend (never exposed to browser)
- ✅ Rate limiting controlled by backend
- ✅ Customer scoping enforced server-side
- ✅ Audit logging of all third-party calls
- ✅ Single point of authentication

**Frontend only needs**: WARP JWT token (no HubSpot key, no Teliport key, etc.)

---

## User Type System

### Six Pre-Configured Types

| Type | Description | Use Case | Example User |
|------|-------------|----------|--------------|
| **superAdmin** | Ringer internal staff | Full platform access, all customers | david.aldworth@ringer.tel |
| **admin** | Platform administrator | Manage assigned customers | ops@ringer.tel |
| **customer_admin** | Customer account owner | Manage own customer account | admin@acmecorp.com |
| **developer** | Technical/API access | API keys, technical configs | dev@acmecorp.com |
| **billing** | Finance/billing only | Invoices, payments, usage | billing@acmecorp.com |
| **viewer** | Read-only access | View reports, no changes | auditor@acmecorp.com |

### Database Schema

```sql
-- User types table
CREATE TABLE auth.user_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Current types
SELECT type_name, description FROM auth.user_types;

┌────────────────┬─────────────────────────────────────────────────────┐
│ type_name      │ description                                         │
├────────────────┼─────────────────────────────────────────────────────┤
│ superAdmin     │ Ringer internal - Full platform access              │
│ admin          │ Platform administrator with assigned customers      │
│ customer_admin │ Customer account admin - manages own account        │
│ developer      │ Technical/API access - no billing/user management   │
│ billing        │ Billing and financial access only                   │
│ viewer         │ Read-only access to assigned resources              │
└────────────────┴─────────────────────────────────────────────────────┘
```

### Adding New User Types

**Example**: Add "support" user type for customer service team:

```sql
-- 1. Create user type
INSERT INTO auth.user_types (type_name, description)
VALUES ('support', 'Customer support - view customers and tickets, cannot modify billing');

-- 2. Assign permissions
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/customers' FROM auth.user_types WHERE type_name = 'support'
UNION ALL
SELECT id, '/api/v1/tickets/*' FROM auth.user_types WHERE type_name = 'support'
UNION ALL
SELECT id, '/dashboard/customers' FROM auth.user_types WHERE type_name = 'support';

-- 3. Create users with this type
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google-id-here', 'support@ringer.tel', 'Support Team', id
FROM auth.user_types WHERE type_name = 'support';
```

**No code changes required** - just database inserts!

---

## Permission System

### Permission Database Schema

```sql
-- Permissions assigned to user types
CREATE TABLE auth.user_type_permissions (
    id UUID PRIMARY KEY,
    user_type_id UUID REFERENCES auth.user_types(id) ON DELETE CASCADE,
    resource_path VARCHAR(255) NOT NULL,
    UNIQUE(user_type_id, resource_path)
);

-- Metadata for UI display
CREATE TABLE auth.permission_metadata (
    resource_path VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100),          -- e.g., "Customer API", "Dashboard"
    display_name VARCHAR(255),      -- e.g., "List Customers"
    description TEXT,               -- User-friendly explanation
    display_order INTEGER DEFAULT 100,
    is_deprecated BOOLEAN DEFAULT false,
    icon VARCHAR(50)                -- For UI rendering
);
```

### 48 Permissions Across 12 Categories

```
System (1):
  * → Full platform access (SuperAdmin only)

Customer API (2):
  /api/v1/customers          → List customers
  /api/v1/customers/*        → All customer operations (CRUD)

Number API (1):
  /api/v1/dids/*             → Manage phone numbers/DIDs

Trunk API (1):
  /api/v1/trunks/*           → Manage SIP trunks

Messaging API (2):
  /api/v1/messages           → Send messages
  /api/v1/messages/*         → All messaging operations

CDR API (2):
  /api/v1/cdrs               → View CDRs
  /api/v1/cdrs/*             → All CDR operations

Analytics API (1):
  /api/v1/analytics/*        → Analytics and reporting

Voice Vendor API (2):
  /api/v1/admin/voice-vendors     → Manage voice vendors
  /api/v1/admin/voice-vendors/*   → All voice vendor operations

SMS Vendor API (2):
  /api/v1/admin/sms-vendors       → Manage SMS vendors
  /api/v1/admin/sms-vendors/*     → All SMS vendor operations

Partition API (2):
  /api/v1/admin/partitions        → Manage partitions
  /api/v1/admin/partitions/*      → All partition operations

User Management API (2):
  /api/v1/admin/users        → Manage users
  /api/v1/admin/users/*      → All user operations

Gatekeeper API (1):
  /api/v1/gatekeeper/*       → Permission checks

Dashboard (16 permissions):
  /dashboard                 → Dashboard home
  /dashboard/*               → All dashboard pages (wildcard)
  /dashboard/customers       → Customer management page
  /dashboard/vendors         → Vendor management page
  /dashboard/trunks          → Trunk management page
  /dashboard/numbers         → Number management page
  /dashboard/messages        → Messaging page
  /dashboard/cdrs            → CDR viewer
  /dashboard/usage           → Usage & billing page
  /dashboard/users           → User management page
  /dashboard/settings        → Settings page
  /dashboard/overview        → Overview page
  /dashboard/billing         → Billing page
  /dashboard/invoices        → Invoice page
  /dashboard/api-docs        → API documentation
  (and more...)
```

### Wildcard Matching Logic

**Supported Patterns** (`internal/gatekeeper/matcher.go`):

```go
// 1. Global wildcard (SuperAdmin only)
"*" matches EVERYTHING

// 2. Path prefix wildcard
"/api/v1/customers/*" matches:
  - "/api/v1/customers/123"
  - "/api/v1/customers/abc/trunks"
  - "/api/v1/customers/anything/nested"

// 3. Exact match
"/api/v1/customers" matches:
  - "/api/v1/customers" only
```

**Examples**:
```
Permission: "/api/v1/customers/*"

Requested: "/api/v1/customers"           → ❌ NO (exact mismatch)
Requested: "/api/v1/customers/123"       → ✅ YES
Requested: "/api/v1/customers/123/dids"  → ✅ YES
Requested: "/api/v1/trunks/456"          → ❌ NO
```

**Best Practice**: Grant both exact + wildcard for resource types:
```sql
-- Grant both for complete access
INSERT INTO auth.user_type_permissions (user_type_id, resource_path) VALUES
  (admin_type_id, '/api/v1/customers'),    -- List endpoint
  (admin_type_id, '/api/v1/customers/*');  -- CRUD endpoints
```

### Permission Matrix (By User Type)

| Permission | SuperAdmin | Admin | Customer Admin | Developer | Billing | Viewer |
|------------|------------|-------|----------------|-----------|---------|--------|
| `*` (wildcard) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `/api/v1/customers/*` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `/api/v1/messages/*` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/api/v1/trunks/*` | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| `/api/v1/billing/*` | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `/dashboard/*` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/dashboard/overview` | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

*(See database for complete matrix - 48 total permissions)*

---

## Customer Scoping (Multi-Tenancy)

### Database Schema

```sql
-- Maps users to customers they can access
CREATE TABLE auth.user_customer_access (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES accounts.customers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'USER',  -- USER, ADMIN, OWNER
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by VARCHAR(100),
    UNIQUE(user_id, customer_id)
);
```

### Three Access Levels

**1. SuperAdmin (Wildcard Access)**:
```sql
-- SuperAdmin has permission: "*"
-- user_customer_access: NO ENTRIES (doesn't need them)
-- Result: accessible_customer_ids = nil → Sees ALL customers
```

**2. Scoped User (Specific Customers)**:
```sql
-- Admin has permission: "/api/v1/customers/*"
-- user_customer_access:
INSERT INTO auth.user_customer_access (user_id, customer_id, role) VALUES
  ('admin-uuid', 'customer-A-uuid', 'ADMIN'),
  ('admin-uuid', 'customer-B-uuid', 'ADMIN');

-- Result: accessible_customer_ids = [customer-A-uuid, customer-B-uuid]
-- Query: WHERE id = ANY([customer-A-uuid, customer-B-uuid])
```

**3. No Access (Empty Assignments)**:
```sql
-- User has permissions but NO customer assignments
-- user_customer_access: NO ENTRIES for this user
-- Result: accessible_customer_ids = []  (empty slice)
-- Query returns: ZERO results (graceful, not error)
```

### How Scoping is Enforced

**Gatekeeper Middleware** (`internal/middleware/gatekeeper.go:92`):
```go
// Sets customer filter in request context
c.Set("accessible_customer_ids", result.AccessibleCustomers)
```

**Handler** (`internal/handlers/customers.go:164`):
```go
// Extracts customer filter
var customerFilter []uuid.UUID
if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
    customerFilter = accessibleCustomers.([]uuid.UUID)
}

// Passes to repository
customers, err := h.customerRepo.List(ctx, customerFilter, ...)
```

**Repository** (`internal/repository/customer.go:70`):
```go
if customerFilter != nil {
    if len(customerFilter) == 0 {
        return []models.Customer{}, 0, nil // No access
    }
    baseQuery += " AND id = ANY($1)"
    args = append(args, customerFilter)
}
```

**Result**: User only sees their assigned customers!

---

## Authentication Flow

### Google OAuth → WARP JWT

```
1. User clicks "Sign in with Google" in frontend
   ↓
2. Google OAuth popup → User selects account
   ↓
3. Google returns: google_id, email, name (to frontend)
   ↓
4. Frontend calls: POST /auth/exchange
   Body: {"google_id": "...", "email": "user@ringer.tel", "name": "..."}
   ↓
5. Backend validates email domain (@ringer.tel only)
   ↓
6. Backend queries: SELECT * FROM auth.users WHERE email = ?
   ↓
7. If user doesn't exist → Auto-create with "viewer" type
   If user exists → Update google_id if changed
   ↓
8. Backend generates: JWT access token (24h) + refresh token (7d)
   ↓
9. Frontend stores: localStorage.setItem('access_token', token)
   ↓
10. All subsequent requests: Authorization: Bearer <access_token>
```

**JWT Payload**:
```json
{
  "user_id": "uuid",
  "email": "user@ringer.tel",
  "user_type_id": "uuid",
  "user_type": "admin",
  "iat": 1698420000,
  "exp": 1698506400
}
```

**Token Refresh** (when expired):
```
POST /auth/refresh
Body: {"refresh_token": "..."}
Response: {"access_token": "new-token", ...}
```

### Auto-Creation Policy

**Current behavior** (`handlers/auth.go:70-100`):

```go
// If user doesn't exist, auto-create with "viewer" role
if user == nil {
    viewerTypeID := getTypeID("viewer")
    user = createUser(google_id, email, name, viewerTypeID)
}
```

**Domain Restriction** (`handlers/auth.go:54`):
```go
if !strings.HasSuffix(req.Email, "@ringer.tel") {
    return 403 Forbidden // Only @ringer.tel allowed
}
```

**Result**: Only Ringer employees can auto-create accounts. Customers must be invited.

---

## Authorization Flow (Request-Time)

### Complete Flow with Example

**Scenario**: Admin user (assigned to Customer A) requests customer list

**Step-by-Step**:

```
1. Request arrives
   GET /v1/customers?search=acme
   Authorization: Bearer eyJhbGci...

2. JWT Middleware (internal/middleware/jwt.go)
   → Validates token signature
   → Extracts claims: user_id, user_type_id, email
   → Sets context: c.Set("user_id", ...), c.Set("user_type_id", ...)
   → If invalid → 401 Unauthorized

3. Gatekeeper Middleware (internal/middleware/gatekeeper.go)
   → Queries permissions: SELECT resource_path FROM user_type_permissions WHERE user_type_id = ?
   → Returns: ["/api/v1/customers", "/api/v1/customers/*", ...]
   → Checks if "/v1/customers" matches any permission
   → Match found: "/api/v1/customers" ✅
   → Queries customer access: SELECT customer_id FROM user_customer_access WHERE user_id = ?
   → Returns: [customer-A-uuid]
   → Sets context: c.Set("accessible_customer_ids", [customer-A-uuid])
   → If no match → 403 Forbidden

4. Handler (internal/handlers/customers.go:149)
   → Extracts: customerFilter = c.Get("accessible_customer_ids")
   → Value: [customer-A-uuid]
   → Calls: customerRepo.List(ctx, [customer-A-uuid], "acme", ...)

5. Repository (internal/repository/customer.go:62)
   → Builds query:
     SELECT * FROM accounts.customers
     WHERE id = ANY([customer-A-uuid])
     AND company_name ILIKE '%acme%'
   → Returns: Only customers matching BOTH filters

6. Response
   {
     "success": true,
     "data": {
       "items": [
         {"id": "customer-A-uuid", "company_name": "Acme Corp", ...}
       ],
       "total": 1
     }
   }
```

**Result**: User only sees Customer A (their assigned customer), not B, C, D, etc.

---

## Frontend Security

### Frontend API Configuration

**Environment Variables** (`.env`):
```bash
VITE_API_URL=http://api.rns.ringer.tel  # ← WARP backend ONLY
VITE_GOOGLE_CLIENT_ID=791559065...      # ← Standard OAuth (not sensitive)
```

**Axios Client** (`hooks/useCustomers.ts:4-10`):
```typescript
const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,  // ← Points to WARP backend
});

// All requests automatically add JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### What Frontends CAN'T Do

**Frontends CANNOT**:
- ❌ Call HubSpot API directly (no API key exposed)
- ❌ Call Teliport API directly (no token exposed)
- ❌ Call Telique API directly (no token exposed)
- ❌ Bypass Gatekeeper (backend enforces on every request)
- ❌ Access other customers' data (filtered by backend)
- ❌ Elevate their own permissions (stored in database, not JWT)

**Frontends CAN**:
- ✅ Call WARP API Gateway endpoints (with JWT)
- ✅ Use Google OAuth for authentication (standard flow)
- ✅ Store JWT token in localStorage
- ✅ Make requests on behalf of logged-in user

### Third-Party API Proxying

**Example: HubSpot Company Search**

**Frontend calls** (admin-portal):
```typescript
// Frontend code
const response = await axios.get(
  `${API_URL}/v1/sync/hubspot/companies/search?q=acme`
);
```

**Backend proxies** (API Gateway):
```go
// internal/handlers/hubspot_sync.go
func (h *HubSpotSyncHandler) SearchHubSpotCompanies(c *gin.Context) {
    query := c.Query("q")

    // Backend makes HubSpot API call
    companies, err := h.hubspotClient.SearchCompanies(query)

    // Returns to frontend
    c.JSON(200, companies)
}
```

**HubSpot API key never exposed to browser** ✅

---

## Implementation Guide

### Adding a New Protected Endpoint

**Step 1: Define Permission** (SQL):
```sql
-- Add to permission_metadata (for UI)
INSERT INTO auth.permission_metadata (resource_path, category, display_name, description)
VALUES (
    '/api/v1/numbers/search',
    'Number API',
    'Search Numbers',
    'Search available telephone numbers for procurement'
);

-- Assign to user types that should have it
INSERT INTO auth.user_type_permissions (user_type_id, resource_path)
SELECT id, '/api/v1/numbers/search' FROM auth.user_types WHERE type_name IN ('superAdmin', 'admin', 'customer_admin');
```

**Step 2: Create Handler**:
```go
func (h *NumbersHandler) SearchNumbers(c *gin.Context) {
    // 1. Extract customer scoping
    var customerFilter []uuid.UUID
    if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessibleCustomers.([]uuid.UUID)
    }

    // 2. Business logic with filtering
    numbers, err := h.numbersRepo.Search(ctx, customerFilter, query, ...)

    // 3. Response
    c.JSON(200, models.NewSuccessResponse(numbers))
}
```

**Step 3: Register Route** (`main.go`):
```go
v1 := router.Group("/v1")
v1.Use(jwtMiddleware.Authenticate())         // JWT validation
v1.Use(gatekeeperMiddleware.CheckPermission()) // Permission check
{
    numbers := v1.Group("/numbers")
    {
        numbers.POST("/search", numbersHandler.SearchNumbers)
    }
}
```

**That's it!** Gatekeeper automatically enforces permissions.

---

### Adding Customer-Scoped Resource

**Pattern for ANY resource that belongs to a customer** (DIDs, Trunks, Messages, CDRs):

**Repository**:
```go
func (r *ResourceRepository) List(ctx context.Context, customerFilter []uuid.UUID, ...) ([]Resource, error) {
    baseQuery := "FROM resources WHERE 1=1"
    args := []interface{}{}

    // Customer scoping (CRITICAL!)
    if customerFilter != nil {
        if len(customerFilter) == 0 {
            return []Resource{}, 0, nil
        }
        baseQuery += " AND customer_id = ANY($1)"
        args = append(args, customerFilter)
    }

    // ... rest of query
}
```

**Handler**:
```go
func (h *ResourceHandler) ListResources(c *gin.Context) {
    // Extract scoping
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }

    // Query with filter
    resources, err := h.repo.List(ctx, customerFilter, ...)
    c.JSON(200, resources)
}
```

**For Get/Update/Delete by ID**:
```go
func (h *ResourceHandler) GetResource(c *gin.Context) {
    id := c.Param("id")

    // Verify access
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }

    // Get resource
    resource, err := h.repo.GetByID(ctx, id)

    // Verify it belongs to accessible customer
    if err := h.repo.VerifyCustomerOwnership(resource.CustomerID, customerFilter); err != nil {
        c.JSON(403, "Access denied")
        return
    }

    c.JSON(200, resource)
}
```

---

## Testing Multi-Tenancy

### Create Test Users

```sql
-- Create admin user assigned to TEST-001 only
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google_admin_test', 'admin@ringer.tel', 'Admin User', id
FROM auth.user_types WHERE type_name = 'admin';

INSERT INTO auth.user_customer_access (user_id, customer_id, role)
SELECT u.id, c.id, 'ADMIN'
FROM auth.users u, accounts.customers c
WHERE u.email = 'admin@ringer.tel' AND c.ban = 'TEST-001';

-- Create customer_admin user assigned to DEMO-002 only
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google_customer_test', 'customer@test.com', 'Customer User', id
FROM auth.user_types WHERE type_name = 'customer_admin';

INSERT INTO auth.user_customer_access (user_id, customer_id, role)
SELECT u.id, c.id, 'USER'
FROM auth.users u, accounts.customers c
WHERE u.email = 'customer@test.com' AND c.ban = 'DEMO-002';
```

### Test Isolation

**Test 1: SuperAdmin Sees Everything**
```bash
# Login as david.aldworth@ringer.tel
curl -X POST http://api.rns.ringer.tel/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{"google_id":"...","email":"david.aldworth@ringer.tel","name":"David"}'

# List customers
curl -H "Authorization: Bearer $TOKEN" \
  http://api.rns.ringer.tel/v1/customers

# Expected: 3 customers (TEST-001, DEMO-002, TB-071161708)
```

**Test 2: Admin Sees Only Assigned Customer**
```bash
# Login as admin@ringer.tel
# (same exchange flow)

# List customers
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://api.rns.ringer.tel/v1/customers

# Expected: 1 customer (TEST-001 only)

# Try to access DEMO-002 (not assigned)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://api.rns.ringer.tel/v1/customers/{demo-002-uuid}

# Expected: 403 Forbidden
```

**Test 3: Customer Admin Sees Own Customer**
```bash
# Login as customer@test.com

# List customers (if has permission)
curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  http://api.rns.ringer.tel/v1/customers

# Expected: 1 customer (DEMO-002 only)

# Dashboard stats
curl -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  http://api.rns.ringer.tel/v1/dashboard/stats

# Expected: {"total_customers": 1, "active_customers": 1, ...}
```

---

## Common Patterns

### Pattern 1: List Resources (Customer-Scoped)

```go
func (h *Handler) ListResources(c *gin.Context) {
    // ALWAYS extract customer filter
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }

    // Pass to repository
    resources, total, err := h.repo.List(ctx, customerFilter, otherParams...)

    c.JSON(200, models.NewListResponse(resources, page, perPage, total))
}
```

### Pattern 2: Get Single Resource (Verify Access)

```go
func (h *Handler) GetResource(c *gin.Context) {
    id := parseUUID(c.Param("id"))

    // Extract customer filter
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }

    // Get resource
    resource, err := h.repo.GetByID(ctx, id)
    if err != nil { /* handle */ }

    // Verify user can access this customer
    if err := h.repo.VerifyCustomerAccess(resource.CustomerID, customerFilter); err != nil {
        c.JSON(403, "Access denied")
        return
    }

    c.JSON(200, resource)
}
```

### Pattern 3: Aggregations (Dashboard Stats)

```go
func (h *DashboardHandler) GetStats(c *gin.Context) {
    // Extract customer filter
    var customerFilter []uuid.UUID
    if accessible, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessible.([]uuid.UUID)
    }

    // Build WHERE clause based on filter
    var whereClause string
    var args []interface{}

    if customerFilter != nil {
        if len(customerFilter) == 0 {
            // No access - return zeros
            return DashboardStats{}
        }
        whereClause = " WHERE customer_id = ANY($1)"
        args = append(args, customerFilter)
    }
    // If nil (SuperAdmin), no WHERE clause

    // Query with filter
    var totalCalls int
    db.QueryRow("SELECT COUNT(*) FROM cdrs" + whereClause, args...).Scan(&totalCalls)

    c.JSON(200, DashboardStats{TotalCalls: totalCalls, ...})
}
```

---

## FAQ

### Q: Can I check user type in handler code?

**A**: You CAN, but you SHOULDN'T.

```go
// ❌ BAD - Hard-coded role check
userType := c.GetString("user_type")
if userType == "admin" {
    // do something
}

// ✅ GOOD - Permission-based
// Just implement the feature and let Gatekeeper control who can access it
// Add permission to user types that need it via SQL
```

**Why**: Hard-coding defeats the purpose of database-driven permissions. If you need different behavior, create different endpoints with different permissions.

---

### Q: What if I need to check if user is SuperAdmin?

**A**: Check for wildcard permission, not user type name.

```go
// ✅ CORRECT way
hasWildcard := c.GetBool("has_wildcard")
if hasWildcard {
    // SuperAdmin logic
} else {
    // Regular user logic
}
```

This works even if we rename "superAdmin" to something else later.

---

### Q: How do I grant a user access to multiple customers?

**A**: Insert multiple rows in `user_customer_access`:

```sql
-- Admin user gets access to Customer A, B, and C
INSERT INTO auth.user_customer_access (user_id, customer_id, role) VALUES
  ((SELECT id FROM auth.users WHERE email = 'admin@ringer.tel'),
   (SELECT id FROM accounts.customers WHERE ban = 'TEST-001'), 'ADMIN'),
  ((SELECT id FROM auth.users WHERE email = 'admin@ringer.tel'),
   (SELECT id FROM accounts.customers WHERE ban = 'DEMO-002'), 'ADMIN'),
  ((SELECT id FROM auth.users WHERE email = 'admin@ringer.tel'),
   (SELECT id FROM accounts.customers WHERE ban = 'TB-071161708'), 'ADMIN');

-- Result: accessible_customer_ids = [uuid-A, uuid-B, uuid-C]
```

---

### Q: What's the difference between permission and customer access?

**A**: Two-level security:

**Level 1 - Permission**: "Can this user access `/v1/customers` endpoint AT ALL?"
- Checked by: Gatekeeper middleware
- Source: `auth.user_type_permissions`
- Result: 200 or 403

**Level 2 - Customer Scoping**: "WHICH customers can this user see?"
- Checked by: Handler + Repository
- Source: `auth.user_customer_access`
- Result: Filtered data set

**Example**:
```
User: admin@ringer.tel
Permission: /api/v1/customers/* ✅ (can access endpoint)
Customer Access: [TEST-001] ✅ (but only sees TEST-001 data)

Request: GET /v1/customers
Step 1: Gatekeeper → ALLOW (has permission)
Step 2: Handler → Filter to [TEST-001]
Step 3: Repository → WHERE id = 'TEST-001-uuid'
Result: Returns TEST-001 only
```

---

## Related Documentation

- **[PERMISSION_SYSTEM_ADAPTATION.md](PERMISSION_SYSTEM_ADAPTATION.md)** - Original design document
- **[../services/api-gateway/AUTH_DEPLOYMENT_GUIDE.md](../services/api-gateway/AUTH_DEPLOYMENT_GUIDE.md)** - Deployment procedures
- **[../services/api-gateway/CUSTOMER_SCOPING_FIX.md](../services/api-gateway/CUSTOMER_SCOPING_FIX.md)** - Recent fix details
- **[API_DESIGN_FOUNDATION.md](API_DESIGN_FOUNDATION.md)** - All API endpoints

---

## Security Best Practices

1. **Never bypass Gatekeeper**
   - All protected endpoints MUST use JWT + Gatekeeper middleware
   - Never create "admin-only" routes without permission checks

2. **Always extract customer filter**
   - Every handler that queries customer data must get `accessible_customer_ids`
   - Pass to repository for filtering

3. **Verify ownership for single-resource operations**
   - GetByID, Update, Delete should verify resource belongs to accessible customer
   - Return 403 if not accessible (not 404 - information leakage)

4. **Never expose third-party credentials**
   - API keys stored in backend environment only
   - Frontend calls WARP endpoints which proxy to third parties

5. **Log security events**
   - Log permission denials with user_id and resource
   - Monitor for suspicious access patterns
   - Alert on repeated 403 responses

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-11 | Platform Eng | Initial permission system (Firebase-based) |
| 2.0.0 | 2025-10-27 | Platform Eng | Updated for Google OAuth, customer scoping fixes |

**Next Review**: 2025-11-27
**Status**: ✅ Complete and accurate as of October 27, 2025
