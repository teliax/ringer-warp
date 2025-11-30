# WARP Platform Deployment Guide

## Overview

This document provides comprehensive deployment procedures for the WARP platform components. We use a combination of Kubernetes (GKE Autopilot) for containerized services and Compute Engine VMs for specialized components requiring kernel-level access.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GKE Autopilot Cluster                    │
├─────────────────────────────────────────────────────────────────┤
│  Namespace: default        │  Namespace: monitoring             │
│  - Kamailio               │  - Prometheus                      │
│  - Consul                 │  - Grafana                         │
│  - Homer                  │  - AlertManager                    │
│  - API Services           │                                    │
├─────────────────────────────────────────────────────────────────┤
│                     Compute Engine VMs                          │
│  - RTPEngine (3 VMs)      │  - Jasmin SMSC                    │
│  - PostgreSQL (Cloud SQL) │  - Redis Cluster                  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Deployment Status

| Component | Status | Method | Location |
|-----------|--------|---------|----------|
| Kamailio | ✅ Deployed | K8s | GKE |
| RTPEngine | ✅ Deployed | Golden Image | 3 Compute VMs |
| Homer | ✅ Deployed | K8s | GKE |
| Consul | ✅ Deployed | K8s | GKE |
| Prometheus | ✅ Deployed | K8s | GKE |
| Grafana | ✅ Deployed | K8s | GKE |
| PostgreSQL | ✅ Deployed | Managed | Cloud SQL |
| Redis | 🚧 Pending | K8s | GKE |
| Jasmin SMSC | 🚧 Pending | VM/K8s | TBD |
| API Gateway | 🚧 Development | K8s | GKE |

## RTPEngine Deployment (Golden Image Approach)

### Overview

RTPEngine requires kernel-level access for optimal performance, making it unsuitable for containerized deployment. We use a golden image approach for reproducible deployments.

### Key Learnings

1. **Sipwise Repository Deprecated**: The official Sipwise APT repository returns 404. Must build from source.
2. **Outdated Docker Images**: Available Docker images (drachtio/rtpengine) are 5+ years old.
3. **Required Dependencies**: 
   - gperf
   - default-libmysqlclient-dev
   - pandoc
   - redis-server
4. **Kernel Module**: Won't load in GCP (expected, not critical for functionality)
5. **Service Configuration**: Must use `Type=simple` with `--foreground` flag
6. **Redis**: Required but doesn't need authentication by default

### Deployment Process

#### 1. Create Golden VM

```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image

# Create the golden VM
./gcloud/create-golden-vm.sh

# The script will:
# - Create a new VM with Ubuntu 22.04
# - Install all dependencies
# - Build RTPEngine mr13.4.1 from source
# - Configure systemd service
# - Optimize system settings
```

#### 2. Create Golden Image

```bash
# Stop the VM and create image
./gcloud/create-golden-image.sh

# This creates: rtpengine-golden-image-v1-YYYYMMDD
```

#### 3. Deploy Production VMs

```bash
# Deploy 3 RTPEngine instances
./gcloud/deploy-rtpengine-vms.sh

# Creates:
# - rtpengine-prod-1
# - rtpengine-prod-2
# - rtpengine-prod-3
```

#### 4. Verify Deployment

```bash
# Check all instances
gcloud compute instances list | grep rtpengine

# SSH to verify service
gcloud compute ssh rtpengine-prod-1 --zone=us-central1-a
sudo systemctl status rtpengine
```

### RTPEngine Configuration

Location: `/etc/rtpengine/rtpengine.conf`

```ini
[rtpengine]
interface = ens4/10.128.1.88
listen-ng = 127.0.0.1:22222
listen-cli = 127.0.0.1:9900

port-min = 30000
port-max = 40000

log-level = 6
log-facility = local1
log-facility-cdr = local1
log-facility-rtcp = local1

homer = yes
homer-protocol = udp
homer-id = 2001

recording-dir = /var/spool/rtpengine
recording-method = pcap
recording-format = eth

redis = 127.0.0.1:6379
redis-db = 5
subscribe-keyspace = 5
redis-expires = 86400
no-redis-required = false

# Performance settings
num-threads = 16
```

