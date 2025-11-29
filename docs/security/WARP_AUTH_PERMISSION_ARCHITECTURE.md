# WARP Platform - Authentication & Permission Architecture Plan

## Overview

This document outlines the authentication and permission system for WARP Platform, adapting the proven Gatekeeper pattern from ringer-soa (Spring Boot/Java) to our Go API Gateway + React/Vite admin portal.

---

## 🎯 **Design Goals**

1. **Zero Frontend Permission Logic** - All authorization in backend
2. **Database-Driven Permissions** - Dynamic, auditable, manageable
3. **Firebase Authentication** - Google OAuth + Email/Password
4. **Customer Scoping** - Users see only their assigned customers
5. **Gatekeeper Pattern** - Single authorization point
6. **Extensible User Types** - Easy to add new roles

---

## 🏗️ **Architecture Overview**

### **Stack Clarification**

**What We Have:**
- ✅ Frontend: React + Vite + shadcn/ui (`apps/admin-portal/`)
- ✅ Backend: Go API Gateway (Gin framework)
- ✅ Database: PostgreSQL Cloud SQL

**What PRD Originally Suggested:**
- Next.js 14+ (but admin-portal is Vite)
- Java/Spring Boot (but we chose Go in ARCHITECTURAL_DECISIONS.md)

**What We'll Build:**
- ✅ **Frontend:** React + Vite (what exists)
- ✅ **Backend:** Go API Gateway with Gatekeeper middleware
- ✅ **Auth:** Firebase Admin SDK (Go) for token verification
- ✅ **Pattern:** Adapt Spring Boot Gatekeeper to Go

---

## 📊 **Database Schema (PostgreSQL)**

### **1. User Management Tables**

```sql
CREATE SCHEMA IF NOT EXISTS auth;

-- User types (roles)
CREATE TABLE auth.user_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type_name VARCHAR(50) UNIQUE NOT NULL,  -- 'superAdmin', 'admin', 'customer_admin', 'viewer'
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- User type permissions (what each type can access)
CREATE TABLE auth.user_type_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id) ON DELETE CASCADE,
    resource_path VARCHAR(255) NOT NULL,  -- '/dashboard/customers', '/api/v1/admin/*'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100),

    UNIQUE(user_type_id, resource_path)
);

-- Permission metadata (friendly names, descriptions)
CREATE TABLE auth.permission_metadata (
    resource_path VARCHAR(255) PRIMARY KEY,
    category VARCHAR(100),  -- 'Customer Management', 'Voice Vendors', etc.
    display_name VARCHAR(255),
    description TEXT,
    display_order INTEGER DEFAULT 100,
    is_deprecated BOOLEAN DEFAULT FALSE,
    requires_wildcard BOOLEAN DEFAULT FALSE,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Users table
CREATE TABLE auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Firebase UID for authentication
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,

    -- User info
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url VARCHAR(500),

    -- User type (role)
    user_type_id UUID NOT NULL REFERENCES auth.user_types(id),

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- User-customer access (scoping)
CREATE TABLE auth.user_customer_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES accounts.customers(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'USER',  -- 'ADMIN', 'USER', 'VIEWER'
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by VARCHAR(100),

    UNIQUE(user_id, customer_id)
);

-- Indexes
CREATE INDEX idx_users_firebase_uid ON auth.users(firebase_uid);
CREATE INDEX idx_users_email ON auth.users(email);
CREATE INDEX idx_users_type ON auth.users(user_type_id);
CREATE INDEX idx_user_type_permissions_lookup ON auth.user_type_permissions(user_type_id, resource_path);
CREATE INDEX idx_user_customer_access_user ON auth.user_customer_access(user_id);
CREATE INDEX idx_user_customer_access_customer ON auth.user_customer_access(customer_id);
```

### **2. Default User Types**

```sql
-- Insert default user types
INSERT INTO auth.user_types (type_name, description, created_by) VALUES
    ('superAdmin', 'Full platform access - Ringer internal staff', 'system'),
    ('admin', 'Administrative access with customer filtering', 'system'),
    ('customer_admin', 'Customer account administrator', 'system'),
    ('developer', 'Technical/API access only', 'system'),
    ('billing', 'Billing and usage access only', 'system'),
    ('viewer', 'Read-only access', 'system');

-- SuperAdmin wildcard permission
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, '*', 'system' FROM auth.user_types WHERE type_name = 'superAdmin';

-- Admin permissions (most things except user management)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/*'),
    ('/api/v1/customers/*'),
    ('/api/v1/admin/voice-vendors'),
    ('/api/v1/admin/sms-vendors'),
    ('/api/v1/trunks/*'),
    ('/api/v1/messages/*')
) AS perms(resource)
WHERE type_name = 'admin';

-- Customer Admin permissions (their own customer only)
INSERT INTO auth.user_type_permissions (user_type_id, resource_path, created_by)
SELECT id, resource, 'system'
FROM auth.user_types, (VALUES
    ('/dashboard/overview'),
    ('/dashboard/trunks'),
    ('/dashboard/numbers'),
    ('/dashboard/messages'),
    ('/dashboard/cdrs'),
    ('/api/v1/messages/*'),
    ('/api/v1/trunks/*')
) AS perms(resource)
WHERE type_name = 'customer_admin';
```

