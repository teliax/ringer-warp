# WARP Platform - Authentication & Permission System Implementation Plan

**Architecture Decisions:**
- ✅ Backend: Go API Gateway (existing)
- ✅ Frontend: React + Vite (existing)
- ✅ Auth: Firebase (existing project)
- ✅ Scope: Complete system, built to last

---

## 🎯 **Implementation Phases**

### **Phase 1: Database Schema & Foundation** (2-3 hours)

#### **1.1: Create Auth Schema**
```sql
-- File: infrastructure/database/schemas/04-auth-system.sql

CREATE SCHEMA IF NOT EXISTS auth;

-- User types (roles) table
-- Permission tables
-- Users table
-- User-customer access table
-- Permission metadata table
```

**Deliverables:**
- Complete SQL schema file
- Default user types (superAdmin, admin, customer_admin, developer, billing, viewer)
- Default permissions for each type
- Permission metadata for all WARP endpoints
- Sample test users

#### **1.2: Go Models for Auth**
```go
// services/api-gateway/internal/models/auth.go

type User struct {
    ID          uuid.UUID
    FirebaseUID string
    Email       string
    DisplayName string
    UserTypeID  uuid.UUID
    IsActive    bool
}

type UserType struct {
    ID          uuid.UUID
    TypeName    string
    Description string
}

type UserPermissions struct {
    UserID      uuid.UUID
    UserType    string
    Permissions []string
    CustomerAccess []CustomerAccess
}
```

**Deliverables:**
- Auth models
- Permission models
- User context models

---

### **Phase 2: Firebase Integration (Go Backend)** (4-5 hours)

#### **2.1: Firebase Admin SDK Setup**

**Prerequisites:**
- Firebase project credentials (JSON file)
- Store in Google Secret Manager
- Mount in Kubernetes pod

**Implementation:**
```go
// services/api-gateway/internal/auth/firebase.go

import (
    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/auth"
)

func InitializeFirebase(ctx context.Context, credentialsPath string) (*auth.Client, error) {
    app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(credentialsPath))
    if err != nil {
        return nil, fmt.Errorf("failed to initialize Firebase: %w", err)
    }

    client, err := app.Auth(ctx)
    if err != nil {
        return nil, fmt.Errorf("failed to create Auth client: %w", err)
    }

    return client, nil
}

func VerifyIDToken(ctx context.Context, client *auth.Client, idToken string) (*auth.Token, error) {
    token, err := client.VerifyIDToken(ctx, idToken)
    if err != nil {
        return nil, fmt.Errorf("invalid token: %w", err)
    }

    return token, nil
}
```

#### **2.2: Authentication Middleware**

```go
// services/api-gateway/internal/middleware/firebase_auth.go

type FirebaseAuthMiddleware struct {
    firebaseAuth *auth.Client
    userRepo     *repository.UserRepository
}

func (m *FirebaseAuthMiddleware) Authenticate() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. Extract Bearer token
        // 2. Verify with Firebase
        // 3. Lookup user by firebase_uid
        // 4. Set user context (user_id, user_type_id, etc.)
        // 5. Call c.Next()
    }
}
```

#### **2.3: User Repository**

```go
// services/api-gateway/internal/repository/user.go

type UserRepository struct {
    db *pgxpool.Pool
}

func (r *UserRepository) GetByFirebaseUID(ctx context.Context, firebaseUID string) (*models.User, error)
func (r *UserRepository) GetByID(ctx context.Context, userID uuid.UUID) (*models.User, error)
func (r *UserRepository) Create(ctx context.Context, req *models.CreateUserRequest) (*models.User, error)
func (r *UserRepository) GetUserCustomerAccess(ctx context.Context, userID uuid.UUID) ([]string, error)
```

**Deliverables:**
- Firebase Admin SDK initialized
- Token verification working
- User lookup by Firebase UID
- Customer access lookup

---

### **Phase 3: Gatekeeper Implementation (Go)** (6-8 hours)

#### **3.1: Permission Repository**

