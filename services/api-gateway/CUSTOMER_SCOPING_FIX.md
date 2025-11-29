# Customer Scoping Fix - Multi-Tenant Data Isolation

**Date**: October 27, 2025
**Version**: API Gateway v2.3.0 (pending)
**Status**: Code Complete - Awaiting Testing

---

## Problem Statement

**Security Issue**: Handlers were not enforcing multi-tenant data isolation. While Gatekeeper middleware correctly set `accessible_customer_ids` in request context, handlers ignored this and returned ALL customer data regardless of user permissions.

**Impact**:
- ❌ Non-SuperAdmin users would see all customers (not just their assigned ones)
- ❌ Data isolation broken
- ❌ GDPR/privacy compliance risk
- ❌ Customer data leakage between tenants

**Root Cause**: Gatekeeper middleware provided scoping, but handlers/repositories didn't consume it.

---

## Solution Implemented

### Changes Made

**1. Repository Layer** (`internal/repository/customer.go`)

Added customer filtering to `List()` method:

```go
// BEFORE
func (r *CustomerRepository) List(ctx context.Context, search string, status string, page, perPage int) ([]models.Customer, int64, error)

// AFTER
func (r *CustomerRepository) List(ctx context.Context, customerFilter []uuid.UUID, search string, status string, page, perPage int) ([]models.Customer, int64, error)
```

**Customer Filter Semantics**:
- `nil` → SuperAdmin (wildcard access) - Returns ALL customers
- `[]uuid{}` (empty slice) → No access - Returns ZERO customers
- `[uuid1, uuid2, ...]` → Scoped access - Returns ONLY these customers

**Implementation**:
```go
if customerFilter != nil {
    if len(customerFilter) == 0 {
        return []models.Customer{}, 0, nil // No access
    }
    baseQuery += " AND id = ANY($1)"
    args = append(args, customerFilter)
}
```

Added verification helper:

```go
// VerifyCustomerAccess checks if a customer ID is accessible
func (r *CustomerRepository) VerifyCustomerAccess(customerID uuid.UUID, customerFilter []uuid.UUID) error
```

---

**2. Handler Layer** (`internal/handlers/customers.go`)

**Fixed `ListCustomers()`**:
```go
// Extract scoping from Gatekeeper context
var customerFilter []uuid.UUID
if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
    customerFilter = accessibleCustomers.([]uuid.UUID)
}

// Pass to repository (respects scoping)
customers, total, err := h.customerRepo.List(ctx, customerFilter, search, status, page, perPage)
```

**Fixed `GetCustomer()`**:
```go
// Verify access before returning customer
if err := h.customerRepo.VerifyCustomerAccess(id, customerFilter); err != nil {
    c.JSON(403, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
    return
}
```

**Fixed `UpdateCustomer()`**:
```go
// Verify access before allowing update
if err := h.customerRepo.VerifyCustomerAccess(id, customerFilter); err != nil {
    c.JSON(403, models.NewErrorResponse("ACCESS_DENIED", "You don't have access to this customer"))
    return
}
```

---

**3. Dashboard Handler** (`internal/handlers/dashboard.go`)

Updated constructor to accept database pool:
```go
// BEFORE
func NewDashboardHandler() *DashboardHandler

// AFTER
func NewDashboardHandler(db *pgxpool.Pool) *DashboardHandler
```

**Fixed `GetStats()`** to filter customer counts:
```go
// SuperAdmin sees all customers
if customerFilter == nil {
    query = "SELECT COUNT(*) FROM accounts.customers"
} else if len(customerFilter) == 0 {
    // No customers accessible
    return stats with zero counts
} else {
    // Filter to accessible customers
    query = "SELECT COUNT(*) FROM accounts.customers WHERE id = ANY($1)"
}
```

**Updated `main.go:106`** to pass db pool to DashboardHandler.

---

## Files Modified

```
services/api-gateway/
├── internal/
│   ├── repository/
│   │   └── customer.go          ✅ Added customerFilter param + VerifyCustomerAccess()
│   ├── handlers/
│   │   ├── customers.go         ✅ All methods extract and use customerFilter
│   │   └── dashboard.go         ✅ GetStats() filters by accessible customers
│   └── cmd/server/
│       └── main.go               ✅ Updated DashboardHandler initialization
└── CUSTOMER_SCOPING_FIX.md      ✅ This document
```

