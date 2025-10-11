# Adapting ringer-soa Permission System to WARP Platform

## Side-by-Side Comparison

### **ringer-soa (Reference System)**

```
Stack:
  Frontend: Next.js 14 + TypeScript
  Backend: Spring Boot (Java)
  Database: PostgreSQL
  Auth: Firebase → Custom JWT

Pattern:
  1. Next.js API proxy (/api/proxy/*)
  2. Proxy adds session token to backend request
  3. Spring Boot validates JWT
  4. @PreAuthorize("isAuthenticated()") on all endpoints
  5. GatekeeperController checks permissions
  6. Data filtered by customer access
```

### **WARP Platform (What We're Building)**

```
Stack:
  Frontend: React + Vite + TypeScript
  Backend: Go API Gateway (Gin)
  Database: PostgreSQL (Cloud SQL)
  Auth: Firebase → Direct ID token

Pattern:
  1. React app calls backend directly (no proxy)
  2. Frontend sends Firebase ID token in header
  3. Go middleware verifies Firebase token
  4. Gatekeeper middleware checks permissions
  5. Data filtered by customer access
```

---

## Key Differences

### **1. No Server-Side Proxy**

**ringer-soa:**
```
Browser → Next.js /api/proxy → Spring Boot backend
         (session token)      (JWT token)
```

**WARP:**
```
Browser → Go API Gateway
        (Firebase ID token directly)
```

**Implication:**
- Frontend must handle token refresh
- CORS must be configured on Go backend
- Firebase SDK in browser, not server

### **2. Language/Framework Adaptation**

**ringer-soa:**
```java
@RestController
@PreAuthorize("isAuthenticated()")
public class CustomerController {
    @GetMapping("/api/v1/admin/customers")
    public List<Customer> getCustomers() {
        // Gatekeeper already checked permission
        return customerService.getCustomers(currentUser);
    }
}
```

**WARP (Go):**
```go
func (h *CustomerHandler) ListCustomers(c *gin.Context) {
    // Gatekeeper middleware already checked permission
    customerIDs := c.GetStringSlice("accessible_customer_ids")

    customers, err := h.customerRepo.List(
        c.Request.Context(),
        customerIDs, // Filter by accessible customers
    )

    c.JSON(200, customers)
}
```

### **3. Permission Database Tables**

**Same Structure (Good!):**
- `auth.user_types`
- `auth.user_type_permissions`
- `auth.permission_metadata`
- `auth.user_customer_access`

