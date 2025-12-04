# API Gateway Changelog

All notable changes to the WARP API Gateway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.2.4] - 2025-12-04

### Fixed
- **Critical Webhook Processing Bug**: Webhooks were being received but never processed
  - **Root Cause 1**: JSON field mapping mismatch - TCR sends `brandIdentityStatus` but struct expected `identityStatus`
    - Fixed in `internal/tcr/webhooks.go` - Updated WebhookEvent and BrandWebhookEvent structs
  - **Root Cause 2**: Context cancellation - Async goroutines used request context which was cancelled after HTTP response
    - Fixed in `internal/handlers/tcr_webhooks.go` - All webhook handlers now use `context.Background()` for async processing
  - **Impact**: Brand identity status updates (UNVERIFIED → VERIFIED) were not being synced from TCR

### Added
- **Webhook Reprocess Endpoint**: POST `/v1/admin/webhooks/reprocess`
  - Allows admin to reprocess all unprocessed webhook events
  - Extracts fields from stored payload including `brandIdentityStatus`
  - Returns count of successfully processed and errored events

---

## [v1.2.3] - 2025-12-01

### Added
- **Auth+ Webhook Processing (Sprint 2)**: Real-time Auth+ verification status updates via webhooks
  - Files modified:
    - `internal/tcr/webhook_processor.go` - Added processAuthPlusEvent handler for 9 Auth+ events
    - `internal/repository/tcr_webhooks.go` - Added GetUserEmailAndBrandName helper
    - `internal/email/service.go` - Added 3 Auth+ email notification methods
  - Files created:
    - `infrastructure/database/migrations/003_auth_plus_tracking.sql` - Auth+ tracking fields
    - `internal/email/templates/tcr/auth_plus_complete.html` - Verification complete email
    - `internal/email/templates/tcr/auth_plus_failed.html` - Verification failed email
    - `internal/email/templates/tcr/auth_plus_pin_expired.html` - PIN expiration email
  - Features:
    - Processes 9 Auth+ webhook events in real-time
    - Updates vetting_status (PENDING → ACTIVE/FAILED/EXPIRED)
    - Tracks verification progress (domain verified, 2FA verified, email sent/opened)
    - Sends email notifications on key milestones (complete, failed, PIN expired)
    - Stores timestamps for UI progress tracking
  - Webhook Events Handled:
    - BRAND_AUTHPLUS_VERIFICATION_ADD/COMPLETE/FAILED/EXPIRED
    - BRAND_AUTHPLUS_DOMAIN_VERIFIED/FAILED
    - BRAND_AUTHPLUS_2FA_VERIFIED/FAILED
    - BRAND_EMAIL_2FA_SEND/OPEN/EXPIRED

### Database Schema
- **New Columns** (brands_10dlc table):
  - auth_plus_domain_verified, auth_plus_2fa_verified
  - auth_plus_email_sent_at, auth_plus_email_opened_at
  - auth_plus_requested_at, auth_plus_completed_at, auth_plus_failed_at
- **New Tables**:
  - auth_plus_vetting_history - Timeline of all Auth+ attempts
  - auth_plus_appeals - Appeal tracking with evidence

### Technical Details
- **Status Flow**: PENDING → (DOMAIN_VERIFIED + 2FA_VERIFIED) → ACTIVE
- **Progress Tracking**: Granular timestamps for UI progress card (4-step timeline)
- **Email Templates**: Professional HTML emails with dashboard links
- **Error Handling**: Email failures logged but don't block webhook processing

---

## [v1.2.2] - 2025-12-01

### Added
- **Auth+ Campaign Validation (Sprint 1)**: Campaign creation blocking for PUBLIC_PROFIT brands without Auth+ verification
  - File modified:
    - `internal/handlers/tcr_campaigns.go` - Added Auth+ validation to CreateCampaign handler
  - Features:
    - Validates `identity_status` is VERIFIED or VETTED_VERIFIED for PUBLIC_PROFIT brands
    - Validates `vetting_status` is ACTIVE for PUBLIC_PROFIT brands
    - Returns `403 Forbidden` with clear error messages before TCR API calls
    - Prevents cryptic TCR errors by catching invalid requests early
  - Error codes:
    - `IDENTITY_NOT_VERIFIED`: Brand identity verification incomplete
    - `AUTHPLUS_REQUIRED`: Auth+ verification required for PUBLIC_PROFIT brands
  - Business Logic:
    - Non-PUBLIC_PROFIT brands: Only identity verification required
    - PUBLIC_PROFIT brands: Both identity + Auth+ verification required
    - Validation runs before campaign creation in database

