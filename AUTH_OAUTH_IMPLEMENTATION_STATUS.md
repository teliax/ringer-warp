# Google OAuth + Custom JWT Implementation - Status

**Date:** October 11, 2025
**Pattern:** Google OAuth 2.0 + Custom JWT (like ringer-soa)
**Status:** Backend Auth Foundation Complete

---

## ✅ **Completed**

### **1. Database Schema**
- ✅ Created `auth.users` table with `google_id` column (not firebase_uid)
- ✅ Created `auth.user_types`, `auth.user_type_permissions`
- ✅ Created `auth.permission_metadata`, `auth.user_customer_access`
- ✅ 6 default user types with 48 permissions

### **2. Google OAuth Verification**
- ✅ Created `internal/auth/google_oauth.go`
- ✅ Verifies Google ID tokens via `oauth2.googleapis.com/tokeninfo`
- ✅ Validates audience, issuer, expiration
- ✅ Returns Google user info (sub, email, name, picture)

### **3. Custom JWT Service**
- ✅ Created `internal/auth/jwt.go`
- ✅ Generates OUR OWN access tokens (24h expiry)
- ✅ Generates OUR OWN refresh tokens (7 days)
- ✅ Validates tokens
- ✅ Custom claims: user_id, email, user_type_id, user_type

### **4. User Repository**
- ✅ Created `internal/repository/user.go`
- ✅ `GetByGoogleID()` - Lookup by Google OAuth ID
- ✅ `Create()` - Create new user
- ✅ `UpdateLastLogin()` - Track login activity
- ✅ `GetUserCustomerAccess()` - Get customer scoping

### **5. Auth Endpoints**
- ✅ Created `internal/handlers/auth.go`
- ✅ `POST /auth/exchange` - Exchange Google token for WARP JWT
- ✅ `POST /auth/refresh` - Refresh access token
- ✅ `GET /auth/validate` - Validate current token