```go
// services/api-gateway/internal/gatekeeper/permission_repository.go

type PermissionRepository struct {
    db *pgxpool.Pool
}

// GetUserTypePermissions returns all resource paths a user type can access
func (r *PermissionRepository) GetUserTypePermissions(
    ctx context.Context,
    userTypeID uuid.UUID,
) ([]string, error) {
    query := `
        SELECT resource_path
        FROM auth.user_type_permissions
        WHERE user_type_id = $1
    `
    // Return []string of paths
}

// GetUserAccessibleCustomers returns customer IDs user can access
func (r *PermissionRepository) GetUserAccessibleCustomers(
    ctx context.Context,
    userID uuid.UUID,
) ([]uuid.UUID, error) {
    query := `
        SELECT customer_id
        FROM auth.user_customer_access
        WHERE user_id = $1
    `
    // Return []uuid.UUID
}

// CheckHasWildcardPermission checks if user type has '*' permission
func (r *PermissionRepository) CheckHasWildcardPermission(
    ctx context.Context,
    userTypeID uuid.UUID,
) (bool, error) {
    query := `
        SELECT EXISTS(
            SELECT 1 FROM auth.user_type_permissions
            WHERE user_type_id = $1 AND resource_path = '*'
        )
    `
    // Return bool
}
```

#### **3.2: Wildcard Matcher**

```go
// services/api-gateway/internal/gatekeeper/matcher.go

// MatchesPermission checks if a resource path matches a permission pattern
func MatchesPermission(permissionPattern, resourcePath string) bool {
    // Exact match
    if permissionPattern == resourcePath {
        return true
    }

    // Wildcard at end: /api/v1/customers/* matches /api/v1/customers/uuid
    if strings.HasSuffix(permissionPattern, "/*") {
        prefix := strings.TrimSuffix(permissionPattern, "*")
        return strings.HasPrefix(resourcePath, prefix)
    }

    // Wildcard middle: /api/*/customers matches /api/v1/customers
    // (Add if needed)

    return false
}
```

#### **3.3: Gatekeeper Service**

```go
// services/api-gateway/internal/gatekeeper/gatekeeper.go

type Gatekeeper struct {
    permRepo *PermissionRepository
}

type AccessCheckResult struct {
    Allowed             bool
    UserType            string
    AccessibleCustomers []uuid.UUID
    HasWildcard         bool
}

func (g *Gatekeeper) CheckAccess(
    ctx context.Context,
    userID uuid.UUID,
    userTypeID uuid.UUID,
    resourcePath string,
) (*AccessCheckResult, error) {
    // 1. Check for wildcard permission
    hasWildcard, err := g.permRepo.CheckHasWildcardPermission(ctx, userTypeID)
    if err != nil {
        return nil, err
    }

    if hasWildcard {
        // SuperAdmin - access everything, no customer filtering
        return &AccessCheckResult{
            Allowed:             true,
            HasWildcard:         true,
            AccessibleCustomers: nil, // nil = all customers
        }, nil
    }

    // 2. Get user type permissions
    permissions, err := g.permRepo.GetUserTypePermissions(ctx, userTypeID)
    if err != nil {
        return nil, err
    }

    // 3. Check if resource matches any permission
    allowed := false
    for _, perm := range permissions {
        if MatchesPermission(perm, resourcePath) {
            allowed = true
            break
        }
    }

    if !allowed {
        return &AccessCheckResult{Allowed: false}, nil
    }

    // 4. Get accessible customers for data filtering
    customerIDs, err := g.permRepo.GetUserAccessibleCustomers(ctx, userID)
    if err != nil {
        return nil, err
    }

    return &AccessCheckResult{
        Allowed:             true,
        AccessibleCustomers: customerIDs,
        HasWildcard:         false,
    }, nil
}
```

#### **3.4: Gatekeeper Middleware**

```go
// services/api-gateway/internal/middleware/gatekeeper.go

type GatekeeperMiddleware struct {
    gatekeeper *gatekeeper.Gatekeeper
}

func (m *GatekeeperMiddleware) CheckPermission() gin.HandlerFunc {
    return func(c *gin.Context) {
        userID := c.GetString("user_id")
        userTypeID := c.GetString("user_type_id")
        resourcePath := c.Request.URL.Path

        result, err := m.gatekeeper.CheckAccess(
            c.Request.Context(),
            uuid.MustParse(userID),
            uuid.MustParse(userTypeID),
            resourcePath,
        )

        if err != nil {
            c.JSON(500, gin.H{"error": "Permission check failed"})
            c.Abort()
            return
        }

        if !result.Allowed {
            c.JSON(403, gin.H{
                "error": "Insufficient permissions",
                "resource": resourcePath,
            })
            c.Abort()
            return
        }

        // Set customer filtering context
        c.Set("accessible_customer_ids", result.AccessibleCustomers)
        c.Set("has_wildcard", result.HasWildcard)

        c.Next()
    }
}
```

