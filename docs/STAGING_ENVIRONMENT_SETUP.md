# Staging Environment Setup Guide

## Overview
Cloud-first staging environment strategy - no local services required. All development happens against real GCP resources in a staging project.

## Architecture Decision: Skip Local, Go Straight to Staging

### Rationale
- **Greenfield project** - No production to disrupt
- **Real cloud testing** - Test GCP services, IAM, networking from day one
- **Team collaboration** - Everyone works against same environment
- **No local complexity** - No Docker compose, port conflicts, or setup issues
- **CI/CD from start** - Deploy on every commit, catch issues early

## Staging Infrastructure

### GCP Resources (Project: ringer-warp-v01)
```yaml
Compute:
  - GKE Autopilot Cluster: warp-staging (us-central1)
  - VM Instance Groups: rtpengine-staging (autoscaling 2-10)

Storage & Databases:
  - Cloud SQL PostgreSQL: warp-staging-db
  - Memorystore Redis: warp-staging-cache
  - BigQuery Dataset: warp_telecom_staging
  - Cloud Storage Buckets:
    - warp-cdr-staging
    - warp-recordings-staging
    - warp-backups-staging

Networking:
  - Cloud NAT: Static IPs for origination
  - Cloud Load Balancer: Ingress for all services
  - Cloud Armor: DDoS protection
  - Private Service Connect: Secure DB access

Monitoring:
  - Cloud Monitoring: Infrastructure metrics
  - Cloud Trace: Distributed tracing
  - Cloud Logging: Centralized logs
  - Managed Prometheus: Application metrics
```

### Frontend (Vercel)
```yaml
Projects:
  - console-staging.ringer.tel (Customer Portal)
  - admin-staging.ringer.tel (Admin Portal)
  - www-staging.ringer.tel (Marketing Site)

Deployment:
  - Auto-deploy on push to staging branch
  - Preview deployments for PRs
  - Environment variables from Vercel dashboard
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy to Staging

on:
  push:
    branches: [staging]
  pull_request:
    branches: [staging]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Run unit tests
      - Run integration tests
      - Security scanning

  build:
    needs: test
    steps:
      - Build Docker images
      - Push to GCR
      - Tag with commit SHA

  deploy-backend:
    needs: build
    steps:
      - Deploy to GKE staging
      - Run database migrations
      - Update service endpoints

  deploy-frontend:
    needs: test
    steps:
      - Vercel auto-deploys
      - Update environment variables
      - Invalidate CDN cache
```

## Developer Workflow

### 1. Initial Setup
```bash
# Clone repository
git clone https://github.com/ringer/ringer-warp.git
cd ringer-warp

# Install gcloud CLI
curl https://sdk.cloud.google.com | bash

# Authenticate with GCP
gcloud auth login
gcloud config set project ringer-warp-v01

# Get staging credentials
gcloud container clusters get-credentials warp-staging --region us-central1

# Copy environment file
cp .env.development .env.staging
# Fill in actual credentials from 1Password/Vault
```

### 2. Development Flow
```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes locally
code .

# Test against staging APIs
npm run dev  # Frontend connects to https://api-staging.ringer.tel

# Commit and push
git add .
git commit -m "feat: add new feature"
git push origin feature/my-feature

# Create PR to staging branch
# CI/CD runs tests and deploys preview
```

### 3. Service URLs
```yaml
APIs:
  - API Gateway: https://api-staging.ringer.tel
  - GraphQL: https://api-staging.ringer.tel/graphql
  - WebSocket: wss://api-staging.ringer.tel/ws

Frontends:
  - Customer Portal: https://console-staging.ringer.tel
  - Admin Portal: https://admin-staging.ringer.tel
  - Marketing: https://www-staging.ringer.tel

Monitoring:
  - Grafana: https://grafana-staging.ringer.tel
  - Prometheus: https://prometheus-staging.ringer.tel
  - Homer: https://homer-staging.ringer.tel

SIP/RTP:
  - SIP Domain: sip-staging.ringer.tel
  - RTP Range: rtpengine-staging.ringer.tel:10000-20000
```

## Database Management

### Migrations
```bash
# Auto-run on deploy to staging
npm run migrate:staging

# Manual migration
kubectl exec -it deploy/api-gateway -- npm run migrate

# Seed test data
kubectl exec -it deploy/api-gateway -- npm run seed:staging
```