---

## 🔐 **Authentication Flow (Firebase)**

### **Frontend → Firebase → Backend Flow**

```
1. User clicks "Sign in with Google" in React app
   └→ Firebase SDK authenticates user

2. Firebase returns ID token (JWT)
   └→ Frontend stores in localStorage/cookie

3. Frontend makes API request
   └→ Includes: Authorization: Bearer {firebase_id_token}

4. Go API Gateway receives request
   ├→ Extract Firebase ID token from header
   ├→ Verify token with Firebase Admin SDK
   ├→ Decode token → get firebase_uid
   ├→ Lookup user in auth.users by firebase_uid
   ├→ Get user's user_type_id
   └→ Pass to Gatekeeper middleware

5. Gatekeeper Middleware
   ├→ Get requested resource path
   ├→ Query user_type_permissions for user's type
   ├→ Check if path matches (exact or wildcard)
   ├→ If allowed: Continue → Apply customer filtering
   └→ If denied: Return 403 Forbidden

6. Endpoint Handler
   ├→ User context available (user_id, user_type, customer_ids)
   ├→ Filter data by accessible_customer_ids
   └→ Return filtered response
```

---

## 🛡️ **Go Implementation - Gatekeeper Middleware**

### **File Structure**

```
services/api-gateway/
├── internal/
│   ├── auth/
│   │   ├── firebase.go           # Firebase Admin SDK integration
│   │   ├── jwt.go                # JWT token handling
│   │   └── user.go               # User lookup/management
│   ├── gatekeeper/
│   │   ├── gatekeeper.go         # Main permission checker
│   │   ├── matcher.go            # Wildcard path matching
│   │   └── repository.go         # Permission queries
│   ├── middleware/
│   │   ├── auth.go               # Authentication middleware (Firebase)
│   │   └── gatekeeper.go         # Authorization middleware
│   └── handlers/
│       └── gatekeeper_handler.go # Gatekeeper API endpoints
```

### **Key Components**

#### **1. Firebase Authentication Middleware**

```go
// internal/middleware/auth.go
package middleware

import (
    "context"
    "strings"
    "github.com/gin-gonic/gin"
    firebase "firebase.google.com/go/v4"
    "firebase.google.com/go/v4/auth"
)

type AuthMiddleware struct {
    firebaseAuth *auth.Client
    userRepo     *repository.UserRepository
}

func NewAuthMiddleware(firebaseAuth *auth.Client, userRepo *repository.UserRepository) *AuthMiddleware {
    return &AuthMiddleware{
        firebaseAuth: firebaseAuth,
        userRepo:     userRepo,
    }
}

func (m *AuthMiddleware) Authenticate() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Extract Bearer token
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(401, gin.H{"error": "Authorization header required"})
            c.Abort()
            return
        }

        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" {
            c.JSON(401, gin.H{"error": "Invalid authorization format"})
            c.Abort()
            return
        }

        idToken := parts[1]

        // Verify Firebase ID token
        token, err := m.firebaseAuth.VerifyIDToken(c.Request.Context(), idToken)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid or expired token"})
            c.Abort()
            return
        }

        // Lookup user in database by Firebase UID
        user, err := m.userRepo.GetByFirebaseUID(c.Request.Context(), token.UID)
        if err != nil || user == nil {
            c.JSON(403, gin.H{"error": "User not found or inactive"})
            c.Abort()
            return
        }

        if !user.IsActive {
            c.JSON(403, gin.H{"error": "User account is inactive"})
            c.Abort()
            return
        }

        // Set user context for downstream handlers
        c.Set("user_id", user.ID)
        c.Set("user_email", user.Email)
        c.Set("user_type_id", user.UserTypeID)
        c.Set("firebase_uid", token.UID)

        c.Next()
    }
}
```

#### **2. Gatekeeper Authorization Middleware**

