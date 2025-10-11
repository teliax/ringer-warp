# Ringer SOA Application Structure

## Frontend Pages (Next.js)

### Authentication Pages
- `/auth/signin` - Sign in page (Google OAuth + Email/Password)
- `/auth/signup` - Sign up page (currently not fully implemented)
- `/auth/forgot-password` - Password reset page
- `/accept-invitation` - Accept user invitation and set password

### Dashboard Pages
- `/dashboard` - Main dashboard with statistics and overview
- `/dashboard/customers` - Customer management (list, view, edit, delete)
- `/dashboard/customers/new` - Create new customer (admin only)
- `/dashboard/customers/[id]` - View/edit specific customer details
- `/dashboard/activity` - SOA event activity log
- `/dashboard/ports` - Port state management
- `/dashboard/ports/new` - Create new port request
- `/dashboard/tokens` - API token management
- `/dashboard/tokens/new` - Create new API token
- `/dashboard/lrn` - LRN management
- `/dashboard/lrn/new` - Create new LRN
- `/dashboard/users` - User management (admin only)
- `/dashboard/settings` - Application settings
- `/dashboard/settings/roles` - Role management (admin only)
- `/dashboard/analytics` - Analytics dashboard (not fully implemented)
- `/dashboard/billing` - Billing management (not fully implemented)
- `/dashboard/port-requests` - Port request management
- `/dashboard/bulk-porting` - Bulk port project management
- `/dashboard/bulk-porting/[projectId]` - View/manage bulk port project details

### API Proxy Routes
- `/api/proxy/*` - Proxies authenticated requests to backend
- `/api/auth/*` - NextAuth.js authentication endpoints

## Backend API Endpoints (Spring Boot)

### Authentication Endpoints (`/api/v1/auth`)
- `POST /api/v1/auth/exchange` - Exchange Google OAuth credentials for API tokens
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh expired access token
- `POST /api/v1/auth/revoke` - Revoke current access token
- `POST /api/v1/auth/revoke-all` - Revoke all tokens for user
- `GET /api/v1/auth/validate` - Validate current token

### Customer API Endpoints (`/api/v1/customers`) - Auto-filtered by user access
- `GET /api/v1/customers` - Get accessible customers
- `GET /api/v1/customers/{customerId}` - Get specific customer
- `GET /api/v1/customers/{customerId}/events` - Get customer's SOA events
- `GET /api/v1/customers/{customerId}/port-states` - Get customer's port states
- `GET /api/v1/customers/{customerId}/tokens` - Get customer's API tokens
- `GET /api/v1/customers/{customerId}/spids` - Get customer's SPIDs
- `POST /api/v1/customers/{customerId}/port-requests` - Create port request

### Admin API Endpoints (`/api/v1/admin`) - Admin only
- `GET /api/v1/admin/statistics` - Get system statistics
- `GET /api/v1/admin/customers` - Get all customers
- `GET /api/v1/admin/customers/{id}` - Get customer by ID
- `POST /api/v1/admin/customers` - Create new customer
- `PUT /api/v1/admin/customers/{id}` - Update customer
- `DELETE /api/v1/admin/customers/{id}` - Delete customer
- `GET /api/v1/admin/customers/{id}/events` - Get customer events
- `GET /api/v1/admin/customers/{id}/transactions` - Get customer transactions
- `GET /api/v1/admin/customers/{id}/conflicts` - Get customer conflicts
- `GET /api/v1/admin/customers/{id}/verify` - Verify customer transactions

### Token Management (`/api/v1/admin/tokens`)
- `GET /api/v1/admin/tokens` - List all tokens
- `GET /api/v1/admin/tokens/{id}` - Get token by ID
- `POST /api/v1/admin/tokens` - Create new token
- `PUT /api/v1/admin/tokens/{id}` - Update token
- `DELETE /api/v1/admin/tokens/{id}` - Delete token
- `POST /api/v1/admin/tokens/{id}/regenerate` - Regenerate token
- `POST /api/v1/admin/tokens/{id}/revoke` - Revoke token