**Lines Changed**: ~80 lines across 4 files

---

## Testing Requirements

### Test Scenario 1: SuperAdmin (Wildcard Access)

**User**: `david.aldworth@ringer.tel` (user_type: superAdmin)

**Expected**:
```bash
# List all customers (should see all 3)
GET /v1/customers
Response: 3 customers (TB-071161708, DEMO-002, TEST-001)

# Get any customer by ID
GET /v1/customers/{any-uuid}
Response: Customer details (200 OK)

# Update any customer
PUT /v1/customers/{any-uuid}
Response: Updated successfully (200 OK)

# Dashboard stats
GET /v1/dashboard/stats
Response: total_customers: 3, active_customers: 3
```

**Result**: ✅ No filtering (backward compatible with current behavior)

---

### Test Scenario 2: Admin User (Assigned to Specific Customers)

**Create test user**:
```sql
-- Create admin user
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google_id_admin_test', 'admin@ringer.tel', 'Admin Test', id
FROM auth.user_types WHERE type_name = 'admin';

-- Assign to TEST-001 customer only
INSERT INTO auth.user_customer_access (user_id, customer_id, role)
SELECT u.id, c.id, 'ADMIN'
FROM auth.users u, accounts.customers c
WHERE u.email = 'admin@ringer.tel' AND c.ban = 'TEST-001';
```

**Expected**:
```bash
# List customers (should see only TEST-001)
GET /v1/customers
Response: 1 customer (TEST-001 only)

# Get TEST-001 customer
GET /v1/customers/{test-001-uuid}
Response: Customer details (200 OK) ✅

# Get DEMO-002 customer (NOT assigned)
GET /v1/customers/{demo-002-uuid}
Response: 403 Forbidden - "You don't have access to this customer" ✅

# Update TEST-001 (allowed)
PUT /v1/customers/{test-001-uuid}
Response: Updated successfully (200 OK) ✅

# Update DEMO-002 (forbidden)
PUT /v1/customers/{demo-002-uuid}
Response: 403 Forbidden ✅

# Dashboard stats
GET /v1/dashboard/stats
Response: total_customers: 1, active_customers: 1
```

**Result**: ✅ Perfect data isolation

---

### Test Scenario 3: Customer Admin (Own Customer Only)

**Create test user**:
```sql
-- Create customer_admin user
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google_id_customer_test', 'customer@test.com', 'Customer User', id
FROM auth.user_types WHERE type_name = 'customer_admin';

-- Assign to DEMO-002 customer
INSERT INTO auth.user_customer_access (user_id, customer_id, role)
SELECT u.id, c.id, 'USER'
FROM auth.users u, accounts.customers c
WHERE u.email = 'customer@test.com' AND c.ban = 'DEMO-002';
```

**Expected**:
```bash
# List customers (should see only DEMO-002)
GET /v1/customers
Response: 403 Forbidden (customer_admin doesn't have /api/v1/customers permission) ⚠️

# If we grant permission:
Response: 1 customer (DEMO-002 only) ✅

# Dashboard stats
GET /v1/dashboard/stats
Response: total_customers: 1, active_customers: 1 ✅
```

**Note**: customer_admin user type needs `/api/v1/customers` permission added to see customer list.

---

### Test Scenario 4: User with No Customer Assignments

**Create test user**:
```sql
-- Create admin user but DON'T assign any customers
INSERT INTO auth.users (google_id, email, display_name, user_type_id)
SELECT 'google_id_no_access', 'noaccess@ringer.tel', 'No Access User', id
FROM auth.user_types WHERE type_name = 'admin';

-- NO entry in user_customer_access for this user
```

**Expected**:
```bash
# List customers (has permission, but no customer assignments)
GET /v1/customers
Response: {"items": [], "total": 0} ✅ Empty list (not error)

# Dashboard stats
GET /v1/dashboard/stats
Response: total_customers: 0, active_customers: 0 ✅
```

**Result**: ✅ Graceful empty response (not 403)

---

## Security Impact

**Before Fix**:
```
Admin user assigned to Customer A
  ↓
GET /v1/customers
  ↓
Returns: Customer A, Customer B, Customer C (ALL customers) ❌
```