```go
// internal/middleware/gatekeeper.go
package middleware

import (
    "github.com/gin-gonic/gin"
    "github.com/ringer-warp/api-gateway/internal/gatekeeper"
)

type GatekeeperMiddleware struct {
    gatekeeper *gatekeeper.Gatekeeper
}

func NewGatekeeperMiddleware(gk *gatekeeper.Gatekeeper) *GatekeeperMiddleware {
    return &GatekeeperMiddleware{gatekeeper: gk}
}

func (m *GatekeeperMiddleware) CheckPermission() gin.HandlerFunc {
    return func(c *gin.Context) {
        userTypeID, exists := c.Get("user_type_id")
        if !exists {
            c.JSON(403, gin.H{"error": "User type not found"})
            c.Abort()
            return
        }

        // Get requested resource path
        resourcePath := c.Request.URL.Path

        // Check permission
        allowed, err := m.gatekeeper.CheckAccess(
            c.Request.Context(),
            userTypeID.(string),
            resourcePath,
        )

        if err != nil {
            c.JSON(500, gin.H{"error": "Permission check failed"})
            c.Abort()
            return
        }

        if !allowed {
            c.JSON(403, gin.H{
                "error": "Insufficient permissions",
                "resource": resourcePath,
            })
            c.Abort()
            return
        }

        // Get accessible customer IDs for data filtering
        customerIDs, err := m.gatekeeper.GetAccessibleCustomers(
            c.Request.Context(),
            c.GetString("user_id"),
        )
        if err == nil {
            c.Set("accessible_customer_ids", customerIDs)
        }

        c.Next()
    }
}
```

#### **3. Gatekeeper Core Logic**

```go
// internal/gatekeeper/gatekeeper.go
package gatekeeper

import (
    "context"
    "strings"
)

type Gatekeeper struct {
    permRepo *PermissionRepository
}

func NewGatekeeper(permRepo *PermissionRepository) *Gatekeeper {
    return &Gatekeeper{permRepo: permRepo}
}

// CheckAccess determines if a user type has access to a resource
func (g *Gatekeeper) CheckAccess(ctx context.Context, userTypeID, resourcePath string) (bool, error) {
    // Get all permissions for this user type
    permissions, err := g.permRepo.GetPermissions(ctx, userTypeID)
    if err != nil {
        return false, err
    }

    // Check for wildcard permission (superAdmin)
    for _, perm := range permissions {
        if perm == "*" {
            return true, nil // SuperAdmin has access to everything
        }
    }

    // Check for exact match
    for _, perm := range permissions {
        if perm == resourcePath {
            return true, nil
        }
    }

    // Check for wildcard matches
    for _, perm := range permissions {
        if matchesWildcard(perm, resourcePath) {
            return true, nil
        }
    }

    return false, nil
}

// matchesWildcard checks if a permission pattern matches a resource path
// Examples:
//   /api/v1/customers/* matches /api/v1/customers/123
//   /api/v1/customers/* matches /api/v1/customers/123/trunks
//   /dashboard/* matches /dashboard/customers
func matchesWildcard(pattern, path string) bool {
    if !strings.Contains(pattern, "*") {
        return false
    }

    prefix := strings.TrimSuffix(pattern, "*")
    return strings.HasPrefix(path, prefix)
}

// GetAccessibleCustomers returns customer IDs user can access
func (g *Gatekeeper) GetAccessibleCustomers(ctx context.Context, userID string) ([]string, error) {
    return g.permRepo.GetUserCustomerAccess(ctx, userID)
}
```

---

## 🔑 **Frontend Integration (React + Vite)**

### **Key Difference from Next.js Pattern:**

**Next.js (ringer-soa):**
- Uses `/api/proxy` route in Next.js API routes
- Proxy handles session tokens server-side
- Browser only sees proxy, not backend

**React + Vite (WARP):**
- No server-side proxy (Vite is client-only)
- Frontend calls backend API directly
- Firebase ID token sent directly in headers
- CORS must be configured on backend

### **Frontend API Client**

```typescript
// apps/admin-portal/src/lib/api/client.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/v1';

class WarpApiClient {
  private firebaseAuth = getAuth();

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Get current Firebase user and ID token
    const user = this.firebaseAuth.currentUser;
    if (!user) {
      throw new Error('Not authenticated');
    }

    // Get fresh ID token
    const idToken = await user.getIdToken();

    // Make request with Firebase ID token
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Insufficient permissions');
      }
      if (response.status === 401) {
        throw new Error('Authentication required');
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Gatekeeper API
  async checkAccess(resourcePath: string): Promise<boolean> {
    try {
      const response = await this.request<{allowed: boolean}>(
        '/gatekeeper/check-access',
        {
          method: 'POST',
          body: JSON.stringify({ resourcePath })
        }
      );
      return response.allowed;
    } catch {
      return false;
    }
  }

  async getMyPermissions() {
    return this.request<UserPermissions>('/gatekeeper/my-permissions');
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
}

export const warpApi = new WarpApiClient();
```

---

## 🎨 **Permission Checking in Components**

### **Example: Conditional Rendering**