### **6. JWT Authentication Middleware**
- ✅ Created `internal/middleware/jwt_auth.go`
- ✅ Validates OUR JWT tokens (not Google's)
- ✅ Sets user context (user_id, user_type_id, email)
- ✅ Optional auth variant for public endpoints

---

## 📋 **What Remains (Next Session)**

### **Backend (4-6 hours):**

1. **Gatekeeper Implementation**
   - [ ] `internal/gatekeeper/permission_repository.go`
   - [ ] `internal/gatekeeper/matcher.go` (wildcard matching)
   - [ ] `internal/gatekeeper/gatekeeper.go` (core logic)
   - [ ] `internal/middleware/gatekeeper.go` (enforcement)

2. **Gatekeeper API Endpoints**
   - [ ] `POST /v1/gatekeeper/check-access`
   - [ ] `GET /v1/gatekeeper/my-permissions`
   - [ ] `POST /v1/gatekeeper/check-access-batch`

3. **Wire Up in main.go**
   - [ ] Initialize OAuth verifier
   - [ ] Initialize JWT service
   - [ ] Add auth routes
   - [ ] Update middleware chain

4. **Update Existing Endpoints**
   - [ ] Add customer filtering to all repository methods
   - [ ] Extract `accessible_customer_ids` from context
   - [ ] Filter queries by customer access

### **Frontend (6-8 hours):**

1. **Google OAuth Client**
   - [ ] Install `@react-oauth/google`
   - [ ] Configure GoogleOAuthProvider
   - [ ] Create Login component

2. **Auth Context**
   - [ ] Store access/refresh tokens
   - [ ] Auto-refresh on 401
   - [ ] Logout functionality

3. **API Client**
   - [ ] Inject OUR JWT tokens (not Google's)
   - [ ] Handle token refresh
   - [ ] Permission checking hooks

---

## 🔑 **Authentication Flow (As Implemented)**

```
1. User clicks "Sign in with Google" in React app
   ↓
2. @react-oauth/google handles OAuth flow
   ↓
3. Google returns ID token
   ↓
4. Frontend → POST /auth/exchange {id_token: "google_token"}
   ↓
5. Go Backend:
   a) Verify Google token with Google's tokeninfo endpoint
   b) Extract google_id (sub) and email
   c) Lookup user in auth.users by google_id
   d) If not found → Error ("User must be pre-created by admin")
   e) If found → Generate OUR JWT access + refresh tokens
   f) Return {access_token, refresh_token}
   ↓
6. Frontend stores OUR tokens in localStorage
   ↓
7. All API calls use: Authorization: Bearer {our_access_token}
   ↓
8. JWT middleware validates OUR tokens
   ↓
9. Gatekeeper checks permissions
   ↓
10. Data filtered by customer access
```

---

## 🔒 **Security Model**

**Authentication (Who you are):**
- Google OAuth handles identity verification
- We trust Google's tokeninfo endpoint
- User must exist in OUR database

**Authorization (What you can do):**
- OUR JWT tokens contain user_type
- Gatekeeper middleware checks permissions
- Database-driven permission rules
- Customer scoping for data isolation

**Token Lifecycle:**
- Access token: 24 hours (can be refreshed)
- Refresh token: 7 days (re-login after expiry)
- Tokens stored client-side (localStorage)
- Server is stateless (no session storage)

---

## 📦 **Go Dependencies**

```go
// Already in go.mod:
github.com/golang-jwt/jwt/v5  ✅
github.com/google/uuid        ✅

// No Firebase dependencies needed! ✅
```

---

## 🎯 **Required Configuration**

### **Backend (Go API Gateway):**

```yaml
# config.yaml
auth:
  google_client_id: "your-client-id.apps.googleusercontent.com"
  jwt_secret: "your-secret-key"  # Generate with: openssl rand -base64 32
  access_token_hours: 24
  refresh_token_hours: 168  # 7 days
```

### **Frontend (React + Vite):**

```bash
# .env.local
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:8080/v1
```

---

## 📝 **Files Created/Modified**

### **Database:**
```
05-update-auth-google-oauth.sql  ✅ Executed (firebase_uid → google_id)
```

### **Backend (Go):**
```
internal/auth/
  ├── google_oauth.go     ✅ Google token verification
  └── jwt.go              ✅ Custom JWT generation/validation

internal/models/
  ├── user.go             ✅ Updated (google_id field)
  └── auth.go             ✅ Auth request/response models

internal/repository/
  └── user.go             ✅ Updated (GetByGoogleID, Create)

internal/handlers/
  └── auth.go             ✅ /auth/exchange, /auth/refresh, /auth/validate

internal/middleware/
  └── jwt_auth.go         ✅ JWT validation middleware
```

---

## 🚀 **Next Session Tasks**

**Priority 1: Complete Gatekeeper** (4 hours)
- Implement permission repository
- Implement wildcard matcher
- Implement gatekeeper core logic
- Implement gatekeeper middleware
- Add gatekeeper API endpoints

**Priority 2: Integration** (2 hours)
- Wire up auth in main.go
- Add auth routes to router
- Test with Postman
- Update deployment with secrets

**Priority 3: Frontend** (6 hours)
- Set up @react-oauth/google
- Create login page
- Implement auth context
- Build API client with JWT
- Test end-to-end

---

## ✅ **What's Ready**

**Backend Authentication:** 90% complete
- ✅ Google OAuth verification
- ✅ Custom JWT generation
- ✅ Auth endpoints
- ✅ JWT middleware
- ⏳ Need: Gatekeeper for authorization

**Database:** 100% ready
- ✅ All auth tables created
- ✅ Default permissions configured
- ✅ Ready for test users

**Documentation:** Updated
- ✅ No Firebase references
- ✅ Google OAuth pattern documented
- ✅ Same as ringer-soa approach

---

**Status:** Ready to implement Gatekeeper in next session. Backend auth foundation is solid.