#### **3.5: Gatekeeper API Endpoints**

```go
// services/api-gateway/internal/handlers/gatekeeper.go

// POST /v1/gatekeeper/check-access
func (h *GatekeeperHandler) CheckAccess(c *gin.Context) {
    var req struct {
        ResourcePath string `json:"resourcePath"`
    }

    // Get user context
    // Check permission
    // Return {allowed: bool, userType: string, accessibleCustomerIds: []string}
}

// GET /v1/gatekeeper/my-permissions
func (h *GatekeeperHandler) GetMyPermissions(c *gin.Context) {
    // Get user permissions
    // Get customer access
    // Return full permission object
}

// POST /v1/gatekeeper/check-access-batch
func (h *GatekeeperHandler) CheckAccessBatch(c *gin.Context) {
    // Check multiple paths at once
    // Return map[string]bool
}
```

**Deliverables:**
- Complete Gatekeeper implementation in Go
- Wildcard matching logic
- Customer filtering support
- Gatekeeper API endpoints

---

### **Phase 4: Update Existing Endpoints** (3-4 hours)

#### **4.1: Add Customer Filtering to Repository Layer**

**Current:**
```go
func (r *CustomerRepository) List(ctx context.Context) ([]Customer, error) {
    query := `SELECT * FROM accounts.customers`
    // Returns ALL customers
}
```

**Updated:**
```go
func (r *CustomerRepository) List(
    ctx context.Context,
    accessibleCustomerIDs []uuid.UUID, // nil = all (superAdmin)
) ([]Customer, error) {
    if accessibleCustomerIDs == nil {
        // SuperAdmin - no filtering
        query := `SELECT * FROM accounts.customers ORDER BY created_at DESC`
    } else {
        // Filtered by accessible customers
        query := `
            SELECT * FROM accounts.customers
            WHERE id = ANY($1)
            ORDER BY created_at DESC
        `
        rows.Query(ctx, query, accessibleCustomerIDs)
    }
}
```

#### **4.2: Update All Handlers**

Pattern for every endpoint:
```go
func (h *CustomerHandler) ListCustomers(c *gin.Context) {
    // Extract customer filtering from context (set by Gatekeeper)
    hasWildcard := c.GetBool("has_wildcard")
    var customerIDs []uuid.UUID

    if !hasWildcard {
        customerIDs = c.GetStringSlice("accessible_customer_ids")
    }
    // If hasWildcard, customerIDs is nil → no filtering

    customers, err := h.customerRepo.List(c.Request.Context(), customerIDs)
    // ...
}
```

**Apply to:**
- Customer endpoints
- Trunk endpoints
- DID endpoints
- CDR/MDR queries
- Vendor endpoints (admin-only)

**Deliverables:**
- All endpoints respect customer scoping
- SuperAdmin sees all data
- Other users see only accessible customers

---

### **Phase 5: Frontend Authentication** (6-8 hours)

#### **5.1: Firebase Client Setup**

```typescript
// apps/admin-portal/src/lib/firebase/config.ts

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ... other config
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

#### **5.2: Authentication Context**

```typescript
// apps/admin-portal/src/contexts/AuthContext.tsx

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in
        // Optionally: Fetch user permissions from backend
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

#### **5.3: Protected Routes**

```typescript
// apps/admin-portal/src/components/ProtectedRoute.tsx

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return <>{children}</>;
}
```

#### **5.4: Login Page**

```typescript
// apps/admin-portal/src/pages/Login.tsx

export function Login() {
  const { signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>WARP Platform</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGoogleLogin} className="w-full">
            <GoogleIcon className="mr-2" />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Deliverables:**
- Firebase client configured
- Auth context provider
- Login/logout UI
- Protected routes
- Auto token refresh

---

### **Phase 6: Frontend API Client** (4-5 hours)

#### **6.1: API Client with Auto-Authentication**

```typescript
// apps/admin-portal/src/lib/api/client.ts

import { auth } from '@/lib/firebase/config';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';