```typescript
// apps/admin-portal/src/pages/dashboard.tsx
import { usePermissions } from '@/hooks/usePermissions';

export function Dashboard() {
  const { hasAccess, isLoading } = usePermissions();

  if (isLoading) return <Loading />;

  return (
    <div>
      {hasAccess('/dashboard/customers') && (
        <CustomerCard />
      )}

      {hasAccess('/dashboard/users') && (
        <UserManagementCard />
      )}

      {hasAccess('/api/v1/admin/voice-vendors') && (
        <VendorManagementCard />
      )}
    </div>
  );
}
```

### **React Hook for Permissions**

```typescript
// apps/admin-portal/src/hooks/usePermissions.ts
import { useQuery } from '@tanstack/react-query';
import { warpApi } from '@/lib/api/client';

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-permissions'],
    queryFn: () => warpApi.getMyPermissions(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const hasAccess = (resourcePath: string): boolean => {
    if (!data) return false;

    // Check for wildcard
    if (data.permissions.includes('*')) return true;

    // Check exact match
    if (data.permissions.includes(resourcePath)) return true;

    // Check wildcard patterns
    return data.permissions.some(perm =>
      perm.endsWith('*') && resourcePath.startsWith(perm.slice(0, -1))
    );
  };

  return {
    permissions: data?.permissions || [],
    userType: data?.userType,
    accessibleCustomers: data?.customerAccess || [],
    hasAccess,
    isLoading,
  };
}
```

---

## 📋 **Design Decisions Needed**

### **1. Backend Stack Question**

**Current State:**
- ✅ Go API Gateway built and deployed
- PRD mentions: "Go (primary), Rust, Java, TypeScript"
- ARCHITECTURAL_DECISIONS.md chose Go in October 2025

**Your Question:**
> "node.js typescript and java for our three tier architecture"

**Clarification Needed:**
- Continue with **Go API Gateway** (what we built)?
- OR build separate **Java/Spring Boot** backend (like ringer-soa)?
- OR add **Node.js/TypeScript** layer?

**My Recommendation:**
- ✅ Keep Go API Gateway (already built, working)
- ✅ Implement Gatekeeper pattern in Go (port from Java)
- ✅ Use Firebase Admin SDK for Go
- Reason: Consistency, performance, what's already deployed

### **2. Frontend Stack Question**

**Current State:**
- ✅ `apps/admin-portal/` is React + Vite + shadcn/ui
- PRD mentions: Next.js 14+

**Clarification Needed:**
- Continue with **React + Vite** (what exists)?
- OR migrate to **Next.js 14**?

**My Recommendation:**
- ✅ Keep React + Vite (components already built)
- Adapt authentication pattern (no server-side proxy like Next.js has)
- Reason: Polymet already generated UI, lots of components exist

### **3. Firebase Setup**

**What's Needed:**
1. Create Firebase project
2. Enable Google OAuth provider
3. Generate Firebase Admin SDK credentials
4. Store credentials in Google Secret Manager
5. Configure allowed domains

**Should I:**
- Create Firebase setup instructions?
- Use existing Firebase project if you have one?
- Set up test Firebase project for development?

### **4. Customer Scoping Strategy**

**From ringer-soa pattern:**
- SuperAdmin: See ALL customers
- Others: See only assigned customers via `user_customer_access`

**For WARP:**
- Ringer internal users: SuperAdmin (see all customers)
- Customer users: See only their own customer
- Should we support multi-customer access like ringer-soa?

---

## 📝 **Implementation Phases**

### **Phase 1: Database Schema (1 hour)**
- Create auth schema tables
- Insert default user types
- Add permission metadata

### **Phase 2: Go Authentication (4 hours)**
- Firebase Admin SDK integration
- Authentication middleware
- User repository (lookup by firebase_uid)

### **Phase 3: Go Gatekeeper (4 hours)**
- Permission repository
- Gatekeeper logic (wildcard matching)
- Gatekeeper middleware
- Gatekeeper API endpoints

### **Phase 4: Frontend Auth (4 hours)**
- Firebase client SDK setup
- Login/logout UI
- Token management
- Protected routes

### **Phase 5: Frontend Permissions (4 hours)**
- API client with auto-token
- Permission hooks
- Conditional rendering
- Gatekeeper API integration

### **Phase 6: Data Filtering (4 hours)**
- Customer scoping in endpoints
- Filter queries by accessible_customer_ids
- Test with multi-user scenarios

**Total Estimate: 20-24 hours**

---

## ❓ **Questions Before We Proceed**

1. **Backend:** Confirm Go API Gateway (vs adding Java/Node.js)?
2. **Frontend:** Confirm React + Vite (vs migrating to Next.js)?
3. **Firebase:** Do you have existing Firebase project or create new?
4. **Scope:** Start with SuperAdmin only, or implement all user types?
5. **Timeline:** Build incrementally or complete end-to-end first?

**Please clarify these design decisions before I begin implementation.**