### Technical Details
- **Validation Order**: TCR brand check → Identity status → Auth+ status → Campaign creation
- **Status Fields**: Uses existing `identity_status` and `vetting_status` fields from brands_10dlc table
- **Error Handling**: Returns HTTP 403 (Forbidden) instead of 400 (Bad Request) for authorization failures

---

## [v1.2.0] - 2025-12-01

### Added
- **Email Notifications for TCR Events**: Automated email notifications for brand and campaign status changes
  - Files created/modified:
    - `internal/email/service.go` - Centralized email service with SendGrid integration
    - `internal/email/templates/tcr/brand_status_changed.html` - Generic brand status change template
    - `internal/repository/tcr_webhooks.go` - User email lookup methods
    - `internal/tcr/webhook_processor.go` - Email notification integration
  - Features:
    - Email notifications for **ALL brand status changes** (REGISTERED, VERIFIED, UNVERIFIED, VETTED_VERIFIED, SUSPENDED)
    - Campaign approval/rejection emails per carrier (AT&T, T-Mobile, Verizon)
    - User lookup via `created_by` field - notifies the user who submitted the brand/campaign
    - Smart status messaging with context-aware next steps
    - Vetting information for UNVERIFIED brands
    - Notification tracking (`last_notification_sent_at`, `notification_status`)
    - Asynchronous email sending (non-blocking)
  - Integration:
    - Reuses existing SendGrid configuration from invitation system
    - Embedded HTML email templates with professional styling
    - Dashboard links for brand/campaign details
  - Configuration:
    - `SENDGRID_API_KEY` - Already configured, shared with invitation system
    - From: noreply@ringer.tel (WARP Platform)
    - Dashboard: https://admin.rns.ringer.tel

### Technical Details
- **User Tracking**: Both `brands_10dlc` and `campaigns_10dlc` tables have `created_by` column referencing `auth.users(id)`
- **Email Templates**: Base layout with content templates for flexible styling
- **Error Handling**: Email failures logged but don't block webhook processing
- **Database Queries**: Efficient joins to get user email + brand/campaign details in single query

---

## [v1.1.0] - 2025-11-30

