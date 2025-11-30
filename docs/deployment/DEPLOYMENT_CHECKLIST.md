# WARP Platform Deployment Checklist

**Date**: 2025-11-30
**Purpose**: Ensure consistent, safe, and auditable deployments across all WARP components

---

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing (`make test` or `npm test`)
- [ ] Code reviewed (if applicable)
- [ ] No linter errors or warnings
- [ ] Security scan passed (if applicable)

### Documentation
- [ ] CHANGELOG.md updated with version and changes
- [ ] API documentation updated (if API changes)
- [ ] README updated (if needed)

### Version Preparation
- [ ] Determine version number using semantic versioning:
  - Patch (v1.0.x): Bug fixes, config changes, hotfixes
  - Minor (v1.x.0): New features, backwards compatible
  - Major (vx.0.0): Breaking changes
- [ ] Verify last deployed version:
  ```bash
  gcloud artifacts docker images list \
    us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE \
    --include-tags
  ```

---

## Deployment Process

### Backend Services (Docker → GKE)

#### Step 1: Build and Tag Image

⚠️ **CRITICAL**: MUST tag with BOTH version AND latest

```bash
cd services/SERVICE_NAME

# Option A: Using Makefile (RECOMMENDED)
make docker-push VERSION=vX.Y.Z

# Option B: Manual Docker commands
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:vX.Y.Z \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:latest .

docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:vX.Y.Z
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:latest
```

**Checklist**:
- [ ] Image built successfully
- [ ] Both tags created (version + latest)
- [ ] Both tags pushed to Artifact Registry
- [ ] Verify in GCP Console: Artifact Registry → warp-platform → SERVICE

#### Step 2: Deploy to Kubernetes

```bash
# Deploy
kubectl apply -f deployments/kubernetes/

# Watch rollout
kubectl rollout status deployment/SERVICE -n NAMESPACE

# Verify pods
kubectl get pods -n NAMESPACE -l app=SERVICE
```

**Checklist**:
- [ ] Deployment applied successfully
- [ ] Rollout completed (zero downtime)
- [ ] All pods running and ready
- [ ] No error logs in new pods

#### Step 3: Verify Deployment

```bash
# Check pod logs
kubectl logs -n NAMESPACE -l app=SERVICE --tail=50

# Test health endpoint
curl https://api.rns.ringer.tel/health

# Check version (if endpoint exists)
curl https://api.rns.ringer.tel/version
```

**Checklist**:
- [ ] Health endpoint returns 200 OK
- [ ] No errors in pod logs
- [ ] Service responding to requests
- [ ] Metrics endpoint working (if applicable)

---

### Frontend Services (Vercel)

#### Automatic Deployment

```bash
# Commit and push to main
git add apps/PORTAL_NAME/
git commit -m "Description of changes (vX.Y.Z)"
git push origin main

# Vercel auto-deploys within 2-3 minutes
```

**Checklist**:
- [ ] Vercel deployment started (check GitHub commit status)
- [ ] Build succeeded
- [ ] Deployment preview available
- [ ] Production URL updated

#### Manual Deployment (if needed)

```bash
cd apps/PORTAL_NAME
vercel --prod
```

---

## Post-Deployment Checklist

### Verification
- [ ] Service accessible at production URL
- [ ] Authentication working
- [ ] Key features tested (smoke test)
- [ ] No increase in error rates (check Grafana)
- [ ] Response times normal (check Grafana)

### Documentation
- [ ] CHANGELOG.md updated with deployment details
- [ ] Git tag created: `git tag vX.Y.Z && git push --tags`
- [ ] Deployment documented in relevant docs
- [ ] Team notified (if significant change)

### Monitoring
- [ ] Set up alerts for new service (if first deployment)
- [ ] Monitor logs for 15-30 minutes post-deployment
- [ ] Check Prometheus metrics
- [ ] Verify Grafana dashboards show new version

---

## Rollback Procedure

If issues are detected post-deployment:

### Kubernetes Services

```bash
# Option 1: Rollback to previous version
kubectl rollout undo deployment/SERVICE -n NAMESPACE

# Option 2: Deploy specific version
kubectl set image deployment/SERVICE \
  SERVICE=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:vX.Y.Z \
  -n NAMESPACE

# Verify rollback
kubectl rollout status deployment/SERVICE -n NAMESPACE
```

**Rollback Checklist**:
- [ ] Rollback command executed
- [ ] Pods restarted with old version
- [ ] Service functional again
- [ ] Root cause analysis documented
- [ ] Fix planned for next deployment

---

## Version Tracking

### Current Production Versions (Example)

| Service | Version | Deployed | Image Digest | Notes |
|---------|---------|----------|--------------|-------|
| api-gateway | v1.0.1 | 2025-11-30 21:57 UTC | sha256:05b086e1... | CORS fix for X-Customer-ID |
| customer-portal | v2.3.0 | 2025-11-30 20:00 UTC | N/A (Vercel) | BAN picker improvements |

**Update this table in**:
- [API Gateway CHANGELOG.md](../../services/api-gateway/CHANGELOG.md)
- [Deployment Status Docs](./DEPLOYMENT.md)

---

## Quick Reference: Versioning Examples

### When to Increment Each Version Component

**Patch (v1.0.x → v1.0.y)**:
- Bug fixes
- Configuration changes (CORS headers, timeouts)
- Security patches
- Performance improvements (no API changes)
- Documentation updates

**Minor (v1.x.0 → v1.y.0)**:
- New API endpoints (backwards compatible)
- New features
- Database schema additions (non-breaking)
- New UI components/pages

**Major (vx.0.0 → vy.0.0)**:
- Breaking API changes
- Database schema breaking changes
- Authentication/authorization changes
- Major architectural changes

### Example Version History

```
v1.0.0 - Initial production release
v1.0.1 - CORS header fix for X-Customer-ID
v1.0.2 - Database connection pool optimization
v1.1.0 - Added TCR 10DLC campaign endpoints
v1.1.1 - Fixed campaign validation bug
v1.2.0 - Added billing integration
v2.0.0 - Migrated from JWT to OAuth2 (breaking)
```

---

## Related Documentation

- [CI/CD Pipeline](./CI_CD_PIPELINE.md) - Automated deployment pipelines
- [Deployment Guide](./DEPLOYMENT.md) - Complete deployment procedures
- [API Gateway CHANGELOG](../../services/api-gateway/CHANGELOG.md) - Version history

---

**Date**: 2025-11-30