**Adaptation:**
- Change foreign keys: `customers` table (not Spring Boot's customer table)
- Add WARP-specific permissions (voice vendors, trunks, etc.)

---

## What We Can Reuse Directly

### **1. Database Schema**
✅ 100% reusable - copy table structure

### **2. Permission Model**
✅ 100% reusable:
- Wildcard matching logic
- UserType → Permissions mapping
- Customer scoping pattern

### **3. Frontend Permission Checks**
✅ 90% reusable:
- `checkAccess()` function (change API endpoint)
- `hasAccess()` helper
- Conditional rendering pattern
- React hooks concept

### **4. Gatekeeper API**
✅ 100% reusable (just implement in Go):
- `POST /api/v1/gatekeeper/check-access`
- `GET /api/v1/gatekeeper/my-permissions`
- `POST /api/v1/gatekeeper/check-access-batch`

---

## What Needs Adaptation

### **1. Authentication Flow**

**ringer-soa** (Next.js with proxy):
```typescript
// Frontend calls proxy
fetch('/api/proxy/admin/customers')

// pages/api/proxy/[...path].ts handles:
async function handler(req, res) {
  const session = await getSession(req);
  const backendToken = await exchangeForJWT(session);

  const response = await fetch(`${BACKEND_URL}/${path}`, {
    headers: { Authorization: `Bearer ${backendToken}` }
  });

  res.json(await response.json());
}
```

**WARP** (React + Vite, no proxy):
```typescript
// Frontend calls backend directly
import { getAuth } from 'firebase/auth';

const auth = getAuth();
const user = auth.currentUser;
const idToken = await user.getIdToken(); // Firebase ID token

fetch('http://api.ringer.tel/v1/customers', {
  headers: { Authorization: `Bearer ${idToken}` }
});
```

### **2. Token Verification**

**ringer-soa** (Spring Boot):
```java
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    protected void doFilterInternal(request, response, chain) {
        String token = extractToken(request);
        Claims claims = jwtService.validateToken(token);
        // Set authentication
    }
}
```

**WARP** (Go):
```go
import "firebase.google.com/go/v4/auth"

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
    return func(c *gin.Context) {
        idToken := extractToken(c)
        token, err := m.firebaseAuth.VerifyIDToken(ctx, idToken)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid token"})
            c.Abort()
            return
        }

        user := m.userRepo.GetByFirebaseUID(ctx, token.UID)
        c.Set("user", user)
        c.Next()
    }
}
```

### **3. Data Filtering**

**ringer-soa** (Spring Boot + JPA):
```java
@Service
public class CustomerService {
    public List<Customer> getCustomers(User currentUser) {
        if (currentUser.hasWildcardPermission()) {
            return customerRepo.findAll();
        }

        List<String> accessibleIds = currentUser.getAccessibleCustomerIds();
        return customerRepo.findAllById(accessibleIds);
    }
}
```

**WARP** (Go + pgx):
```go
func (r *CustomerRepository) List(ctx context.Context, accessibleIDs []string) ([]Customer, error) {
    // If empty, user is superAdmin (no filtering)
    if len(accessibleIDs) == 0 {
        query := `SELECT * FROM accounts.customers ORDER BY created_at DESC`
        // ...
    } else {
        // Filter by accessible customer IDs
        query := `SELECT * FROM accounts.customers WHERE id = ANY($1)`
        // ... rows.Query(ctx, query, accessibleIDs)
    }
}
```

---

## Implementation Strategy

### **Option A: Pure Go Implementation (Recommended)**

**Pros:**
- Single language/codebase
- Consistent with what we've built
- Simpler deployment
- Better performance

**Cons:**
- Need to port Gatekeeper logic from Java to Go
- Firebase Admin SDK for Go (slightly different API)

### **Option B: Hybrid (Go + Node.js/TypeScript)**

**Pros:**
- Could reuse some TypeScript code
- Familiar for team coming from ringer-soa

**Cons:**
- Two backend services to maintain
- More complexity
- Deployment overhead

### **Option C: Migrate to Spring Boot**

**Pros:**
- Exact copy of ringer-soa pattern
- No adaptation needed

**Cons:**
- Throw away Go API Gateway we just built
- Slower than Go
- Doesn't match ARCHITECTURAL_DECISIONS.md

---

## Recommended Path Forward

### **Step 1: Clarify Stack** (10 minutes)

Answer these questions:
1. Keep Go API Gateway? (vs Java/Node.js)
2. Keep React + Vite? (vs Next.js)
3. Existing Firebase project or new?

### **Step 2: Implement Auth Schema** (1 hour)

- Run SQL to create auth tables
- Insert default user types
- Add permission metadata

### **Step 3: Firebase Setup** (1 hour)

- Configure Firebase project
- Enable Google OAuth
- Generate Admin SDK credentials
- Add to Secret Manager

### **Step 4: Go Backend Auth** (6 hours)

- Firebase Admin SDK integration
- Authentication middleware
- Gatekeeper middleware
- Gatekeeper API endpoints
- User CRUD APIs

### **Step 5: Frontend Integration** (6 hours)

- Firebase client SDK
- Login/logout UI
- API client with auto-token
- Permission hooks
- Protected routes

### **Step 6: Testing** (4 hours)

- Create test users
- Test permissions
- Test customer scoping
- End-to-end flows

**Total:** ~18-20 hours

---

## Critical Questions

**Please answer before we proceed:**

1. **Do you want to keep the Go API Gateway we built, or switch to Java/Spring Boot like ringer-soa?**

2. **The admin-portal is React + Vite (not Next.js). Is that acceptable, or should we use Next.js?**

3. **Do you have a Firebase project already, or should I create setup instructions for a new one?**

4. **Should we implement the full permission system (all user types), or start with just SuperAdmin?**

Once you clarify these, I'll create a detailed implementation plan and we can proceed systematically.