### Added
- **TCR Webhook Integration**: Real-time status updates from The Campaign Registry
  - Files created:
    - `internal/tcr/webhooks.go` - Webhook types and client methods
    - `internal/tcr/webhook_processor.go` - Event processing business logic
    - `internal/tcr/webhook_subscription.go` - Subscription management
    - `internal/handlers/tcr_webhooks.go` - HTTP webhook endpoints
    - `internal/repository/tcr_webhooks.go` - Database operations
  - Endpoints:
    - `POST /webhooks/tcr/brands` - Receive brand status changes
    - `POST /webhooks/tcr/campaigns` - Receive campaign status changes
    - `POST /webhooks/tcr/vetting` - Receive vetting completion events
  - Features:
    - Automatic webhook subscription on server startup (BRAND, CAMPAIGN, VETTING categories)
    - Event audit log in `messaging.tcr_webhook_events` table
    - Asynchronous event processing (updates brand/campaign status in DB)
    - Sync tracking (last_synced_at, sync_source fields)
    - MNO status updates per carrier
  - Configuration:
    - `WEBHOOK_BASE_URL` env var (defaults to https://api.rns.ringer.tel)
    - Uses existing `TCR_API_KEY` and `TCR_API_SECRET` for subscription API

### Changed
- **Database Schema**: Added sync tracking columns and webhook events table (migration 002)
  - Tables modified: `brands_10dlc`, `campaigns_10dlc`
  - Table created: `tcr_webhook_events`
  - Indexes added: 8 performance indexes for webhook queries

### Infrastructure
- **HTTPS Enabled**: NGINX Ingress Controller with automated Let's Encrypt certificates
  - LoadBalancer IP: 136.112.92.30
  - Domains: api.rns.ringer.tel, grafana.ringer.tel, prometheus.ringer.tel
  - Certificates: Valid until 2026-03-01 (90-day auto-renewal)
  - See: `~/.claude/plans/snappy-petting-quill.md` for details

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.1.0`
- **Pods**: 3 replicas (api-gateway-*)
- **Webhook URLs**:
  - https://api.rns.ringer.tel/webhooks/tcr/brands
  - https://api.rns.ringer.tel/webhooks/tcr/campaigns
  - https://api.rns.ringer.tel/webhooks/tcr/vetting

---

## [v1.0.6] - 2025-11-30

### Fixed
- **Synchronous TCR Submission for Accurate UX**: Changed brand creation from async to synchronous with 10-second timeout
  - File: `internal/handlers/tcr_brands.go`
  - Issue: Users saw "success" message even when TCR submission failed silently in background
  - Solution: Wait for TCR response before returning to user
  - Impact:
    - Success: User sees "Brand successfully registered with TCR! Status: {status}, Trust Score: {score}"
    - Failure: User sees specific error "TCR registration failed: {error message}"
    - No more misleading success messages
    - Backend waits up to 10 seconds for TCR response

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.6`
- **Deployed**: 2025-11-30 23:57 UTC
- **Pods**: 3 replicas (api-gateway-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.5] - 2025-11-30

### Fixed
- **Correct TCR Brand Creation Endpoint**: Changed from `/brand` to `/brand/nonBlocking`
  - File: `internal/tcr/brands.go`
  - Issue: Using wrong endpoint resulted in HTTP 405 Method Not Allowed errors
  - Solution: TCR uses `/brand/nonBlocking` for async brand registration (per API docs)
  - Impact: Brand submissions now use correct TCR API endpoint

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.5`
- **Deployed**: 2025-11-30 23:49 UTC
- **Pods**: 3 replicas (api-gateway-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.4] - 2025-11-30

### Fixed
- **Context Cancellation in Async TCR Submissions**: Fixed goroutines using request context which gets cancelled immediately
  - Files: `internal/handlers/tcr_brands.go`, `internal/handlers/tcr_campaigns.go`
  - Issue: All async TCR API calls failed with "context canceled" error because goroutines used request context
  - Solution: Changed to `context.Background()` for all async goroutines (5 locations)
  - Impact: TCR brand/campaign submissions now complete successfully in background

### Configuration
- **TCR Sandbox Disabled**: Changed `TCR_SANDBOX="false"` to use production URL
  - Reason: Sandbox domain `csp-api.sandbox.campaignregistry.com` doesn't exist in DNS
  - Production URL `csp-api.campaignregistry.com` resolves correctly
  - Note: Using test credentials on production URL for development

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.4`
- **Deployed**: 2025-11-30 23:38 UTC
- **Pods**: 3 replicas (api-gateway-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.3] - 2025-11-30

### Fixed
- **Type Assertion Panic**: Fixed panic when getting user_id from context
  - File: `internal/handlers/tcr_brands.go`
  - Issue: Handler tried to assert `user_id` (string) as uuid.UUID, causing panic
  - Solution: Use `user_id_uuid` field instead which is already a uuid.UUID type
  - Impact: No more 500 errors when creating brands

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.3`
- **Deployed**: 2025-11-30 22:31 UTC
- **Pods**: 3 replicas (api-gateway-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.2] - 2025-11-30

### Fixed
- **TCR Brand Creation for SuperAdmin**: Fixed handler logic to read `X-Customer-ID` header when SuperAdmin creates brands
  - File: `internal/handlers/tcr_brands.go`
  - Issue: SuperAdmin users have `accessible_customer_ids = nil` (all customers), but handler was treating this as "no access" and returning 403
  - Solution: Check for `has_wildcard` flag and read customer context from `X-Customer-ID` header
  - Impact: SuperAdmin can now create TCR Brands for any customer selected via BAN picker

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.2`
- **Deployed**: 2025-11-30 22:10 UTC
- **Pods**: 3 replicas (api-gateway-6d8fb49956-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.1] - 2025-11-30

### Fixed
- **CORS Configuration**: Added `X-Customer-ID` to `Access-Control-Allow-Headers` to support multi-tenant customer scoping
  - File: `internal/middleware/cors.go`
  - Issue: Frontend was unable to send customer context header due to CORS preflight rejection
  - Impact: SuperAdmin users can now select specific customers via BAN picker when creating TCR Brands

### Deployment
- **Image**: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.1`
- **Deployed**: 2025-11-30 21:57 UTC
- **Pods**: 3 replicas (api-gateway-66cfcf9c7d-*)
- **Rollout**: Successful (zero downtime)

---

## [v1.0.0] - 2025-10-27

### Added
- **Authentication System**: Complete Google OAuth → JWT flow
  - `/auth/exchange` - Exchange Google ID for WARP JWT
  - `/auth/refresh` - Refresh expired access tokens
  - `/auth/validate` - Validate current token
- **Authorization System**: Endpoint-based Gatekeeper middleware
  - 48 permissions across 12 API categories
  - Wildcard matching support (`*`, `/path/*`, `/path`)
  - Multi-tenant customer scoping
- **User Management**: Complete user and user type CRUD
  - `/v1/admin/users` - User management
  - `/v1/admin/user-types` - User type management
  - `/v1/admin/user-types/:id/permissions` - Permission assignment
- **Customer Management**: Customer CRUD with scoping
  - `/v1/customers` - List/create customers
  - `/v1/customers/:id` - Get/update/delete customer
  - Customer-scoped data filtering
- **Gatekeeper API**: Permission checking endpoints
  - `/v1/gatekeeper/my-permissions` - Get current user's permissions
  - `/v1/gatekeeper/check-access` - Check permission for resource path
  - `/v1/gatekeeper/check-access-batch` - Batch permission checks
- **TCR 10DLC Integration**: Brand and campaign management
  - `/v1/messaging/brands` - Brand registration CRUD
  - `/v1/messaging/campaigns` - Campaign management CRUD
  - `/v1/messaging/use-cases` - TCR use case enumeration
  - `/v1/messaging/entity-types` - Entity type enumeration
  - `/v1/messaging/verticals` - Industry vertical enumeration

### Infrastructure
- **Database**: PostgreSQL Cloud SQL integration
- **Deployment**: GKE Autopilot (warp-api namespace)
- **Replicas**: 3 pods with HPA (min: 2, max: 10)
- **CORS**: Configured for localhost + production domains
- **Monitoring**: Prometheus metrics endpoint

### Security
- JWT tokens: 24h access, 7d refresh
- Domain restriction: Only @ringer.tel emails can auto-create accounts
- Database-driven permissions: Zero hardcoded roles in code
- Multi-tenant isolation: Customer data filtered server-side

---

## Version Tracking

### Current Production Versions

| Environment | Version | Deployed | Image Digest |
|-------------|---------|----------|--------------|
| Production  | v1.0.1  | 2025-11-30 21:57 UTC | sha256:05b086e1... |

### Rollback Procedure

```bash
# List available versions
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway \
  --include-tags

# Rollback to previous version
kubectl set image deployment/api-gateway \
  api-gateway=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.0 \
  -n warp-api

# Verify rollback
kubectl rollout status deployment/api-gateway -n warp-api
```

---

## Deployment Best Practices

### Before Deploying

1. ✅ Run tests: `make test`
2. ✅ Update CHANGELOG.md with version and changes
3. ✅ Tag image with semantic version (v1.x.x)
4. ✅ Push BOTH version tag AND `latest`
5. ✅ Test in staging/dev first (if available)
6. ✅ Verify health endpoints after deployment

### Version Increment Guidelines

**Patch (v1.0.x)**: Bug fixes, small updates, config changes
- Example: CORS header addition (v1.0.0 → v1.0.1)

**Minor (v1.x.0)**: New features, backwards compatible
- Example: Adding new API endpoints

**Major (vx.0.0)**: Breaking changes, API contract changes
- Example: Changing authentication method

---

## Related Documentation

- [CI/CD Pipeline Guide](../../docs/deployment/CI_CD_PIPELINE.md)
- [Deployment Guide](../../docs/deployment/DEPLOYMENT.md)
- [Auth Deployment Guide](./AUTH_DEPLOYMENT_GUIDE.md)
- [Deployment Verification](./DEPLOYMENT_VERIFICATION_V2.3.0.md)
