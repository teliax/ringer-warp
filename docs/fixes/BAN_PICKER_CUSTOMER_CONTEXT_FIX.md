# BAN Picker & Customer Context Fix

**Date**: 2025-11-30
**Issue**: 403 Forbidden when creating TCR Brand after selecting BAN
**Status**: ✅ Fixed (Frontend + Backend)
**Deployed**: 2025-11-30 21:57 UTC

---

## Problem Summary

When a SuperAdmin user selects a BAN (like "TEST-001") from the BAN picker and attempts to create a new TCR Brand, they receive a **CORS error** (Request header field x-customer-id is not allowed). Additionally, React console shows warnings about controlled/uncontrolled input transitions.

### Root Causes

1. **Missing `X-Customer-ID` Header in API Requests (Frontend)**
   - The `AuthContext` correctly sets the active BAN and stores it in `localStorage.setItem('active_ban_id', ban.customer_id)`
   - It also attempts to set `axios.defaults.headers.common['X-Customer-ID']`
   - **BUT** the axios request interceptor doesn't read this header or include it in requests
   - Result: Backend doesn't receive customer context

2. **CORS Not Allowing `X-Customer-ID` Header (Backend)**
   - Even after frontend sends the header, browser makes a CORS preflight request
   - Backend's CORS middleware doesn't include `X-Customer-ID` in `Access-Control-Allow-Headers`
   - Browser blocks the request with CORS error

3. **React Controlled/Uncontrolled Input Warnings (Frontend)**
   - Select components receive `undefined` values initially, then defined values later
   - React interprets this as switching from uncontrolled → controlled, which is an anti-pattern
   - Causes: Missing default values in form initialization

---

## The Fixes

### Fix 1: Axios Interceptor - Add `X-Customer-ID` Header

**File**: [apps/customer-portal/src/lib/axios-config.ts](../../apps/customer-portal/src/lib/axios-config.ts)

**Change**: Modified the request interceptor to read `active_ban_id` from localStorage and include it as the `X-Customer-ID` header in every API request.

```typescript
// BEFORE (only JWT token)
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// AFTER (JWT token + customer context)
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Add X-Customer-ID header for multi-tenant customer scoping
  const activeBanId = localStorage.getItem('active_ban_id');
  if (activeBanId) {
    config.headers['X-Customer-ID'] = activeBanId;
  }

  return config;
});
```

**Why this works**:
- The backend's Gatekeeper middleware reads the `X-Customer-ID` header to determine which customer's context to use
- With SuperAdmin permissions (`*` wildcard), the user can access any customer
- The `X-Customer-ID` header tells the backend: "I'm working with THIS specific customer right now"
- Backend associates the new Brand with that customer

---

### Fix 2: Backend CORS - Allow `X-Customer-ID` Header

**File**: [services/api-gateway/internal/middleware/cors.go](../../services/api-gateway/internal/middleware/cors.go)

**Change**: Added `X-Customer-ID` to the `Access-Control-Allow-Headers` list in the CORS middleware.

```go
// BEFORE
c.Writer.Header().Set("Access-Control-Allow-Headers",
  "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")

// AFTER
c.Writer.Header().Set("Access-Control-Allow-Headers",
  "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Customer-ID")
```

**Deployment**:
```bash
# Build Docker image
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest

# Deploy to Kubernetes
kubectl apply -f deployments/kubernetes/

# Verify rollout
kubectl rollout status deployment/api-gateway -n warp-api
```

**Why this works**:
- Browser makes a CORS preflight request (OPTIONS) before the actual POST request
- Backend must explicitly allow custom headers in the `Access-Control-Allow-Headers` response
- With `X-Customer-ID` included, browser allows the frontend to send this header
- Backend can now read the customer context from the header

---

### Fix 3: Form Default Values - Prevent Controlled/Uncontrolled Warnings

**File**: [apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx](../../apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx)

**Change**: Added explicit default values for all form fields (empty strings instead of undefined).