class WarpApiClient {
  private async getAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    return await user.getIdToken();
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAuthToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Insufficient permissions');
      }
      if (response.status === 401) {
        // Token expired, try to refresh
        await auth.currentUser?.getIdToken(true);
        // Retry request once
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Customer API
  async getCustomers() {
    return this.request<any>('/customers');
  }

  async createCustomer(data: any) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // Gatekeeper API
  async checkAccess(resourcePath: string): Promise<boolean> {
    try {
      const result = await this.request<{allowed: boolean}>(
        '/gatekeeper/check-access',
        {
          method: 'POST',
          body: JSON.stringify({ resourcePath })
        }
      );
      return result.allowed;
    } catch {
      return false;
    }
  }

  async getMyPermissions() {
    return this.request<UserPermissions>('/gatekeeper/my-permissions');
  }
}

export const warpApi = new WarpApiClient();
```

#### **6.2: Permission Hook**

```typescript
// apps/admin-portal/src/hooks/usePermissions.ts

import { useQuery } from '@tanstack/react-query';
import { warpApi } from '@/lib/api/client';

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => warpApi.getMyPermissions(),
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });

  const hasAccess = (resourcePath: string): boolean => {
    if (!data) return false;

    // Wildcard permission
    if (data.permissions.includes('*')) return true;

    // Exact match
    if (data.permissions.includes(resourcePath)) return true;

    // Wildcard patterns
    return data.permissions.some(perm => {
      if (perm.endsWith('/*')) {
        const prefix = perm.slice(0, -1);
        return resourcePath.startsWith(prefix);
      }
      return false;
    });
  };

  return {
    permissions: data?.permissions || [],
    userType: data?.userType,
    customers: data?.customerAccess || [],
    hasAccess,
    isLoading,
  };
}
```

**Deliverables:**
- API client with Firebase token injection
- Auto token refresh on 401
- Permission hooks
- Error handling

---

### **Phase 7: User Management UI** (4-6 hours)

#### **7.1: User Management Page**

```typescript
// apps/admin-portal/src/pages/users/list.tsx

export function UserList() {
  const { data: users } = useUsers();

  return (
    <DataTable
      columns={[
        { header: 'Email', accessorKey: 'email' },
        { header: 'Name', accessorKey: 'display_name' },
        { header: 'User Type', accessorKey: 'user_type_name' },
        { header: 'Status', accessorKey: 'is_active' },
        { header: 'Last Login', accessorKey: 'last_login' },
      ]}
      data={users}
    />
  );
}
```

#### **7.2: User Type Management (Role Management)**

```typescript
// apps/admin-portal/src/pages/settings/roles.tsx

