# WARP Platform CI/CD Pipeline

**Date**: 2025-11-30
**Status**: Production
**Version**: 1.0.0

---

## Overview

WARP Platform uses a hybrid CI/CD approach with automatic deployments for frontend and manual/scripted deployments for backend services.

---

## Deployment Pipelines

### Frontend: Customer Portal (Vercel - Automatic)

#### Integration: GitHub → Vercel

**Repository**: `ringer-warp` (apps/customer-portal)
**Platform**: Vercel
**Trigger**: Automatic on git push

#### How It Works

```
1. Developer pushes code to GitHub
   ↓
2. Vercel webhook detects push
   ↓
3. Vercel clones repository
   ↓
4. Vercel runs: npm install && npm run build
   ↓
5. Vercel deploys dist/ folder
   ↓
6. New version live at https://customer.rns.ringer.tel
```

#### Branch Deployment Strategy

| Branch | Deployment | URL | Auto-Deploy |
|--------|------------|-----|-------------|
| `main` | Production | https://customer.rns.ringer.tel | ✅ Automatic |
| `dev` | Staging | https://dev-customer.rns.ringer.tel | ✅ Automatic |
| Feature branches | Preview | https://preview-*.vercel.app | ✅ Automatic |
| Pull Requests | Preview | https://pr-*.vercel.app | ✅ Automatic |

#### Configuration

**File**: `apps/customer-portal/vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_URL": "https://api.rns.ringer.tel",
    "VITE_GOOGLE_CLIENT_ID": "791559065..."
  },
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### Environment Variables

Set in **Vercel Dashboard** → Project Settings → Environment Variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `VITE_API_URL` | https://api.rns.ringer.tel | Production |
| `VITE_API_URL` | https://dev-api.rns.ringer.tel | Preview |
| `VITE_GOOGLE_CLIENT_ID` | 791559065272-... | All |

#### Deployment Notifications

Vercel sends notifications to:
- GitHub (commit status checks)
- Slack (if configured)
- Email (deployment summary)

---

### Backend: API Gateway (GKE - Manual/Script)

#### Integration: Docker → GCR → GKE

**Repository**: `ringer-warp/services/api-gateway`
**Platform**: Google Kubernetes Engine
**Registry**: Google Artifact Registry
**Trigger**: Manual or CI script

#### Deployment Flow

```
1. Developer commits code to main branch
   ↓
2. Run: make docker-push
   ↓
3. Docker builds Go binary
   ↓
4. Image pushed to us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway
   ↓
5. Run: kubectl apply -f deployments/kubernetes/
   ↓
6. GKE pulls new image and deploys
   ↓
7. Rolling update (zero downtime)
```

#### Commands

```bash
# Full deployment
cd services/api-gateway
make docker-push VERSION=v1.0.0
kubectl apply -f deployments/kubernetes/

# Verify
kubectl get pods -n warp-api
kubectl logs -n warp-api -l app=api-gateway --tail=50

# Rollback if needed
kubectl rollout undo deployment/api-gateway -n warp-api
```

#### Image Versioning & Tagging Strategy

**Semantic Versioning** (Recommended):
- `v1.0.0` - Major.Minor.Patch
- `v1.1.0` - Feature releases
- `v1.0.1` - Patch/hotfix releases
- `latest` - Always points to newest production build

**Additional Tags**:
- `v1.0.0-rc1` - Release candidates
- `v1.0.0-beta` - Beta releases
- `sha-abc1234` - Git commit SHA (future enhancement)

**Example Deployment**:
```bash
# Deploy specific version to production
make docker-push VERSION=v1.2.0

# Deploy to staging with RC tag
make docker-push VERSION=v1.2.0-rc1

# Update latest tag
docker tag api-gateway:v1.2.0 api-gateway:latest
docker push api-gateway:latest
```

**Tag Management**:
```bash
# List all image tags
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway

# Pull specific version for rollback
docker pull us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.1.0

# Retag and redeploy
kubectl set image deployment/api-gateway \
  api-gateway=us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.1.0 \
  -n warp-api
