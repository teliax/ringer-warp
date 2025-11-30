# API Gateway Changelog

All notable changes to the WARP API Gateway will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
