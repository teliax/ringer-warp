# WARP Platform - Current Status

## 🎯 Project Information

- **GCP Project**: `ringer-warp-v01` (Production)
- **Environment**: Production
- **Last Updated**: 2025-10-09
- **Phase 1**: ✅ **100% COMPLETE** (Infrastructure)
- **Phase 2**: ✅ **100% COMPLETE** (Core Applications)
- **Phase 3**: 🚧 **IN PROGRESS** (API Development)

## ✅ Infrastructure Status (Phase 1 Complete)

### Google Cloud Platform
- **VPC Network**: `warp-vpc` (10.0.0.0/8)
  - warp-gke-subnet: 10.0.0.0/24 (pods: 10.1.0.0/16, services: 10.2.0.0/16)
  - warp-rtpengine-subnet: 10.0.1.0/24 ✅
  - warp-consul-subnet: 10.0.2.0/24
- **GKE Cluster**: `warp-kamailio-cluster` (GKE Autopilot, us-central1)
- **Cloud SQL**: `warp-db` (PostgreSQL 15, Private IP: 10.126.0.3)
- **Redis**: Running in Kubernetes (redis-service.messaging:6379)
- **Artifact Registry**: `warp-platform` (Go binaries, Docker images)

### Compute Instances (Terraform-Managed)
- **Consul Servers**: 3 instances running
- **RTPEngine VMs**: 3 instances on **10.0.1.0/24** subnet ✅
  - warp-rtpengine-1: 10.0.1.13 (ext: 34.123.38.31)
  - warp-rtpengine-2: 10.0.1.12 (ext: 35.222.101.214)
  - warp-rtpengine-3: 10.0.1.11 (ext: 35.225.65.80)
  - **Discovery**: Dynamic via Redis (load balanced)

## 🚀 Applications (Phase 2 Complete)

### Core Services - All Operational

**Kamailio** (warp-core namespace):
- 3 pods running
- **State Backend**: Redis (NOT PostgreSQL) ✅
  - usrloc: db_mode=3 (shared registrations)
  - dialog: db_mode=1 (persistent call state)
- **RTPEngine Discovery**: Dynamic via Redis
- Image: kamailio:v1.3-redis

**RTPEngine Cluster**:
- 3 VMs on correct subnet (10.0.1.0/24)
- Golden image: rtpengine-golden-v1
- Deployed via Terraform ✅
- All 3 instances enabled and responding
- Health checks passing

**Jasmin SMSC** (messaging namespace):
- 1 pod running (PersistentVolume = single replica)
- SMPP External IP: 34.55.43.157:2775/2776
- jCli: Accessible on 0.0.0.0:8990 ✅
- Redis: DLR tracking, queues
- RabbitMQ: Message routing
- **Storage**: PersistentVolume for config files

**API Gateway** (warp-api namespace):
- 2 pods running (Go 1.23 + Gin framework)
- PostgreSQL: Connected ✅
- Jasmin jCli: Integrated ✅
- Endpoints: Vendor management operational
- Image: api-gateway:latest

### Monitoring Stack (All Deployed)
- **Prometheus**: http://34.28.246.74:9090
- **Grafana**: http://35.224.100.108:3000 (admin/prom-operator)
- **AlertManager**: http://34.28.140.133:9093
- **Loki**: Log aggregation configured

### Network Services
- **HOMER SIP Capture**: LoadBalancer IP: 35.223.187.94
- **Consul UI**: Accessible via port-forward

## ✅ SSL/TLS Infrastructure (Production - Deployed 2025-09-23)

### Cert-Manager Deployment
- **cert-manager**: v1.16.2 deployed with Gandi webhook
- **ClusterIssuers**: Production Let's Encrypt configured
- **Gandi DNS**: Webhook authenticated and operational
- **NGINX Ingress**: Handling all HTTP/HTTPS traffic

### Production SSL Certificates
- **api-v2.ringer.tel**: ✅ Production certificate active
- **grafana.ringer.tel**: ✅ Production certificate active  
- **prometheus.ringer.tel**: ✅ Production certificate active
- **api.warp.io**: ⏳ Pending (DNS propagation)
- **Wildcard *.ringer.tel**: ❌ Not required (using individual certs)

### Ingress Controller
- **NGINX Ingress**: LoadBalancer IP: 34.72.20.183
- **Status**: ✅ Handling all HTTP → HTTPS redirects
- **Services**: All monitoring services accessible via HTTPS

## 🌐 DNS Configuration (Completed 2025-09-23)

### Domains Configured
- **ringer.tel**: Production domain
- **warp.io**: Platform domain
- **ringer-warp.com**: Corporate domain

### DNS Records Created
All services now have proper DNS records pointing to their LoadBalancer IPs:
- A records for service endpoints
- CNAME records for subdomains
- TXT records for verification
- MX records for email services

