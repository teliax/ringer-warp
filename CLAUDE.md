# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WARP** (Wholesale Accounting Routing and Provisioning Platform) is a carrier-grade SIP trunking and messaging platform for wholesale telecom carriers built on Google Cloud Platform.

**Current Status**: Phase 1 (Infrastructure) Complete ✅ | Phase 2 (Applications) Complete ✅ | Phase 3 (API Development) In Progress 🚧

**GCP Project**: `ringer-warp-v01`
**Primary Cluster**: `warp-kamailio-cluster` (GKE Autopilot, us-central1)
**Primary Namespace**: `warp-core` (Kamailio), `messaging` (Jasmin, Redis, RabbitMQ)

## Essential Commands

### GCP & Kubernetes Access

```bash
# Set project and authenticate
export GCP_PROJECT_ID=ringer-warp-v01
gcloud config set project $GCP_PROJECT_ID

# Configure kubectl for main cluster
gcloud container clusters get-credentials warp-kamailio-cluster --zone us-central1

# View all services
kubectl get services --all-namespaces

# Check pod status
kubectl get pods --all-namespaces

# View SSL certificates
kubectl get certificates --all-namespaces
```

### Terraform Infrastructure

```bash
# Use v01 environment (production)
cd warp/terraform/environments/v01

# Initialize Terraform (uses GCS backend: gs://ringer-warp-v01-terraform-state)
~/.local/bin/terraform init

# Plan infrastructure changes
~/.local/bin/terraform plan

# Apply changes
~/.local/bin/terraform apply

# View state
~/.local/bin/terraform state list

# Check specific resource
~/.local/bin/terraform state show module.compute.google_compute_instance.rtpengine[0]
```

**Note**: Terraform installed at `~/.local/bin/terraform` (v1.9.5)

### Database Operations

```bash
# Get Cloud SQL instance connection string
gcloud sql instances describe warp-db --format="value(connectionName)"

# Connect to PostgreSQL via Cloud SQL Proxy
cloud_sql_proxy -instances=<CONNECTION_NAME>=tcp:5432

# Run database initialization scripts
cd warp/database/setup
./init-database.sh
```

### RTPEngine Deployment (Terraform + Golden Image)

```bash
# RTPEngine is now deployed via Terraform (IaC)
cd warp/terraform/environments/v01

# Deploy RTPEngine VMs using golden image
terraform apply

# Verify RTPEngine VMs are on correct subnet (10.0.1.0/24)
gcloud compute instances list --filter="name~rtpengine"

# Check RTPEngine service status
gcloud compute ssh warp-rtpengine-1 --zone us-central1-a --command "systemctl status rtpengine"

# Verify dynamic discovery in Kamailio
kubectl exec -n warp-core <kamailio-pod> -c kamailio -- kamcmd rtpengine.show all
```

**Key Details:**
- **Subnet**: 10.0.1.0/24 (warp-rtpengine-subnet)
- **IPs**: 10.0.1.11, 10.0.1.12, 10.0.1.13
- **Discovery**: Dynamic via Redis (rtpengine table)
- **Load Balancing**: Weight-based (50/50/50)

### Monitoring Access

```bash
# Production HTTPS endpoints
# Grafana: https://grafana.ringer.tel (admin/prom-operator)
# Prometheus: https://prometheus.ringer.tel
# API: https://api-v2.ringer.tel

# Port-forward for local access
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Deployment Scripts

```bash
# Full platform deployment orchestration
./deploy-warp-platform.sh

# Quick health check
./scripts/quick-health-check.sh

# Database initialization
./scripts/init-db-simple.sh