**After Fix**:
```
Admin user assigned to Customer A
  ↓
GET /v1/customers
  ↓
Gatekeeper sets: accessible_customer_ids = [Customer A UUID]
  ↓
Handler extracts: customerFilter = [Customer A UUID]
  ↓
Repository queries: WHERE id = ANY([Customer A UUID])
  ↓
Returns: Customer A only ✅
```

---

## Migration Impact

**Backward Compatibility**: ✅ **100% Compatible**

**For SuperAdmin** (like david.aldworth@ringer.tel):
- `accessible_customer_ids` = `nil` (wildcard)
- Query runs **WITHOUT** customer filter
- Returns all customers (existing behavior)
- **Zero behavior change**

**For Other Users**:
- Previously wouldn't work anyway (no users exist)
- Now works correctly with proper scoping
- **New functionality, not breaking change**

**Database Changes**: ❌ **None required**
- Uses existing `auth.user_customer_access` table
- No schema migrations needed

**Frontend Changes**: ❌ **None required**
- Frontends call same endpoints
- Response format unchanged
- Just filtered data set

---

## Deployment Checklist

**Before Deploying**:
- [ ] Review code changes (git diff)
- [ ] Build Docker image
- [ ] Tag as v2.3.0
- [ ] Push to registry

**During Deployment**:
- [ ] Deploy to GKE (kubectl apply / rollout)
- [ ] Monitor pod startup logs
- [ ] Verify health checks passing

**After Deployment**:
- [ ] Test as SuperAdmin (verify no regression)
- [ ] Create test admin user
- [ ] Assign to one customer
- [ ] Verify scoping works
- [ ] Update API version in documentation

**Testing Commands**:
```bash
# Test SuperAdmin still works
curl -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
  http://api.rns.ringer.tel/v1/customers

# Test admin user sees only assigned customer
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://api.rns.ringer.tel/v1/customers

# Test customer access denied
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://api.rns.ringer.tel/v1/customers/{unassigned-customer-id}
# Expected: 403 Forbidden
```

---

## Future Enhancements

**Apply Same Pattern To**:
- [ ] Trunk endpoints (`/v1/trunks/*`)
- [ ] DID endpoints (`/v1/dids/*`)
- [ ] Message endpoints (`/v1/messages/*`)
- [ ] CDR endpoints (`/v1/cdrs/*`)
- [ ] Billing endpoints (`/v1/billing/*`)

**Each new resource handler should**:
1. Extract `accessible_customer_ids` from context
2. Pass to repository as filter parameter
3. Repository builds `WHERE id = ANY($customerFilter)` clause

**Template**:
```go
func (h *ResourceHandler) ListResources(c *gin.Context) {
    // Get customer scoping
    var customerFilter []uuid.UUID
    if accessibleCustomers, exists := c.Get("accessible_customer_ids"); exists {
        customerFilter = accessibleCustomers.([]uuid.UUID)
    }

    // Query with filter
    resources, total, err := h.repo.List(ctx, customerFilter, ...)
    c.JSON(200, models.NewListResponse(resources, page, perPage, total))
}
```

---

## Documentation Updates Required

- [ ] Update `docs/AUTH_AND_PERMISSION_SYSTEM.md` (to be created)
- [ ] Update `docs/API_DESIGN_FOUNDATION.md` (note scoping behavior)
- [ ] Update root `CLAUDE.md` (current authorization status)
- [ ] Create handler development guide (scoping pattern)

---

## Related Issues

**GitHub Issues** (if using issue tracker):
- #NNN: "Multi-tenant data isolation not enforced"
- #NNN: "Admin users can see all customers"

**Pull Request**:
- PR #NNN: "Fix customer scoping in handlers for multi-tenant isolation"

---

## Approval & Sign-off

**Code Review**: ⏳ Pending
**Security Review**: ⏳ Pending
**QA Testing**: ⏳ Pending
**Approved for Deployment**: ⏳ Pending

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-10-27 | Platform Engineering | Initial fix documentation |

**Related Docs**:
- `docs/PERMISSION_SYSTEM_ADAPTATION.md` - Permission system design
- `services/api-gateway/AUTH_DEPLOYMENT_GUIDE.md` - Auth setup guide

**Status**: ✅ **CODE COMPLETE - READY FOR BUILD & TEST**