## ✅ Phase 1 Achievements (Completed 2025-09-23)

1. **Infrastructure**: All GCP resources deployed and operational
2. **Kubernetes**: GKE cluster with all core services running
3. **Monitoring**: Full stack deployed with Prometheus, Grafana, Loki
4. **SSL/TLS**: Production certificates issued and HTTPS enabled
5. **DNS**: All domains configured with proper records
6. **Networking**: NGINX Ingress handling all HTTP/HTTPS traffic
7. **Database**: PostgreSQL initialized with schemas
8. **Security**: Cert-manager with Gandi DNS automation

## 🚧 Phase 3 - API Development (In Progress)

### Completed (Oct 2025)
- ✅ Go API Gateway scaffolding
- ✅ Vendor management endpoints
- ✅ Jasmin jCli telnet client
- ✅ PostgreSQL integration (pgx driver)
- ✅ Database schema: vendor_mgmt.service_providers
- ✅ Deployed to Kubernetes (warp-api namespace)

### Current Work
- 🔧 jCli persist mechanism (saving connectors to PersistentVolume)
- 🔧 Sinch SMPP connector configuration
- 🔧 Testing connector persistence across pod restarts

### Next Priority
1. Complete Sinch SMPP binds (msgbrokersmpp-chi/atl.inteliquent.com:3601)
2. Register 10DLC campaign with TCR
3. Send first SMS via API
4. Connect Admin UI to API endpoints

### Infrastructure Cleanup
1. **LoadBalancer Consolidation**
   - Migrate monitoring services to use Ingress only
   - Remove unnecessary LoadBalancer services
   - Keep only Kamailio LoadBalancers

2. **Old Project Deletion**
   - Backup any remaining data from ringer-472421
   - Delete all resources in old project
   - Close GCP project

## 📊 Production Service Endpoints

### HTTPS Services (via NGINX Ingress)
| Service | URL | Status | Certificate |
|---------|-----|--------|-------------|
| API v2 | https://api-v2.ringer.tel | ✅ Active | Production |
| Grafana | https://grafana.ringer.tel | ✅ Active | Production |
| Prometheus | https://prometheus.ringer.tel | ✅ Active | Production |

### LoadBalancer Services (Direct Access)
| Service | Type | IP Address | Port | Purpose |
|---------|------|------------|------|---------|
| Kamailio SIP TCP | LoadBalancer | 34.72.244.248 | 5060/5061 | SIP Signaling |
| Kamailio SIP UDP | LoadBalancer | 35.188.57.164 | 5060 | SIP Signaling |
| NGINX Ingress | LoadBalancer | 34.72.20.183 | 80/443 | HTTP/HTTPS Traffic |

### Deprecated LoadBalancers (To Be Removed)
| Service | IP Address | Reason |
|---------|------------|--------|
| Monitoring Services | Various | Migrated to Ingress/ClusterIP |
| Old API Gateway | 34.41.135.92 | Replaced by Ingress |

## 🔑 Access Information

- **GKE Cluster**: `gcloud container clusters get-credentials warp-kamailio-cluster --zone us-central1 --project ringer-warp-v01`
- **Database**: Use Cloud SQL Proxy or private IP from within VPC
- **Redis**: Accessible from within VPC at 10.206.200.36:6379

## 📝 Critical Information

**Repository Structure:**
```
services/          Go backend services
apps/              React/Vite frontends
infrastructure/    Terraform + Kubernetes + Docker
docs/              Documentation
```

**Namespaces:**
- `warp-core`: Kamailio
- `messaging`: Jasmin, Redis, RabbitMQ
- `warp-api`: API Gateway
- `monitoring`: Prometheus, Grafana
- `homer`: SIP capture

**Database (Cloud SQL - 10.126.0.3:5432):**
```sql
Database: warp
Schema: vendor_mgmt
Table: service_providers
Query: SELECT * FROM vendor_mgmt.service_providers;
```

**Redis:**
- Kamailio state: redis-service.messaging:6379 (db 0)
- Jasmin DLR/queues: redis-service.messaging:6379 (db 1)

**Jasmin jCli:**
- Access: jasmin-http-service.messaging:8990
- Config: bind=0.0.0.0, port=8990 (NOT bind_host/bind_port)
- Persist: Run `persist` command to save to disk
- Storage: PersistentVolume at /etc/jasmin/store/

**Tools:**
- Terraform: ~/.local/bin/terraform (v1.9.5)
- Go: ~/.local/go/bin/go (v1.23.0)

**Key Fixes Applied:**
- Kamailio migrated from PostgreSQL → Redis
- RTPEngine subnet fixed via Terraform (10.128.0.x → 10.0.1.0/24)
- jCli config syntax corrected
- Old namespaces cleaned up