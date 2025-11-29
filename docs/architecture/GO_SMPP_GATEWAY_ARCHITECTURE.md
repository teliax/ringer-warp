# Go SMPP Gateway Architecture

**Version:** 1.1
**Date:** November 25, 2025
**Service:** `smpp-gateway`
**Status:** ✅ Production - Connected to Sinch

---

## Overview

Custom Go-based SMPP gateway providing bi-directional SMS routing for WARP Platform. Replaces Jasmin SMSC with cloud-native, API-driven architecture fully integrated with PostgreSQL, Redis, and RabbitMQ.

### Current Production Status

| Component | Status | Details |
|-----------|--------|---------|
| **SMPP Gateway Pod** | ✅ Running | `messaging` namespace, 1/1 replicas |
| **Sinch_Atlanta** | ✅ Connected | msgbrokersmpp-atl.inteliquent.com:3601 |
| **Cloud NAT Egress** | ✅ Working | 34.58.165.135 (Sinch whitelisted) |
| **LoadBalancer** | ✅ Active | 34.55.43.157:2775,2776 |
| **Management API** | ✅ Available | smpp-gateway-api:8080 |

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SMPP Client                              │
│              (Customer's SMPP Application)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ SMPP 3.4
                      │ Port 2775 (LoadBalancer)
                      ↓
┌─────────────────────────────────────────────────────────────┐
│              Go SMPP Gateway (Multi-Pod)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SMPP Server (Inbound from Clients)                  │  │
│  │  - Authentication, session management                │  │
│  │  - submit_sm → RabbitMQ queue                        │  │
│  │  - deliver_sm → Client connections                   │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Message Processor (Worker Goroutines)               │  │
│  │  - Route selection (PostgreSQL)                      │  │
│  │  - 10DLC validation                                  │  │
│  │  - Rate limiting (Redis)                             │  │
│  │  - Billing calculation                               │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SMPP Clients (Outbound to Vendors)                  │  │
│  │  - Connection pool to Sinch Chicago/Atlanta          │  │
│  │  - Auto-reconnect, health checks                     │  │
│  │  - DLR receipt handling                              │  │
│  └──────────────────────────────────────────────────────┘  │
└────┬──────────┬────────────┬──────────────┬───────────────┘
     │          │            │              │
     ↓          ↓            ↓              ↓
┌─────────┐ ┌────────┐ ┌──────────┐ ┌─────────────┐
│PostgreSQL│ │ Redis  │ │ RabbitMQ │ │ Prometheus  │
│ Vendors │ │  DLRs  │ │ Messages │ │   Metrics   │
│ Routing │ │  Rate  │ │  Queue   │ │             │
└─────────┘ └────────┘ └──────────┘ └─────────────┘
                               │
                               ↓
                      ┌─────────────────┐
                      │  Sinch SMPP     │
                      │  Chicago/Atlanta│
                      └─────────────────┘
```

## Component Design

### 1. SMPP Server (Inbound)

**Purpose:** Accept SMPP connections from customer applications

**Implementation:**
```go
// Location: services/smpp-gateway/internal/server/server.go

type SMPPServer struct {
    listener     net.Listener
    sessions     map[string]*SMPPSession
    authService  *AuthService
    msgQueue     *rabbitmq.Client
    config       *Config
}

// Listen on ports 2775 (plain) and 2776 (TLS)
func (s *SMPPServer) Start() error
func (s *SMPPServer) HandleBind(session *SMPPSession, pdu *smpp.BindTransceiver) error
func (s *SMPPServer) HandleSubmitSM(session *SMPPSession, pdu *smpp.SubmitSM) error
func (s *SMPPServer) HandleDeliverSM(session *SMPPSession, pdu *smpp.DeliverSM) error
```

**Features:**
- Multiple concurrent client sessions
- Authentication against PostgreSQL users table
- Session pooling and cleanup
- Metrics per session (throughput, error rate)

### 2. Vendor Connector Manager

**Purpose:** Manage SMPP connections to upstream carriers (Sinch, etc.)

**Implementation:**
```go
// Location: services/smpp-gateway/internal/connectors/manager.go

type ConnectorManager struct {
    connectors map[string]*SMPPClient  // keyed by vendor ID
    db         *pgx.Pool
    redis      *redis.Client
    mu         sync.RWMutex
}

func (cm *ConnectorManager) LoadVendorsFromDB() error
func (cm *ConnectorManager) CreateConnector(vendor *models.Vendor) (*SMPPClient, error)
func (cm *ConnectorManager) GetConnector(vendorID string) (*SMPPClient, error)
func (cm *ConnectorManager) StartAll() error
func (cm *ConnectorManager) HealthCheck() map[string]ConnectorHealth
```

**Features:**
- Auto-load vendors from PostgreSQL on startup
- Connection pooling (multiple binds per vendor)
- Automatic reconnection with exponential backoff
- Health monitoring and alerting

### 3. SMPP Client (Outbound)

**Purpose:** Maintain SMPP connections to upstream vendors

**Implementation:**
```go
// Location: services/smpp-gateway/internal/connectors/client.go

type SMPPClient struct {
    vendor      *models.Vendor
    transceiver *gosmpp.Transceiver
    sendQueue   chan *Message
    dlrHandler  *DLRHandler
    metrics     *ConnectorMetrics
}

func (c *SMPPClient) Connect() error
func (c *SMPPClient) Send(msg *Message) error
func (c *SMPPClient) HandleDLR(pdu *smpp.DeliverSM) error
func (c *SMPPClient) Reconnect() error
```

**Features:**
- Persistent connections with keep-alive
- Automatic bind (transceiver mode)
- Queue-based sending (buffered channel)
- Throughput limiting per vendor

### 4. Message Router

**Purpose:** Route messages to appropriate upstream vendor

**Implementation:**
```go
// Location: services/smpp-gateway/internal/routing/router.go

type Router struct {
    db           *pgx.Pool
    connectorMgr *ConnectorManager
    cache        *RoutingCache
}

func (r *Router) RouteMessage(msg *Message) (*SMPPClient, error)
func (r *Router) SelectVendor(source, dest string) (*models.Vendor, error)
func (r *Router) GetFailoverVendor(primaryID string) (*models.Vendor, error)
```

**Routing Logic:**
- Check destination country code
- Check source number type (10DLC, shortcode, intl)
- Query PostgreSQL routing rules
- Select vendor by priority
- Failover to backup vendor on error

### 5. DLR Tracker

**Purpose:** Track delivery receipts and update message status

**Implementation:**
```go
// Location: services/smpp-gateway/internal/dlr/tracker.go

type DLRTracker struct {
    redis  *redis.Client
    bigquery *bigquery.Client
}

func (d *DLRTracker) Store(msgID, vendorID string, msg *Message) error
func (d *DLRTracker) HandleDLR(dlr *DeliveryReceipt) error
func (d *DLRTracker) GetStatus(msgID string) (*MessageStatus, error)
```

**Storage:**
- Redis key: `dlr:msg:{message_id}` (TTL: 7 days)
- Value: JSON with status, timestamps, vendor_id
- On DLR receipt: Update Redis + write to BigQuery CDR table

### 6. Rate Limiter

**Purpose:** Enforce throughput limits per vendor and per customer

**Implementation:**
```go
// Location: services/smpp-gateway/internal/ratelimit/limiter.go

type RateLimiter struct {
    redis *redis.Client
}

func (rl *RateLimiter) CheckVendorLimit(vendorID string, count int) (bool, error)
func (rl *RateLimiter) CheckCustomerLimit(customerID string, count int) (bool, error)
func (rl *RateLimiter) Increment(key string, window time.Duration) (int, error)
```

**Strategy:**
- Redis sliding window counters
- Keys: `rate:vendor:{id}:{hour}`, `rate:customer:{id}:{minute}`
- Vendor limits from PostgreSQL vendor configs
- Customer limits from PostgreSQL customer accounts

## Data Models

### Message Structure
```go
type Message struct {
    ID              string    // UUID
    SourceAddr      string    // E.164 format
    DestAddr        string    // E.164 format
    Content         string
    Encoding        string    // "gsm7" or "ucs2"
    CustomerID      string
    VendorID        string
    Status          string    // "pending", "sent", "delivered", "failed"
    DLRStatus       string
    Segments        int
    Cost            float64
    SubmittedAt     time.Time
    DeliveredAt     *time.Time
    FailureReason   string
}
```

### Vendor Model (PostgreSQL)
```go
type Vendor struct {
    ID           string // UUID (already in DB)
    InstanceName string
    DisplayName  string
    Host         string
    Port         int
    UseTLS       bool
    BindType     string // "transceiver", "transmitter", "receiver"
    Throughput   int    // msgs/sec limit
    Priority     int
    IsPrimary    bool
    IsActive     bool
    Status       string // "connected", "disconnected", "error"
}
```

## Integration Points

### PostgreSQL
- **Tables:**
  - `vendor_mgmt.service_providers` (vendors) - ✅ Exists
  - `customer_mgmt.accounts` (customers) - Future
  - `routing.rules` (routing logic) - Future

- **Queries:**
  - Load active vendors on startup
  - Query routing rules for message
  - Log billing records

### Redis
- **Databases:**
  - DB 0: DLR tracking (`dlr:msg:{id}`)
  - DB 1: Rate limiting (`rate:vendor:{id}:{window}`)
  - DB 2: 10DLC campaign data (`10dlc:campaign:{source}`)

- **Operations:**
  - SET/GET for DLR lookups
  - INCR for rate limiting
  - EXPIRE for TTLs

### RabbitMQ
- **Exchanges:**
  - `smpp.direct` - Direct routing for MT messages
  - `smpp.dlr` - DLR delivery back to clients

- **Queues:**
  - `mt.messages.{priority}` - Outbound messages by priority
  - `mo.messages` - Inbound messages from vendors
  - `dlr.receipts` - Delivery receipts

## Deployment Architecture

### Kubernetes Resources
```yaml
# Namespace: messaging
- Deployment: smpp-gateway (3 replicas)
- Service: smpp-gateway-server (LoadBalancer, port 2775/2776)
- Service: smpp-gateway-api (ClusterIP, port 8080) # Management API
- ConfigMap: smpp-gateway-config
- Secret: smpp-gateway-secrets
- ServiceMonitor: smpp-gateway-metrics (Prometheus)
```

### Pod Configuration
```yaml
Resources:
  requests:
    memory: 512Mi
    cpu: 500m
  limits:
    memory: 2Gi
    cpu: 2000m

Environment:
  - POSTGRES_HOST
  - REDIS_HOST
  - RABBITMQ_HOST
  - SMPP_SERVER_PORT=2775
  - SMPP_TLS_PORT=2776
  - METRICS_PORT=9090
```

### Storage
- **No PVC needed** - all state in PostgreSQL + Redis
- **Logs**: stdout/stderr → Cloud Logging
- **Metrics**: Prometheus scraping on :9090/metrics

## API Endpoints (Management)

### HTTP API on port 8080
```
GET    /health                           - Health check
GET    /metrics                          - Prometheus metrics
GET    /api/v1/vendors                   - List vendors
POST   /api/v1/vendors/:id/reconnect     - Force reconnect
GET    /api/v1/vendors/:id/status        - Get vendor status
GET    /api/v1/messages/:id              - Get message status
GET    /api/v1/messages/:id/dlr          - Get DLR details
POST   /api/v1/admin/reload-vendors      - Reload from PostgreSQL
```

## Metrics

### Prometheus Metrics
```
smpp_server_active_sessions_total
smpp_server_bind_requests_total{status="success|failure"}
smpp_server_submit_sm_total{customer_id}
smpp_server_deliver_sm_total{vendor_id}

smpp_client_connections_total{vendor_id, status="connected|disconnected"}
smpp_client_submit_sm_total{vendor_id, status="success|failure"}
smpp_client_dlr_received_total{vendor_id, dlr_status}
smpp_client_throughput_current{vendor_id}

message_routing_duration_seconds{route}
message_queue_depth{priority}
dlr_tracking_hits_total
rate_limit_exceeded_total{type="vendor|customer"}
```

## Error Handling

### SMPP Error Codes
- `ESME_ROK` (0x00000000) - Success
- `ESME_RTHROTTLED` (0x00000058) - Throttled (rate limit)
- `ESME_RSUBMITFAIL` (0x00000400) - Submit failed
- `ESME_RUNKNOWNERR` (0x000000FF) - Unknown error

### Retry Strategy
1. **Vendor Connection Failures:**
   - Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
   - Alert after 5 consecutive failures

2. **Message Submission Failures:**
   - Retry 3 times with 500ms delay
   - Failover to backup vendor after 3 failures
   - Mark as failed after all vendors exhausted

3. **DLR Processing:**
   - No retries (DLRs are best-effort)
   - Log missing message IDs for debugging

## Security

### Authentication
- Customer SMPP binds authenticated against PostgreSQL
- IP whitelisting (optional, per customer)
- System ID + password validation

### TLS/SSL
- Port 2776 for TLS connections
- Let's Encrypt certificates via cert-manager
- SNI support for multiple domains

### Secrets Management
- Vendor credentials stored in PostgreSQL (encrypted at rest)
- Kubernetes secrets for service account keys
- No secrets in ConfigMaps

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Throughput | 5,000 msgs/sec | Per pod, 15K total with 3 pods |
| Latency (P95) | < 50ms | Submit_sm to vendor forward |
| DLR Delivery | < 100ms | Receipt to customer notification |
| Connection Recovery | < 5s | Vendor reconnect time |
| Memory per Pod | < 1GB | Under normal load |
| CPU per Pod | < 1 core | Under normal load |

## Logging

### Structured Logging (JSON)
```json
{
  "timestamp": "2025-10-09T21:00:00Z",
  "level": "INFO",
  "component": "smpp-server",
  "message": "Message submitted",
  "message_id": "uuid",
  "customer_id": "cust-123",
  "vendor_id": "vendor-456",
  "source": "15551234567",
  "dest": "15559876543",
  "segments": 1,
  "latency_ms": 23
}
```

### Log Levels
- **DEBUG**: Protocol-level details, PDU dumps
- **INFO**: Message flow, connections, normal operations
- **WARN**: Throttling, retries, degraded service
- **ERROR**: Connection failures, submission errors
- **FATAL**: Startup failures, unrecoverable errors

## Migration Strategy

### Phase 1: Development (Week 1) ✅ COMPLETE
- [x] Scaffold project structure
- [x] Implement SMPP server (bind, unbind, submit_sm)
- [x] Implement SMPP client (connect to Sinch)
- [x] Basic routing (hardcoded Sinch Chicago)

### Phase 2: Integration (Week 2) ✅ COMPLETE
- [x] PostgreSQL vendor management
- [x] Redis DLR tracking
- [x] RabbitMQ message queuing
- [x] Management API endpoints

### Phase 3: Advanced Features (Week 3) ✅ COMPLETE
- [x] 10DLC validation
- [x] Rate limiting
- [x] Message segmentation
- [x] Billing integration
- [x] Prometheus metrics

### Phase 4: Production Deployment (Week 4) ✅ COMPLETE
- [x] Kubernetes manifests
- [x] CI/CD pipeline
- [x] Load testing (10K msgs/sec)
- [x] Deploy to production
- [x] Cutover from Jasmin
- [x] Remove Jasmin artifacts

### Phase 5: Cloud NAT Resolution (November 2025) ✅ COMPLETE
- [x] Identified Cloud NAT misconfiguration blocking Sinch connectivity
- [x] Fixed `source_ip_ranges_to_nat` from `LIST_OF_SECONDARY_IP_RANGES` to `ALL_IP_RANGES`
- [x] Verified egress IP is 34.58.165.135 (Sinch whitelisted)
- [x] Confirmed SMPP bind successful to Sinch_Atlanta

## Testing Strategy

### Unit Tests
- SMPP PDU encoding/decoding
- Message routing logic
- Rate limiting algorithms
- DLR tracking

### Integration Tests
- PostgreSQL vendor loading
- Redis DLR storage/retrieval
- RabbitMQ message queuing
- End-to-end message flow

### Load Tests
- 5,000 msgs/sec sustained (k6 or Locust)
- 1,000 concurrent SMPP sessions
- Vendor failover scenarios
- Pod restarts under load

## Operational Procedures

### Startup Sequence
1. Load configuration from environment
2. Connect to PostgreSQL
3. Connect to Redis
4. Connect to RabbitMQ
5. Load active vendors from PostgreSQL
6. Start SMPP client connections to vendors
7. Start SMPP server (listen on 2775/2776)
8. Start management API (listen on 8080)
9. Start metrics server (listen on 9090)
10. Signal readiness to Kubernetes

### Graceful Shutdown
1. Stop accepting new SMPP binds
2. Drain message queues (max 30s wait)
3. Close customer SMPP sessions gracefully
4. Unbind from vendor SMPP connections
5. Close database connections
6. Exit

### Vendor Lifecycle
- **Add Vendor:** API call → PostgreSQL → ConnectorManager.CreateConnector()
- **Update Vendor:** API call → PostgreSQL → Reconnect if config changed
- **Remove Vendor:** API call → Unbind → Mark inactive in PostgreSQL
- **Health Check:** Every 30s → Update PostgreSQL status field

## Comparison: Jasmin vs Go SMPP Gateway

| Feature | Jasmin | Go SMPP Gateway |
|---------|--------|-----------------|
| **Config Storage** | Pickle files | PostgreSQL |
| **Cloud Native** | ❌ No | ✅ Yes |
| **Multi-Pod** | ❌ Broken | ✅ Native |
| **API Management** | ❌ jCli only | ✅ REST API |
| **Auto-Reconnect** | ✅ Yes | ✅ Yes |
| **DLR Tracking** | Redis | Redis (same) |
| **Message Queue** | RabbitMQ | RabbitMQ (same) |
| **Metrics** | Basic | Prometheus |
| **Hot Reload** | ❌ Restart required | ✅ API-driven |
| **Maintenance** | Python 2/3 hybrid | Go 1.23+ |
| **Performance** | ~2K msgs/sec | ~5K msgs/sec (per pod) |

## Network Architecture

### Cloud NAT Configuration (Critical)

The SMPP Gateway requires outbound connectivity to Sinch through a whitelisted static IP. This is managed via GCP Cloud NAT.

```yaml
Cloud NAT Gateway: warp-nat-gke
Router: warp-router (us-central1)
Static IP: 34.58.165.135 (warp-nat-outbound-ip)
Subnets: warp-gke-subnet (ALL_IP_RANGES)
```

**Terraform Configuration** (`infrastructure/terraform/modules/networking/main.tf`):
```terraform
resource "google_compute_router_nat" "warp_nat_gke" {
  name                               = "warp-nat-gke"
  router                             = google_compute_router.warp_router.name
  nat_ip_allocate_option             = "MANUAL_ONLY"
  nat_ips                            = [data.google_compute_address.nat_outbound_ip.self_link]
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"
  enable_endpoint_independent_mapping = false

  subnetwork {
    name                    = google_compute_subnetwork.gke_subnet.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]  # CRITICAL: Includes both node and pod IPs
  }
}
```

### Key Lessons Learned

1. **Use `ALL_IP_RANGES`, not `LIST_OF_SECONDARY_IP_RANGES`**
   - GKE pod traffic originates from both node primary IPs and pod secondary IPs
   - Only `ALL_IP_RANGES` covers all traffic correctly

2. **`ENDPOINT_TYPE_GKE` Does NOT Exist**
   - Cloud NAT only supports `ENDPOINT_TYPE_VM`, `ENDPOINT_TYPE_SWG`, `ENDPOINT_TYPE_MANAGED_PROXY_LB`
   - Remove any `endpoint_types = ["ENDPOINT_TYPE_GKE"]` from Terraform

3. **Disable GKE Default SNAT**
   - Required for pods to use Cloud NAT: `defaultSnatStatus.disabled: true`
   - Verify with: `gcloud container clusters describe warp-cluster --format="value(networkConfig.defaultSnatStatus.disabled)"`

### Verification Commands

```bash
# Test egress IP from GKE pod
kubectl run ip-test --image=curlimages/curl --rm -it --restart=Never -- curl -s https://api.ipify.org
# Expected: 34.58.165.135

# Check SMPP Gateway vendor status
kubectl port-forward -n messaging svc/smpp-gateway-api 8080:8080 &
curl -s http://localhost:8080/api/v1/vendors | jq '.vendors[] | {vendor_name, status}'
# Expected: {"vendor_name": "Sinch_Atlanta", "status": "connected"}
```

---

## Related Documentation

- **[SMPP_NAT_TROUBLESHOOTING_HANDOFF.md](../../SMPP_NAT_TROUBLESHOOTING_HANDOFF.md)** - Complete troubleshooting history
- **[SMS_ARCHITECTURE.md](../warp-services/SMS_ARCHITECTURE.md)** - Overall SMS architecture
- **[ARCHITECTURAL_DECISION_GO_SMPP.md](ARCHITECTURAL_DECISION_GO_SMPP.md)** - Migration rationale

---

**Implementation Started:** October 9, 2025
**Production Deployment:** October 30, 2025
**Cloud NAT Fix:** November 25, 2025
**Current Status:** ✅ Fully Operational
**Owner:** WARP Platform Engineering Team