# Kubernetes services deployment
./scripts/deploy-k8s-services-v01.sh
```

## Architecture Overview

### Infrastructure Stack
- **Cloud**: GCP (us-central1)
- **Orchestration**: GKE Autopilot for containerized workloads
- **Compute VMs**: For kernel-level components (RTPEngine)
- **Database**: PostgreSQL on Cloud SQL
- **Analytics**: BigQuery for CDR/MDR storage
- **Cache**: Redis Cluster (planned)
- **Service Mesh**: Consul

### Core Components

| Component | Deployment | Location | Status |
|-----------|-----------|----------|--------|
| **Kamailio** | K8s (warp-core) | GKE, Redis-backed | ✅ Production |
| **RTPEngine** | Terraform VMs (golden image) | 10.0.1.0/24, Redis discovery | ✅ Production |
| **Jasmin SMSC** | K8s (messaging) | GKE, SMPP 34.55.43.157 | ✅ Production |
| **Redis** | K8s (messaging) | State & discovery | ✅ Production |
| **RabbitMQ** | K8s (messaging) | Message queuing | ✅ Production |
| **Homer** | K8s (homer) | SIP capture | ✅ Production |
| **Consul** | VMs | Service discovery | ✅ Production |
| **Prometheus/Grafana** | K8s (monitoring) | Metrics & dashboards | ✅ Production |
| **PostgreSQL** | Cloud SQL | Customer data | ✅ Production |
| **API Gateway** | - | - | 🚧 Next Priority |

### Directory Structure

```
ringer-warp/
├── warp/
│   ├── terraform/          # Infrastructure as Code
│   │   ├── environments/   # dev, v01 environments
│   │   └── modules/        # networking, compute, gke, database, cache, consul
│   ├── k8s/               # Kubernetes manifests
│   │   ├── kamailio/      # SIP signaling
│   │   ├── homer/         # SIP capture
│   │   ├── monitoring/    # Prometheus, Grafana
│   │   ├── database/      # DB init jobs
│   │   └── grafana/       # Dashboard configs
│   ├── database/
│   │   ├── schemas/       # PostgreSQL and CDR schemas
│   │   └── setup/         # Initialization scripts
│   ├── docs/              # Technical documentation
│   │   ├── ARCHITECTURE.md
│   │   ├── BILLING_SYSTEM.md
│   │   ├── SIP_NETWORK_ARCHITECTURE.md
│   │   ├── SMS_ARCHITECTURE.md
│   │   └── HOMER_ARCHITECTURE.md
│   └── api/               # OpenAPI specs
├── rtpengine/
│   ├── golden-image/      # Golden image creation scripts
│   │   └── gcloud/        # VM and image management
│   └── scripts/           # RTPEngine operations
├── docs/                  # Platform-wide documentation
│   ├── DEPLOYMENT.md      # Deployment procedures
│   ├── ARCHITECTURAL_DECISIONS.md
│   └── ENVIRONMENT_SETUP.md
├── customer-frontend/     # Next.js customer portal
├── admin-frontend/        # Next.js admin portal
└── scripts/               # Operational scripts
    ├── deploy-*.sh
    ├── verify-*.sh
    └── dns/               # DNS management
```

## Critical Knowledge

### Kamailio Redis Integration (Updated Oct 2025)

**IMPORTANT**: Kamailio uses **Redis for all state management**, NOT PostgreSQL.

**Configuration:**
```bash
# Kamailio namespace
kubectl get pods -n warp-core

# Redis backend
Host: redis-service.messaging.svc.cluster.local:6379
Module: db_redis

# State storage
- usrloc (registrations): db_mode=3 (DB-only, shared across all 3 pods)
- dialog (call state): db_mode=1 (write-through cache, persistent)
- rtpengine: Dynamic instance discovery from Redis table
```

**Verification:**
```bash
# Check Kamailio can reach Redis
kubectl exec -n warp-core <kamailio-pod> -c kamailio -- kamcmd ul.dump

# Check RTPEngine instances loaded from Redis
kubectl exec -n warp-core <kamailio-pod> -c kamailio -- kamcmd rtpengine.show all