### Access Cloud SQL
```bash
# Cloud SQL Proxy for direct access
cloud_sql_proxy -instances=ringer-warp-v01:us-central1:warp-staging-db

# Connect with psql
psql -h 127.0.0.1 -U warp_staging -d warp_staging
```

## Monitoring & Debugging

### View Logs
```bash
# API logs
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=warp-staging"

# Frontend logs (Vercel)
vercel logs console-staging.ringer.tel

# SIP traces (Homer)
# Access https://homer-staging.ringer.tel
```

### Metrics & Alerts
- Grafana dashboards: https://grafana-staging.ringer.tel
- Alert channels: #warp-staging-alerts in Slack
- PagerDuty: Non-critical staging alerts only

## Cost Management

### Resource Limits
```yaml
GKE Autopilot:
  - Auto-scales based on load
  - Minimum nodes: 2
  - Maximum nodes: 10

Cloud SQL:
  - Instance: db-f1-micro for staging
  - Storage: 100GB with auto-growth
  - Backups: Daily, 7-day retention

BigQuery:
  - Partition expiration: 30 days
  - Query limits: 10TB/month

Estimated Monthly Cost: ~$500-800
```

### Cost Optimization
1. Use preemptible VMs for batch jobs
2. Schedule scale-down during off-hours
3. Clean up old container images regularly
4. Use BigQuery slot reservations

## Security

### Access Control
```yaml
IAM Roles:
  - Developers: Editor on staging resources
  - CI/CD: Service Account with deployment permissions
  - External services: Minimal scoped credentials

Network Security:
  - Private GKE cluster
  - Cloud NAT for egress
  - VPC Service Controls
  - Private Service Connect for databases
```

### Secrets Management
```bash
# Store secrets in Google Secret Manager
gcloud secrets create api-key --data-file=api-key.txt

# Reference in deployments
kubectl create secret generic api-secrets \
  --from-literal=api-key=$(gcloud secrets versions access latest --secret=api-key)
```

## Staging vs Production Differences

| Component | Staging | Production |
|-----------|---------|------------|
| GKE Cluster | Autopilot (2-10 nodes) | Standard (10-50 nodes) |
| Cloud SQL | f1-micro, 1 replica | n2-standard-4, 3 replicas |
| Redis | Basic tier, 1GB | Standard tier, 10GB |
| BigQuery | 30-day retention | 7-year retention |
| Monitoring | Basic alerts | 24/7 paging |
| Backups | Daily | Continuous |
| SLA | Best effort | 99.99% |

## Common Commands

```bash
# Deploy specific service
kubectl set image deployment/api-gateway api-gateway=gcr.io/ringer-warp-v01/api-gateway:$TAG

# Check deployment status
kubectl rollout status deployment/api-gateway -n warp-staging

# View service logs
kubectl logs -f deployment/api-gateway -n warp-staging

# Port forward for debugging
kubectl port-forward service/api-gateway 8080:80 -n warp-staging

# Run one-off job
kubectl run --rm -it debug --image=gcr.io/ringer-warp-v01/api-gateway:latest -- /bin/bash
```

## Troubleshooting

### Service not accessible
1. Check ingress configuration: `kubectl describe ingress`
2. Verify DNS records: `dig api-staging.ringer.tel`
3. Check Cloud Armor rules: `gcloud compute security-policies list`

### Database connection issues
1. Verify Cloud SQL proxy: `gcloud sql instances describe warp-staging-db`
2. Check private IP connectivity: `kubectl exec -it deploy/api-gateway -- ping $DB_HOST`
3. Verify credentials in secrets: `kubectl get secret db-credentials -o yaml`

### High costs
1. Review GKE node usage: `gcloud container clusters describe warp-staging`
2. Check BigQuery usage: `bq ls -j -a -n 100`
3. Review Cloud Storage: `gsutil du -sh gs://warp-*-staging`

## Next Steps

1. **Week 1**: Deploy base infrastructure
2. **Week 2**: Set up CI/CD pipelines
3. **Week 3**: Deploy first services
4. **Week 4**: Enable monitoring
5. **Ongoing**: Iterate and improve

---
*Remember: This is staging, not production. It's okay to break things and experiment. That's what staging is for!*