```

---

## Independent Deployment Capabilities

### Frontend and Backend Deploy Separately

**Key Point**: Frontend and backend are **completely independent** and can be deployed separately without affecting each other.

#### Deploy Frontend Only

```bash
# Option 1: Push to GitHub (Automatic)
git add apps/customer-portal/
git commit -m "Update customer portal UI"
git push origin main
# Vercel auto-deploys within 2-3 minutes

# Option 2: Manual Deploy
cd apps/customer-portal
vercel --prod
```

**Use Cases**:
- UI/UX updates
- Frontend bug fixes
- New pages or components
- Styling changes

**Impact**: Zero impact on backend API

---

#### Deploy Backend Only

```bash
# Build and deploy new backend version
cd services/api-gateway
make docker-push VERSION=v1.2.1
kubectl apply -f deployments/kubernetes/

# Frontend continues working with new backend
```

**Use Cases**:
- New API endpoints
- Backend bug fixes
- Database schema updates
- Performance optimizations

**Impact**: Frontend automatically uses new endpoints (backward compatible)

---

#### Independent Release Cycles

| Component | Release Frequency | Deployment Method | Downtime |
|-----------|------------------|-------------------|----------|
| **Frontend** | Multiple times per day | Vercel automatic | Zero |
| **Backend** | Weekly or as needed | Manual Docker/GKE | Zero (rolling update) |

**Benefits**:
- ✅ Deploy frontend fixes without touching backend
- ✅ Deploy backend updates without frontend rebuild
- ✅ Test backend changes before frontend integration
- ✅ Rollback independently if issues arise

---

#### Version Compatibility

**API Versioning** (Future Enhancement):
```
Frontend v2.5.0 can work with:
- Backend v1.2.0 ✅ (current)
- Backend v1.1.0 ✅ (backward compatible)
- Backend v2.0.0 ❌ (breaking changes)
```

**Current State**:
- Both frontend and backend deploy from same repository
- API is backward compatible
- No version pinning required yet

**Recommendation**:
- Keep API changes backward compatible
- Use feature flags for gradual rollouts
- Document breaking changes in release notes

---

## CI/CD Best Practices

### Frontend (Vercel)

✅ **Automatic Deployment**
- No manual intervention needed
- Deploys on every push to main
- Preview URLs for PRs

✅ **Build Validation**
- TypeScript type checking
- ESLint code quality
- Vite build optimization

✅ **Rollback Strategy**
- Vercel Dashboard → Deployments → "Promote to Production"
- Instant rollback to any previous deployment

### Backend (GKE)

✅ **Manual Control**
- Explicit docker push required
- Controlled deployment timing
- Pre-deployment testing possible

✅ **Versioning**
- Semantic versioning (v1.0.0, v1.1.0)
- Image tags for rollback
- Git commit SHA tracking (future)

✅ **Zero Downtime**
- Kubernetes rolling updates
- Health checks before routing traffic
- Automatic pod replacement

---

## Deployment Workflows

### Standard Release Workflow

#### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/user-management

# Make changes, test locally
cd apps/customer-portal && npm run dev
cd services/api-gateway && make run

# Commit and push
git add .
git commit -m "Add user management features"
git push origin feature/user-management
```

#### 2. Pull Request & Preview
- Create PR on GitHub
- Vercel automatically creates preview deployment
- Review preview URL: https://pr-123-customer.vercel.app
- Test new features on preview

#### 3. Merge to Main
```bash
# Merge PR
git checkout main
git pull origin main
```

#### 4. Automatic Frontend Deployment
- Vercel detects merge to main
- Builds and deploys automatically
- Live at https://customer.rns.ringer.tel within 2-3 minutes

#### 5. Manual Backend Deployment
```bash
cd services/api-gateway

# Build and push new version
make docker-push VERSION=v1.1.0

# Deploy to GKE
kubectl apply -f deployments/kubernetes/

# Verify
kubectl get pods -n warp-api
curl https://api.rns.ringer.tel/health
```

---

## Monitoring Deployments

### Frontend (Vercel)

**Vercel Dashboard**:
- Build logs
- Deployment status
- Performance metrics
- Error tracking

**Analytics**:
- Page load times
- Build duration
- Deployment frequency

### Backend (GKE)

**Kubernetes**:
```bash
# Watch deployment
kubectl rollout status deployment/api-gateway -n warp-api

# Check logs
kubectl logs -n warp-api -l app=api-gateway -f

# Check pod health
kubectl get pods -n warp-api -o wide
```