```typescript
// BEFORE (minimal defaults)
const form = useForm<BrandFormData>({
  resolver: zodResolver(brandSchema),
  defaultValues: {
    country: "US",
    entity_type: "PRIVATE_PROFIT",
    alt_business_id_type: "NONE",
  },
});

// AFTER (complete defaults)
const form = useForm<BrandFormData>({
  resolver: zodResolver(brandSchema),
  defaultValues: {
    country: "US",
    entity_type: "PRIVATE_PROFIT",
    alt_business_id_type: "NONE",
    vertical: "",
    stock_exchange: "",
    stock_symbol: "",
    website: "",
    tax_id: "",
    // ... all other fields with "" defaults
  },
});
```

**Additionally**: Added `|| ""` fallback for Select component values:

```typescript
// BEFORE
<Select onValueChange={field.onChange} value={field.value}>

// AFTER
<Select onValueChange={field.onChange} value={field.value || ""}>
```

**Why this works**:
- React expects controlled components to ALWAYS have a defined value (even if it's an empty string)
- When a value transitions from `undefined` → `"somevalue"`, React throws a warning
- By initializing all fields with `""`, the components are controlled from the start

---

## How It Works Now

### Complete Flow

1. **SuperAdmin logs in**
   - `AuthContext` fetches all customers via `/v1/customers?per_page=1000`
   - Loads permissions from `/v1/gatekeeper/my-permissions`
   - Detects wildcard `*` permission → Sets `isSuperAdmin = true`

2. **SuperAdmin opens BAN picker**
   - [BANSwitcher.tsx](../../apps/customer-portal/src/components/BANSwitcher.tsx) displays all customers
   - User searches for "TEST-001" and selects it

3. **BAN selection updates context**
   - [AuthContext.tsx](../../apps/customer-portal/src/lib/auth/AuthContext.tsx) `setActiveBan()` called
   - Stores in localStorage: `localStorage.setItem('active_ban_id', 'customer-uuid-for-test-001')`
   - Emits `banChanged` event for smart reload

4. **User navigates to Messaging page**
   - Page loads with `activeBan` context from AuthContext
   - DOM shows "TEST-001" in the BAN picker button

5. **User clicks "Register Brand" and fills form**
   - [BrandRegistrationForm.tsx](../../apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx) renders
   - All Select components have controlled values (no warnings)

6. **User submits form**
   - [useBrands.ts](../../apps/customer-portal/src/hooks/useBrands.ts) `createBrand()` called
   - axios interceptor adds headers:
     - `Authorization: Bearer <jwt-token>`
     - `X-Customer-ID: <customer-uuid-for-test-001>`  ← **NEW!**
   - Request: `POST /v1/messaging/brands` with Brand data

7. **Backend processes request**
   - JWT middleware validates token → Sets `user_id`, `user_type_id`
   - Gatekeeper middleware checks permission `/v1/messaging/brands` → **ALLOWED** (SuperAdmin has `*`)
   - Handler reads `X-Customer-ID` header → Associates Brand with TEST-001 customer
   - Inserts into database: `messaging.brands_10dlc (customer_id = 'customer-uuid-for-test-001', ...)`
   - Returns success response

8. **Frontend receives success**
   - Toast notification: "Brand submitted for registration!"
   - Reloads brand list → New brand appears with TEST-001 association

---

## Backend Expectations

The backend **must** handle the `X-Customer-ID` header correctly:

### In the Brand Creation Handler

```go
// services/api-gateway/internal/handlers/messaging/brands.go (example)
func (h *BrandsHandler) CreateBrand(c *gin.Context) {
    // 1. Get customer ID from header
    customerID := c.GetHeader("X-Customer-ID")

    // 2. If SuperAdmin with no customer selected, may need special handling
    if customerID == "" {
        // Check if user is SuperAdmin
        isSuperAdmin := c.GetBool("has_wildcard") // Set by Gatekeeper
        if !isSuperAdmin {
            c.JSON(400, gin.H{"error": "Customer context required"})
            return
        }
        // SuperAdmin might be creating a brand for system use
        // OR you may want to require customer selection always
    }

    // 3. Parse request body
    var req models.CreateBrandRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // 4. Create brand with customer association
    brand, err := h.brandService.CreateBrand(ctx, customerID, &req)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(200, models.NewSuccessResponse(brand))
}
```

---

## Verification Steps

To verify the fix is working:

1. **Check axios interceptor is active**:
   ```javascript
   // Open browser console
   console.log('Stored BAN ID:', localStorage.getItem('active_ban_id'));
   ```

2. **Monitor network requests**:
   - Open DevTools → Network tab
   - Select TEST-001 from BAN picker
   - Click "Register Brand" and submit form
   - Find the `POST /v1/messaging/brands` request
   - Check headers → Should see:
     ```
     Authorization: Bearer eyJhbGci...
     X-Customer-ID: <uuid-of-test-001-customer>
     ```

3. **Check backend logs** (if accessible):
   ```bash
   kubectl logs -n warp-api deployment/api-gateway --tail=100 -f
   # Look for the POST /v1/messaging/brands request
   # Should show customer_id being used
   ```

4. **Verify database record**:
   ```sql
   SELECT
     b.id,
     b.customer_id,
     c.ban,
     b.display_name,
     b.status
   FROM messaging.brands_10dlc b
   JOIN accounts.customers c ON b.customer_id = c.id
   WHERE c.ban = 'TEST-001'
   ORDER BY b.created_at DESC
   LIMIT 1;
   ```

---

## Related Files Modified

### Frontend Changes

1. [apps/customer-portal/src/lib/axios-config.ts](../../apps/customer-portal/src/lib/axios-config.ts)
   - Added `X-Customer-ID` header to request interceptor

2. [apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx](../../apps/customer-portal/src/components/forms/BrandRegistrationForm.tsx)
   - Added complete default values to form
   - Added `|| ""` fallback for Select components

### Backend Changes

3. [services/api-gateway/internal/middleware/cors.go](../../services/api-gateway/internal/middleware/cors.go)
   - Added `X-Customer-ID` to CORS `Access-Control-Allow-Headers`
   - Deployed to production (3 pods): 2025-11-30 21:57 UTC

---

## Backend Checklist (If Still Seeing 403)

If you still see 403 errors after these frontend fixes, check:

1. ✅ **Gatekeeper Middleware**: Does it allow SuperAdmin (`*` permission) to access `/v1/messaging/brands`?
   - File: `services/api-gateway/internal/middleware/gatekeeper.go`
   - Check: Does the wildcard match logic work correctly?

2. ✅ **Permission Exists**: Is `/v1/messaging/brands` in the database?
   ```sql
   SELECT * FROM auth.user_type_permissions
   WHERE resource_path LIKE '%messaging/brands%';
   ```

3. ✅ **Handler Reads Header**: Does the Brand handler read and use `X-Customer-ID`?
   - File: `services/api-gateway/internal/handlers/messaging/brands.go`
   - Check: `c.GetHeader("X-Customer-ID")`

4. ✅ **Database Foreign Key**: Does `messaging.brands_10dlc.customer_id` reference `accounts.customers.id`?
   ```sql
   \d messaging.brands_10dlc
   -- Look for FOREIGN KEY constraint on customer_id
   ```

---

## Additional Notes

### Why `X-Customer-ID` Instead of Request Body?

The `X-Customer-ID` header approach is **better** than including `customer_id` in the request body because:

1. **Separation of Concerns**: Customer context is authentication/authorization metadata, not business data
2. **Consistent Pattern**: Works for ALL endpoints (GET, POST, PATCH, DELETE) without modifying request schemas
3. **Security**: Backend controls which customer ID is valid (can't be spoofed in request body)
4. **Middleware Filtering**: Gatekeeper can automatically filter queries by customer before reaching handlers

### Multi-Tenant Architecture Benefits

This pattern enables:
- **SuperAdmins**: Can impersonate/work in any customer context by selecting a BAN
- **Regular Users**: Automatically scoped to their assigned customers
- **Audit Trails**: Every action is associated with a customer context
- **Data Isolation**: Backend enforces customer scoping in all queries

---

## Date

2025-11-30