### Event Management (`/api/v1/admin/events`)
- `GET /api/v1/admin/events` - Get all events (with pagination)
- `POST /api/v1/admin/events/{recno}/acknowledge` - Acknowledge event
- `POST /api/v1/admin/events/poll` - Trigger event polling
- `POST /api/v1/admin/events/parse-action` - Parse action message with AI

### Port Management (`/api/v1/admin`)
- `GET /api/v1/admin/port-states` - Get all port states
- `POST /api/v1/admin/port/create` - Create port request
- `POST /api/v1/admin/port/activate` - Activate port
- `POST /api/v1/admin/port/cancel` - Cancel port request
- `POST /api/v1/admin/port/disconnect` - Disconnect port

### LRN Management (`/api/v1/admin/lrn`)
- `GET /api/v1/admin/lrn` - List all LRNs
- `POST /api/v1/admin/lrn/create` - Create new LRN
- `DELETE /api/v1/admin/lrn/{lrn}` - Delete LRN

### User Management (`/api/v1/admin/users`)
- `GET /api/v1/admin/users` - List all users
- `GET /api/v1/admin/users/{id}` - Get user by ID
- `POST /api/v1/admin/users` - Create new user
- `PUT /api/v1/admin/users/{id}` - Update user
- `DELETE /api/v1/admin/users/{id}` - Delete user
- `POST /api/v1/admin/users/invite` - Send invitation
- `POST /api/v1/admin/users/{id}/reset-password` - Reset user password
- `PUT /api/v1/admin/users/{id}/customer-access` - Update customer access

### Public Endpoints (`/api/v1/public`)
- `POST /api/v1/public/invitations/accept` - Accept invitation and set password
- `GET /api/v1/public/invitations/validate` - Validate invitation token

### SOA Operations (`/api/v1/soa`)
- `POST /api/v1/soa/create` - Create SOA request
- `POST /api/v1/soa/activate` - Activate number
- `POST /api/v1/soa/disconnect` - Disconnect number
- `POST /api/v1/soa/release` - Release number
- `POST /api/v1/soa/cancel` - Cancel request
- `POST /api/v1/soa/query` - Query number status
- `POST /api/v1/soa/dddinupdate` - Update due date
- `POST /api/v1/soa/intrasp` - Intra-SP port
- `POST /api/v1/soa/lrncreate` - Create LRN
- `POST /api/v1/soa/lrnremove` - Remove LRN
- `POST /api/v1/soa/npanxxcreate` - Create NPANXX
- `POST /api/v1/soa/conflictcreate` - Create conflict
- `POST /api/v1/soa/conflictremove` - Remove conflict

### Telique/LERG Data APIs (`/api/v1/telique`, `/api/v1/lerg`)
- `GET /api/v1/telique/lrn/{phoneNumber}` - Lookup LRN and SPID for phone number
- `GET /api/v1/telique/lsms/list/lrn` - Query LRNs from LSMS database by SPID
- `GET /api/v1/lerg/lerg1` - Lookup OCN name
- `GET /api/v1/lerg/lerg6` - Lookup NPA-NXX data (LATA, OCN, state)
- `GET /api/v1/lerg/lerg7` - Lookup OCN from switch CLLI
- `GET /api/v1/lerg/lerg7sha` - Lookup tandem switch data
- `GET /api/v1/lerg/lerg12` - Lookup available LRNs for LATA and OCN

### Bulk Port Management (`/api/v1/bulk-port`)
- `GET /api/v1/bulk-port/projects` - List bulk port projects
- `POST /api/v1/bulk-port/projects` - Create new bulk port project
- `GET /api/v1/bulk-port/projects/{projectId}` - Get project details
- `POST /api/v1/bulk-port/projects/{projectId}/upload` - Upload CSV file for processing
- `GET /api/v1/bulk-port/projects/{projectId}/progress` - Get real-time progress (polling endpoint)
- `GET /api/v1/bulk-port/projects/{projectId}/download` - Download processed results
- `DELETE /api/v1/bulk-port/projects/{projectId}` - Delete project