export function RoleManagement() {
  const { data: userTypes } = useUserTypes();
  const { data: availablePermissions } = useAvailablePermissions();

  return (
    <div>
      <UserTypeList types={userTypes} />
      <PermissionEditor
        permissions={availablePermissions}
        grouped byCategory
      />
    </div>
  );
}
```

**Deliverables:**
- User list page
- User creation/edit forms
- User type (role) management
- Permission assignment UI
- Customer access assignment

---

### **Phase 8: Data Filtering & Testing** (4-6 hours)

#### **8.1: Repository Pattern for Filtering**

Every repository method that returns customer-scoped data:

```go
// Pattern:
func (r *Repository) List(
    ctx context.Context,
    accessibleCustomerIDs []uuid.UUID, // nil = all
) ([]Entity, error) {
    // Build query with optional WHERE id = ANY($1) clause
}
```

#### **8.2: Testing Scenarios**

**Test User Types:**
1. SuperAdmin user → sees all customers
2. Admin user → sees assigned customers only
3. Customer Admin → sees only their customer
4. Developer → API access, no dashboard access
5. Viewer → read-only access

**Test Permission Changes:**
1. Add/remove permissions from user type
2. Verify UI updates
3. Verify API access changes

**Test Customer Scoping:**
1. Assign user to customer A
2. Verify they only see customer A data
3. Add customer B access
4. Verify they see both A and B

**Deliverables:**
- All endpoints filter by customer access
- Permission system verified
- Test users created
- Documentation of test scenarios

---

## 📦 **Dependencies to Add**

### **Go Backend**

```bash
go get firebase.google.com/go/v4
go get firebase.google.com/go/v4/auth
go get google.golang.org/api/option
```

### **Frontend**

```bash
npm install firebase
npm install @tanstack/react-query  # May already have
```

---

## 📁 **File Checklist**

### **Backend (Go)**

```
services/api-gateway/
├── internal/
│   ├── auth/
│   │   ├── firebase.go          ⬜ Initialize Firebase Admin
│   │   ├── user.go              ⬜ User context helpers
│   │   └── token.go             ⬜ Token utilities
│   ├── gatekeeper/
│   │   ├── gatekeeper.go        ⬜ Core permission checker
│   │   ├── matcher.go           ⬜ Wildcard matching
│   │   └── permission_repository.go ⬜ Permission queries
│   ├── middleware/
│   │   ├── firebase_auth.go     ⬜ Firebase authentication
│   │   └── gatekeeper.go        ⬜ Permission checking
│   ├── handlers/
│   │   ├── gatekeeper.go        ⬜ Gatekeeper API
│   │   ├── user.go              ⬜ User management API
│   │   └── role.go              ⬜ Role management API
│   ├── repository/
│   │   ├── user.go              ⬜ User CRUD
│   │   ├── permission.go        ⬜ Permission queries
│   │   └── (update all existing) ⬜ Add customer filtering
│   └── models/
│       ├── user.go              ⬜ User models
│       └── permission.go        ⬜ Permission models
```

### **Database**

```
infrastructure/database/schemas/
├── 04-auth-system.sql           ⬜ Auth tables
├── 05-default-permissions.sql   ⬜ Default user types & perms
└── 06-permission-metadata.sql   ⬜ Permission metadata
```

### **Frontend (React)**

```
apps/admin-portal/src/
├── lib/
│   ├── firebase/
│   │   └── config.ts            ⬜ Firebase client init
│   └── api/
│       ├── client.ts            ⬜ API client with auth
│       ├── customers.ts         ⬜ Customer API
│       ├── vendors.ts           ⬜ Vendor API
│       ├── gatekeeper.ts        ⬜ Gatekeeper API
│       └── users.ts             ⬜ User management API
├── contexts/
│   └── AuthContext.tsx          ⬜ Auth state management
├── hooks/
│   ├── useAuth.ts               ⬜ Auth hook
│   ├── usePermissions.ts        ⬜ Permission hook
│   └── useCustomers.ts          ⬜ Customer data hook
├── components/
│   ├── ProtectedRoute.tsx       ⬜ Route guard
│   └── PermissionGate.tsx       ⬜ Conditional render
└── pages/
    ├── Login.tsx                ⬜ Login page
    ├── users/                   ⬜ User management
    │   ├── list.tsx
    │   └── edit.tsx
    └── settings/
        └── roles.tsx            ⬜ Role management
```

---

## 🗓️ **Implementation Timeline**

### **Week 1: Backend Foundation**
- ✅ Day 1: Database schema + Firebase setup
- ✅ Day 2: Firebase middleware + User repository
- ✅ Day 3: Gatekeeper implementation
- ✅ Day 4: Update existing endpoints with filtering
- ✅ Day 5: Testing & refinement

### **Week 2: Frontend Integration**
- ✅ Day 1: Firebase client + Auth context
- ✅ Day 2: Login UI + Protected routes
- ✅ Day 3: API client with auto-auth
- ✅ Day 4: Permission hooks + conditional UI
- ✅ Day 5: User/role management UI

### **Week 3: Advanced Features**
- ✅ Day 1: Permission metadata UI
- ✅ Day 2: Customer assignment UI
- ✅ Day 3: Role creation/editing
- ✅ Day 4: Integration testing
- ✅ Day 5: Documentation & refinement

**Total: ~15-20 working days for complete system**

---

## 🎯 **Success Criteria**

### **Functional**
- ✅ Users can login with Google OAuth
- ✅ SuperAdmin sees all customers/data
- ✅ Admin users see only assigned customers
- ✅ Permissions are database-driven
- ✅ UI elements hidden based on permissions
- ✅ API enforces permissions (backend validation)

### **Security**
- ✅ Firebase tokens verified server-side
- ✅ No permission logic in frontend (UI only)
- ✅ All authorization in backend
- ✅ Customer data properly scoped

### **Usability**
- ✅ Simple login flow (Google OAuth)
- ✅ Permission management UI (for admins)
- ✅ Clear permission denied messages
- ✅ Audit trail of permission changes

---

## 🚀 **Ready to Begin?**

**Next Step:** Phase 1 - Database Schema

I'll create:
1. Complete auth schema SQL
2. Default user types and permissions
3. Permission metadata for all WARP resources
4. Test users for each role

**Shall I proceed with Phase 1?**
