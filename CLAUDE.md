# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WARP** (Wholesale Accounting Routing and Provisioning Platform) is a carrier-grade SIP trunking and messaging platform for wholesale telecom carriers built on Google Cloud Platform.

**Current Status**: Phase 1 (Infrastructure) Complete ✅ | Phase 2 (Applications) Complete ✅ | Phase 3 (API Development) In Progress 🚧

**Recent Updates (Oct 9, 2025):**
- ✅ API Gateway deployed (Go + Gin, vendor management working)
- ✅ Jasmin jCli accessible (bind=0.0.0.0:8990)
- ✅ PostgreSQL integration complete
- ✅ PersistentVolume for Jasmin config storage
- 🔧 Testing Sinch SMPP connector persistence

**GCP Project**: `ringer-warp-v01`
**Primary Cluster**: `warp-cluster` (GKE Autopilot, us-central1)
**Primary Namespace**: `warp-core` (Kamailio), `messaging` (Jasmin, Redis, RabbitMQ)

## Essential Commands

### GCP & Kubernetes Access

```bash
# Set project and authenticate
export GCP_PROJECT_ID=ringer-warp-v01
gcloud config set project $GCP_PROJECT_ID

# Configure kubectl for main cluster
gcloud container clusters get-credentials warp-cluster --region us-central1

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
cd infrastructure/terraform/environments/v01

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
cd infrastructure/database/setup
./init-database.sh
```

### RTPEngine Deployment (Terraform + Golden Image)

```bash
# RTPEngine is now deployed via Terraform (IaC)
cd infrastructure/terraform/environments/v01

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
# API: https://api.rns.ringer.tel

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

## Deployment Best Practices

### Docker Image Versioning (CRITICAL)

⚠️ **ALWAYS tag Docker images with BOTH semantic version AND `latest`**

**Required Practice**:
```bash
# ✅ CORRECT: Tag with version AND latest
docker build --platform linux/amd64 \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:vX.Y.Z \
  -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:latest .

# Push BOTH tags
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:vX.Y.Z
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/SERVICE:latest