### Bulk Port Job Monitoring (`/api/v1/bulk-port/jobs`)
- `GET /api/v1/bulk-port/jobs/stats` - Get overall job statistics (admin/manager only)
- `GET /api/v1/bulk-port/jobs/project/{projectId}/status` - Get job status for specific project
- `GET /api/v1/bulk-port/jobs/failed` - List failed jobs (admin/manager only)
- `POST /api/v1/bulk-port/jobs/retry/{jobId}` - Retry a specific failed job (admin/manager only)
- `POST /api/v1/bulk-port/jobs/retry/project/{projectId}` - Retry all failed TNs for a project
- `DELETE /api/v1/bulk-port/jobs/{jobId}` - Cancel/delete a job (admin only)
- `GET /api/v1/bulk-port/jobs/state/{state}` - Get jobs in specific state (admin only)

### Role Management API (`/api/v1/admin/roles`)
- `GET /api/v1/admin/roles/user-types` - List all user types
- `GET /api/v1/admin/roles/user-types/{id}` - Get user type details
- `POST /api/v1/admin/roles/user-types` - Create new user type
- `PUT /api/v1/admin/roles/user-types/{id}` - Update user type
- `DELETE /api/v1/admin/roles/user-types/{id}` - Delete user type
- `GET /api/v1/admin/roles/user-types/{id}/permissions` - Get permissions for user type
- `PUT /api/v1/admin/roles/user-types/{id}/permissions` - Update user type permissions
- `GET /api/v1/admin/roles/user-types/{id}/users` - List users with this user type
- `GET /api/v1/admin/roles/available-resources` - Get all available permissions (grouped)
- `GET /api/v1/admin/roles/available-resources-with-metadata` - Get permissions with display names and descriptions

### System/Health (`/api/v1`)
- `GET /api/v1/health` - Health check
- `GET /api/v1/api-info` - API information

## Authentication & Authorization

### Simple Authentication Model
- All endpoints require authentication (`@PreAuthorize("isAuthenticated()")`)  
- No complex role checking at the Spring Security level
- Authorization is handled by the Gatekeeper service for fine-grained permissions

### Dynamic Permission System (v1.17.x)
- User permissions are managed through the `GatekeeperController`
- Each user has a UserType that defines their accessible resources
- Permission metadata provides friendly names and descriptions for UI
- Customer scoping is handled at the service level
- Database migrations: V33-V41 (user management), V61 (permission metadata)
- See `PERMISSION_SYSTEM.md` for detailed permission model

## Authentication Flow

### Google OAuth Flow
1. User clicks "Continue with Google" on `/auth/signin`
2. Google authenticates user
3. Backend verifies Google ID and checks if user exists
4. If user exists and is active, generates JWT tokens
5. Returns access token and refresh token

### Email/Password Flow
1. User enters email/password on `/auth/signin`
2. Backend authenticates against stored password hash
3. If valid and user is active, generates JWT tokens
4. Returns access token and refresh token

### Invitation Flow
1. Admin sends invitation via `/api/v1/admin/users/invite`
2. User receives email with invitation link
3. User clicks link to `/accept-invitation?token={token}`
4. User sets password
5. Backend creates/activates user account
6. User can then login with email/password

## Data Flow

### Authenticated Users
- All users must be authenticated to access endpoints
- Gatekeeper service determines accessible resources based on UserType
- Users with wildcard permission (`*`) can access all data
- Other users have data automatically filtered by customer associations
- Events filtered by customer's SPIDs
- Port states filtered by customer ID

## Security Features

1. **JWT Token Authentication**
   - Access tokens (15 min expiry)
   - Refresh tokens (7 day expiry)
   - Token rotation on refresh

2. **Permission-Based Access Control**
   - Dynamic permissions through Gatekeeper
   - User Type based resource access
   - Automatic customer data filtering

3. **API Token Management**
   - Hashed token storage
   - Token prefix for identification
   - IP whitelisting support
   - Operation restrictions

4. **Session Management**
   - NextAuth.js session handling
   - Automatic token refresh
   - Secure cookie storage

5. **CORS Configuration**
   - Configurable allowed origins
   - Credentials support