### Maintenance Procedures

#### Update RTPEngine

```bash
cd /home/daldworth/repos/ringer-warp/rtpengine/golden-image

# Update to new version
./update-rtpengine.sh --version mr13.4.2

# This will:
# 1. Create new golden VM
# 2. Build new version
# 3. Create new golden image
# 4. Perform rolling update of VMs
```

#### Backup and Restore

```bash
# Backup configuration and state
./backup-restore.sh backup

# Restore to new VM
./backup-restore.sh restore /path/to/backup.tar.gz
```

## Kamailio Deployment

### Current Status

Kamailio is deployed in GKE Autopilot cluster with the following configuration:

- **Replicas**: 3
- **Service Type**: LoadBalancer (TCP/UDP)
- **ConfigMap**: Dynamic configuration
- **Integration**: Homer, Consul

### Configuration Management

```bash
# View current configuration
kubectl get configmap kamailio-config -o yaml

# Update configuration
kubectl edit configmap kamailio-config

# Restart pods to apply changes
kubectl rollout restart deployment kamailio
```

## Monitoring Stack

### Access Points

- **Grafana**: https://grafana.ringer.tel (admin/prom-operator)
- **Prometheus**: https://prometheus.ringer.tel
- **AlertManager**: Internal only

### Key Dashboards

1. **RTPEngine Performance**
   - Call volume
   - Packet loss
   - CPU/Memory usage
   - Port utilization

2. **Kamailio SIP**
   - Active calls
   - Registration count
   - Message rate
   - Error rate

3. **System Overview**
   - Resource usage
   - Network traffic
   - Service health
   - Alert status

## Jasmin SMSC Deployment (Pending)

### Deployment Strategy

Evaluating two approaches:

1. **Containerized** (Preferred)
   - Kubernetes deployment
   - Horizontal scaling
   - Easier management

2. **VM-based**
   - If kernel requirements exist
   - Similar to RTPEngine approach

### Prerequisites

- Redis cluster
- RabbitMQ
- SMPP connections configured
- Sinch API credentials

## API Gateway Deployment

### Architecture

- **Language**: Go microservices
- **Framework**: Gin HTTP framework
- **Authentication**: Google OAuth → JWT
- **Authorization**: Gatekeeper middleware (endpoint-based permissions)
- **Database**: PostgreSQL (Cloud SQL)
- **Container Registry**: Google Artifact Registry

### Deployment Process

#### 1. Build and Push Docker Image

```bash
cd services/api-gateway

# Build Docker image
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.0 .

# Push to Artifact Registry
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:v1.0.0
```

Or use the Makefile:
```bash
make docker-push VERSION=v1.0.0
```

#### 2. Deploy to GKE

```bash
# Deploy to Kubernetes
kubectl apply -f deployments/kubernetes/

# Verify deployment
kubectl get pods -n warp-api
kubectl logs -n warp-api -l app=api-gateway
```

#### 3. Verify API Endpoints

```bash
# Health check
curl https://api.rns.ringer.tel/health

# Metrics
curl https://api.rns.ringer.tel/metrics
```

### API Endpoints

- **Base URL**: https://api.rns.ringer.tel
- **Authentication**: `/auth/exchange`, `/auth/refresh`, `/auth/validate`
- **Gatekeeper**: `/v1/gatekeeper/my-permissions`, `/v1/gatekeeper/check-access`
- **Customers**: `/v1/customers`, `/v1/customers/:id/users`
- **User Types**: `/v1/admin/user-types` (CRUD + permissions)
- **Trunks**: `/v1/trunks`, `/v1/admin/customers/:id/trunks`

## Frontend Deployment (Customer Portal)

### Vercel Automatic Deployment

The customer portal (`apps/customer-portal`) is deployed to Vercel with **automatic CI/CD from GitHub**.

#### How It Works

1. **Push to GitHub** → Vercel detects changes
2. **Automatic Build** → Vercel runs `npm run build`
3. **Automatic Deploy** → New version goes live
4. **Preview Deployments** → Every PR gets a preview URL