# OR use Makefile (handles both automatically)
make docker-push VERSION=vX.Y.Z
```

**❌ NEVER push only `latest` to production**:
```bash
# DON'T DO THIS - No rollback capability!
docker push SERVICE:latest  # ❌ Missing version tag
```

**Why This Matters**:
- ✅ **Rollback**: Can instantly revert to previous version
- ✅ **Audit Trail**: Know exactly what's deployed in production
- ✅ **Debugging**: Reproduce issues with specific versions
- ✅ **Change Tracking**: Link deployments to code changes
- ❌ Only `latest`: Impossible to rollback or audit deployments

**Semantic Versioning Rules**:
- `v1.0.1` - **Patch**: Bug fixes, config changes, hotfixes
- `v1.1.0` - **Minor**: New features, backwards compatible
- `v2.0.0` - **Major**: Breaking changes, API contract changes

**After Each Deployment**:
1. Update `CHANGELOG.md` with version and changes
2. Tag git commit with version: `git tag v1.0.1 && git push --tags`
3. Verify both tags in Artifact Registry
4. Document deployed version in deployment docs

**See Also**:
- [CI/CD Pipeline Guide](docs/deployment/CI_CD_PIPELINE.md#image-versioning--tagging-strategy)
- [Deployment Guide](docs/deployment/DEPLOYMENT.md)
- [API Gateway CHANGELOG](services/api-gateway/CHANGELOG.md)

## Authorization & Security

**Pattern**: Database-driven, endpoint-based authorization with multi-tenant customer scoping

### Authentication
- **Provider**: Google OAuth (only @ringer.tel emails allowed)
- **Flow**: Google ID → WARP JWT (access: 24h, refresh: 7d)
- **Tokens**: Stored in localStorage, auto-injected by axios interceptor

### Authorization (Gatekeeper)
- **User Types**: Named groups of permissions (superAdmin, admin, customer_admin, developer, billing, viewer)
  - **IMPORTANT**: User types are NOT hard-coded in authorization logic
  - They're just database records that group permissions together
  - Authorization decisions based ONLY on endpoint path matching, not type names
- **Permissions**: 48 resource paths across 12 categories (e.g., `/api/v1/customers/*`)
- **Wildcard Support**: `*` (SuperAdmin), `/path/*` (prefix match), `/path` (exact)
- **Enforcement**: Gatekeeper middleware on ALL protected routes

### Multi-Tenant Customer Scoping
- **Table**: `auth.user_customer_access` maps users → customers
- **SuperAdmin**: Wildcard `*` permission → Sees ALL customers (no scoping)
- **Regular Users**: See ONLY assigned customers via `WHERE customer_id = ANY($accessible_ids)`
- **Current State**: 1 user (david.aldworth@ringer.tel - superAdmin), 0 customer assignments

### Frontend Security
- **All API calls**: Frontend → WARP API Gateway ONLY (never direct to third parties)
- **Third-party APIs**: HubSpot, Teliport, Telique accessed via backend proxy
- **API Keys**: Stored in backend only, never exposed to browser
- **Customer Data**: Filtered server-side before sending to frontend

**See**: [docs/AUTH_AND_PERMISSION_SYSTEM.md](docs/AUTH_AND_PERMISSION_SYSTEM.md) for complete details

**Current User**: david.aldworth@ringer.tel (superAdmin - wildcard access to all resources)

---

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

### Directory Structure (Updated Oct 2025)

```
ringer-warp/
├── services/              # Backend services (Go)
│   ├── api-gateway/      # Main API (to be created)
│   └── exporters/        # Prometheus exporters
│       └── business-metrics/
│
├── apps/                  # Frontend applications
│   ├── customer-portal/  # React/Vite customer UI
│   └── admin-portal/     # React/Vite admin UI
│
├── infrastructure/        # Infrastructure as Code
│   ├── terraform/        # Terraform modules
│   │   ├── environments/ # v01 (production), dev
│   │   └── modules/      # networking, compute, gke, database
│   ├── kubernetes/       # K8s manifests
│   │   ├── warp/         # Kamailio, monitoring, database
│   │   ├── jasmin/       # Jasmin SMSC
│   │   ├── rabbitmq/     # Message broker
│   │   ├── ssl/          # Certificates
│   │   └── base/         # Common resources
│   ├── docker/           # Docker configurations
│   │   └── kamailio/     # Kamailio image
│   ├── database/         # Database schemas & setup
│   │   ├── schemas/      # PostgreSQL schemas
│   │   └── setup/        # Init scripts
│   └── api-specs/        # OpenAPI specifications
│       └── openapi.yaml
│
├── rtpengine/            # RTPEngine golden image
│   ├── golden-image/     # Image creation scripts
│   └── scripts/          # RTPEngine operations
│
├── docs/                 # Platform documentation
│   ├── warp-services/    # Service-specific docs
│   ├── api_docs/         # Third-party API references
│   ├── archive/          # Historical logs
│   └── *.md              # Architectural decisions, guides
│
├── scripts/              # Operational scripts
│   ├── deploy-*.sh
│   └── dns/              # DNS management
│
└── tests/                # Integration tests
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

1. Edit Terraform files in `infrastructure/terraform/modules/` or `environments/`
2. Run `terraform plan` to preview changes
3. Review plan output carefully
4. Run `terraform apply` if changes are safe
5. Verify with `kubectl` or `gcloud` commands

### Deploying Kubernetes Services

1. Update manifests in `infrastructure/kubernetes/<component>/`
2. Apply changes: `kubectl apply -f infrastructure/kubernetes/<component>/`
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

- **API Gateway**: https://api.rns.ringer.tel (HTTP works, HTTPS needs cert-manager)
- **Admin Portal**: https://admin.rns.ringer.tel
- **Customer Portal**: https://customer.rns.ringer.tel
- **Grafana**: https://grafana.ringer.tel (admin/prom-operator)
- **Prometheus**: https://prometheus.ringer.tel

**Note**: API Gateway LoadBalancer IP is `34.58.150.254`

## Important Notes

- **SSL Certificates**: All web services use Let's Encrypt via cert-manager
- **Secrets**: Stored in Google Secret Manager, not in code
- **Multi-Region**: Currently single-region (us-central1), expansion planned
- **Billing Integration**: NetSuite connector planned for Phase 3
- **SMS Gateway**: Jasmin SMSC deployment is next priority after RTPEngine

## API Gateway (New - Oct 2025)

**Location:** `services/api-gateway/`
**Stack:** Go 1.23, Gin framework, PostgreSQL (pgx), Jasmin jCli client
**Namespace:** `warp-api`

### Running Locally
```bash
cd services/api-gateway
make build
make run
```

### API Endpoints
```
POST   /api/v1/admin/smpp-vendors        # Create SMPP vendor
GET    /api/v1/admin/smpp-vendors        # List vendors
POST   /api/v1/admin/smpp-vendors/:id/bind  # Start SMPP bind
GET    /api/v1/admin/smpp-vendors/:id/status # Get bind status
```

### Database
**Connection:** Cloud SQL (10.126.0.3:5432)
**Database:** `warp`
**Schema:** `vendor_mgmt`
**Table:** `service_providers`

**Query vendors:**
```sql
SELECT * FROM vendor_mgmt.service_providers WHERE provider_type='smpp';
```

### Deployment
```bash
cd services/api-gateway
make docker-push
make deploy-k8s
kubectl logs -n warp-api -l app=api-gateway
```

## Jasmin SMSC (Updated Oct 2025)

**Namespace:** `messaging`
**Image:** `jookies/jasmin:0.10.12`
**Replicas:** 1 (due to ReadWriteOnce PVC)

### jCli Access
**Port:** 8990 (accessible from cluster)
**Config Fix:** Use `bind = 0.0.0.0` NOT `bind_host = 0.0.0.0`
**Password:** Hex-encoded in config

### Storage Architecture
- **PersistentVolume:** `/etc/jasmin/store/` (connector configs)
- **Redis (db 1):** DLR tracking, message queues
- **PostgreSQL:** API vendor management, audit

### Critical jCli Commands
```bash
# After creating connector via API, manually persist:
kubectl exec -n messaging <jasmin-pod> -- python << 'EOF'
import telnetlib
import time

tn = telnetlib.Telnet('localhost', 8990, timeout=5)
time.sleep(0.5)
tn.read_until(b':', timeout=2)

tn.write(b'persist\n')  # ← CRITICAL: Saves to disk
time.sleep(2)

tn.write(b'smppccm -l\n')  # List connectors
time.sleep(1)
print(tn.read_very_eager().decode())

tn.write(b'quit\n')
tn.close()