**Prometheus/Grafana**:
- API response times
- Error rates
- Request volume
- Resource usage

---

## Rollback Procedures

### Frontend (Vercel) - Instant Rollback

1. Go to Vercel Dashboard → Deployments
2. Find previous working deployment
3. Click "Promote to Production"
4. Done! (takes ~30 seconds)

### Backend (GKE) - Rolling Rollback

```bash
# View deployment history
kubectl rollout history deployment/api-gateway -n warp-api

# Rollback to previous version
kubectl rollout undo deployment/api-gateway -n warp-api

# Rollback to specific revision
kubectl rollout undo deployment/api-gateway -n warp-api --to-revision=3

# Verify rollback
kubectl rollout status deployment/api-gateway -n warp-api
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] Code reviewed and approved
- [ ] Tests passing locally
- [ ] TypeScript compilation successful
- [ ] Environment variables configured
- [ ] Database migrations ready (if any)
- [ ] Deployment window scheduled (for backend)

### Deployment

**Frontend (Automatic)**:
- [ ] Push to GitHub main branch
- [ ] Wait for Vercel build (2-3 min)
- [ ] Verify deployment in Vercel Dashboard
- [ ] Test production URL

**Backend (Manual)**:
- [ ] Build Docker image
- [ ] Push to Artifact Registry
- [ ] Apply Kubernetes manifests
- [ ] Verify pods are running
- [ ] Test API endpoints
- [ ] Monitor logs for errors

### Post-Deployment

- [ ] Health checks passing
- [ ] End-to-end testing
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Update deployment log
- [ ] Notify team

---

## Environment Management

### Development
- **Frontend**: Local dev server (npm run dev)
- **Backend**: Local Go server (make run)
- **Database**: Cloud SQL with local proxy
- **API URL**: http://localhost:8080

### Staging/Preview
- **Frontend**: Vercel preview deployments
- **Backend**: GKE dev namespace (future)
- **Database**: Staging Cloud SQL instance
- **API URL**: https://dev-api.rns.ringer.tel

### Production
- **Frontend**: https://customer.rns.ringer.tel (Vercel)
- **Backend**: https://api.rns.ringer.tel (GKE)
- **Database**: Cloud SQL (production instance)
- **Monitoring**: https://grafana.ringer.tel

---

## Troubleshooting CI/CD

### Vercel Build Failures

**Issue**: Build fails with TypeScript errors

**Solution**:
```bash
# Test build locally
cd apps/customer-portal
npm run build

# Fix errors, then push
git add .
git commit -m "Fix TypeScript errors"
git push
```

**Issue**: Environment variables not set

**Solution**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add missing variables
3. Trigger redeploy

### GKE Deployment Failures

**Issue**: Image pull errors

**Solution**:
```bash
# Verify image exists
gcloud artifacts docker images list \
  us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform

# Re-push image
cd services/api-gateway
make docker-push
```

**Issue**: Pods in CrashLoopBackOff

**Solution**:
```bash
# Check logs
kubectl logs -n warp-api deployment/api-gateway

# Common issues:
# - Database connection failed → Check Cloud SQL proxy
# - Missing env vars → Check secret configuration
# - Port conflicts → Check service definition
```

---

## Future Enhancements

### Planned Improvements

1. **GitHub Actions for Backend**
   - Automatic Docker builds on push
   - Automatic GKE deployment for main branch
   - Test suite execution

2. **Automated Testing**
   - Frontend: Playwright E2E tests
   - Backend: Go integration tests
   - Contract testing between frontend/backend

3. **Advanced Monitoring**
   - Sentry error tracking
   - LogRocket session replay
   - DataDog APM

4. **Blue-Green Deployments**
   - Zero-downtime backend updates
   - Instant rollback capability
   - A/B testing support

---

## References

- **Vercel Documentation**: https://vercel.com/docs
- **GKE Documentation**: https://cloud.google.com/kubernetes-engine/docs
- **Artifact Registry**: https://cloud.google.com/artifact-registry/docs
- **kubectl Cheat Sheet**: https://kubernetes.io/docs/reference/kubectl/cheatsheet/

---

**Last Updated**: 2025-11-30
**Maintained By**: Platform Engineering Team