# Update RTPEngine instances in Redis
kubectl exec -n messaging redis-<pod> -c redis -- redis-cli HGETALL "rtpengine:entry::1"
```

### RTPEngine Golden Image Approach

**Why VMs Instead of K8s**: RTPEngine requires kernel-level access for optimal media processing performance. GKE/containers don't support the kernel module.

**Building from Source**: The Sipwise APT repository is deprecated (404 errors). We build RTPEngine mr13.4.1 from source on each golden image.

**Key Dependencies**:
- gperf, default-libmysqlclient-dev, pandoc
- redis-server (required, no auth needed)
- Kernel module won't load in GCP (expected, not critical)

**Service Configuration**: Must use `Type=simple` with `--foreground` flag in systemd service.

**Golden Image Workflow**:
1. Create VM → Install dependencies → Build RTPEngine → Configure
2. Create image snapshot
3. Deploy multiple production VMs from golden image
4. All VMs have identical, tested configurations

### Terraform State Management

**Backend**: GCS bucket `warp-terraform-state-dev`
**State File**: `terraform/state/default.tfstate`
**Caution**: Always run `terraform plan` before `apply` in production

### Database Schema

**PostgreSQL (Cloud SQL)**:
- Customer accounts, trunks, routing configurations
- Located in `warp/database/schemas/postgresql-schema.sql`

**BigQuery**:
- CDRs (Call Detail Records), MDRs (Message Detail Records)
- Partitioned by date for performance
- Schema in `warp/database/schemas/cdr_schema.sql`

### Network Architecture

**VPC Subnets**:
- GKE: `10.0.0.0/24` (pods: `10.1.0.0/16`, services: `10.2.0.0/16`)
- RTPEngine: `10.0.1.0/24`
- Consul: `10.0.2.0/24`

**External Access**:
- SSL/TLS termination at Load Balancer
- Cloud Armor for DDoS protection
- SIP traffic: IP whitelisting via firewall rules

### Kubernetes Namespaces

- `default`: Kamailio, Homer, Consul, API services
- `monitoring`: Prometheus, Grafana, AlertManager

## Development Workflow

### Making Infrastructure Changes

1. Edit Terraform files in `warp/terraform/modules/` or `environments/`
2. Run `terraform plan` to preview changes
3. Review plan output carefully
4. Run `terraform apply` if changes are safe
5. Verify with `kubectl` or `gcloud` commands

### Deploying Kubernetes Services

1. Update manifests in `warp/k8s/<component>/`
2. Apply changes: `kubectl apply -f warp/k8s/<component>/`
3. Verify: `kubectl get pods -n <namespace>`
4. Check logs: `kubectl logs <pod-name> -n <namespace>`

### Deploying RTPEngine Changes

1. Update golden image scripts in `rtpengine/golden-image/gcloud/`
2. Create new golden VM with changes
3. Test thoroughly on golden VM
4. Create new golden image with version tag
5. Update production VMs using new image
6. Verify with `rtpengine-ctl list` on each VM

### Adding New Modules

1. Review `docs/PROVIDER_MODULES_SPECIFICATION.md` for plugin architecture
2. Create module in appropriate service directory
3. Add tests
4. Update OpenAPI spec in `warp/api/openapi.yaml`
5. Document in relevant `warp/docs/*.md` file

## Troubleshooting

### SIP Issues
- Check Homer web UI: https://homer.ringer.tel (when deployed)
- Review Kamailio logs: `kubectl logs -n default <kamailio-pod>`
- See `warp/docs/HOMER_TROUBLESHOOTING.md`

### Database Connectivity
- Verify Cloud SQL proxy is running
- Check service account permissions
- Review connection string format

### RTPEngine Problems
- SSH to VM: `gcloud compute ssh <instance-name> --zone=us-central1-a`
- Check service: `sudo systemctl status rtpengine`
- View logs: `sudo journalctl -u rtpengine -f`
- Verify Redis: `redis-cli ping`

### Kubernetes Issues
- Check pod events: `kubectl describe pod <pod-name> -n <namespace>`
- View logs: `kubectl logs <pod-name> -n <namespace> --previous` (for crashed pods)
- Check resources: `kubectl top pods -n <namespace>`

## Key Documentation Files

- **[README.md](README.md)**: Project overview and current status
- **[warp/docs/PRD.md](warp/docs/PRD.md)**: Product requirements
- **[warp/docs/ARCHITECTURE.md](warp/docs/ARCHITECTURE.md)**: System architecture
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**: Deployment procedures and RTPEngine golden image details
- **[docs/ARCHITECTURAL_DECISIONS.md](docs/ARCHITECTURAL_DECISIONS.md)**: Platform design choices
- **[warp/api/openapi.yaml](warp/api/openapi.yaml)**: API specification

## Production URLs

- **API**: https://api-v2.ringer.tel
- **Grafana**: https://grafana.ringer.tel (admin/prom-operator)
- **Prometheus**: https://prometheus.ringer.tel

## Important Notes

- **SSL Certificates**: All web services use Let's Encrypt via cert-manager
- **Secrets**: Stored in Google Secret Manager, not in code
- **Multi-Region**: Currently single-region (us-central1), expansion planned
- **Billing Integration**: NetSuite connector planned for Phase 3
- **SMS Gateway**: Jasmin SMSC deployment is next priority after RTPEngine