#### Configuration

**File**: `apps/customer-portal/vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "env": {
    "VITE_API_URL": "https://api.rns.ringer.tel",
    "VITE_GOOGLE_CLIENT_ID": "791559065272-..."
  }
}
```

#### Manual Deployment (if needed)

```bash
cd apps/customer-portal

# Install Vercel CLI
npm i -g vercel

# Deploy to production
vercel --prod

# Deploy preview
vercel
```

#### Production URL

- **Customer Portal**: https://customer.rns.ringer.tel (or Vercel-provided URL)

### Environment Variables (Vercel Dashboard)

Configure in Vercel project settings:
- `VITE_API_URL` → https://api.rns.ringer.tel
- `VITE_GOOGLE_CLIENT_ID` → OAuth client ID

### Build Verification

```bash
# Test build locally
npm run build
npm run preview

# Check for TypeScript errors
npm run lint
```

## Security Considerations

### Network Security

1. **Firewall Rules**
   - SIP: 5060-5061 (TCP/UDP)
   - RTP: 30000-40000 (UDP)
   - API: 443 (TCP)
   - Admin: Restricted IPs only

2. **SSL/TLS**
   - All web services use Let's Encrypt
   - Managed by cert-manager
   - Auto-renewal configured

3. **Access Control**
   - Google Identity Platform
   - RBAC in Kubernetes
   - VPN for admin access

### Secrets Management

- Google Secret Manager
- Kubernetes secrets
- Environment-specific configs

## Deployment Checklist

### Pre-deployment

- [ ] GCP project configured
- [ ] Network/firewall rules
- [ ] DNS records
- [ ] SSL certificates
- [ ] Database schemas
- [ ] Secrets configured

### Deployment

- [ ] Infrastructure (Terraform)
- [ ] Kubernetes cluster
- [ ] Database setup
- [ ] Core services
- [ ] Monitoring stack
- [ ] Load balancer config

### Post-deployment

- [ ] Health checks passing
- [ ] Monitoring alerts configured
- [ ] Backup procedures tested
- [ ] Documentation updated
- [ ] Team access granted
- [ ] Customer testing

## Troubleshooting

### Common Issues

1. **RTPEngine Not Starting**
   - Check redis connectivity
   - Verify port ranges available
   - Review systemd logs: `journalctl -u rtpengine`

2. **Kamailio Registration Failures**
   - Check database connectivity
   - Verify SIP routing
   - Review Homer captures

3. **SSL Certificate Issues**
   - Check cert-manager logs
   - Verify DNS propagation
   - Review ingress configuration

### Debug Commands

```bash
# RTPEngine
sudo rtpengine-ctl -ip 127.0.0.1 -port 9900 list totals

# Kamailio
kubectl exec -it kamailio-pod -- kamcmd core.version

# Database
kubectl exec -it postgres-pod -- psql -U warp -c "SELECT count(*) FROM subscribers;"

# Monitoring
curl -s http://localhost:9090/api/v1/targets | jq
```

## Rollback Procedures

### RTPEngine Rollback

```bash
# Revert to previous golden image
gcloud compute instances delete rtpengine-prod-1 --zone=us-central1-a
gcloud compute instances create rtpengine-prod-1 \
  --source-machine-image=rtpengine-golden-image-v0-YYYYMMDD \
  --zone=us-central1-a
```

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/kamailio

# Rollback to previous version
kubectl rollout undo deployment/kamailio
```

## Documentation

- **RTPEngine**: See `/docs/rtpengine-deployment.md`
- **Kamailio**: See `/warp/docs/SIP_NETWORK_ARCHITECTURE.md`
- **Homer**: See `/warp/docs/HOMER_ARCHITECTURE.md`
- **Monitoring**: See `/docs/monitoring-endpoints.md`

## Support

For deployment issues:

1. Check component logs
2. Review monitoring dashboards
3. Consult runbooks
4. Contact platform team

---

Last Updated: December 2024
Version: 1.0.0