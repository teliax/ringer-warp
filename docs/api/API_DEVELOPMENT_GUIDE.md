# WARP API Development Guide
## Go-Based Backend Services

**Date**: October 2025
**Status**: Active Development

---

## Technology Stack

### Primary Language: Go 1.21+

**Rationale**:
- Performance requirements (API latency < 200ms p99, 10k+ req/s)
- High concurrency needs (telecom platform)
- Operational simplicity (single binary deployment)
- Strong typing for billing/routing accuracy

### Core Dependencies

```go
// HTTP Framework
github.com/gin-gonic/gin v1.9+

// Database
github.com/jackc/pgx/v5        // PostgreSQL (faster than lib/pq)
github.com/redis/go-redis/v9   // Redis client

// Validation & API Docs
github.com/go-playground/validator/v10
github.com/swaggo/gin-swagger
github.com/swaggo/swag

// Observability
github.com/prometheus/client_golang
go.uber.org/zap                 // Structured logging
go.opentelemetry.io/otel        // Distributed tracing

// Configuration
github.com/spf13/viper

// Testing
github.com/stretchr/testify

// Message Queue
github.com/streadway/amqp       // RabbitMQ for Jasmin integration
```

---

## Project Structure (Go Standard Layout)

```
warp-api/
├── cmd/
│   ├── api-server/             # Main API server entry point
│   │   └── main.go
│   ├── worker/                 # Background job processor
│   │   └── main.go
│   └── migrate/                # Database migrations runner
│       └── main.go
│
├── internal/                   # Private application code
│   ├── handlers/               # HTTP handlers (controllers)
│   │   ├── trunks.go
│   │   ├── numbers.go
│   │   ├── routing.go
│   │   ├── messages.go
│   │   └── vendors.go
│   │
│   ├── services/               # Business logic layer
│   │   ├── trunk_service.go
│   │   ├── routing_service.go
│   │   ├── billing_service.go
│   │   └── vendor_service.go
│   │
│   ├── repository/             # Data access layer
│   │   ├── trunk_repo.go
│   │   ├── customer_repo.go
│   │   └── vendor_repo.go
│   │
│   ├── models/                 # Domain models
│   │   ├── trunk.go
│   │   ├── customer.go
│   │   ├── vendor.go
│   │   └── message.go
│   │
│   ├── middleware/             # HTTP middleware
│   │   ├── auth.go
│   │   ├── logging.go
│   │   ├── cors.go
│   │   └── rate_limit.go
│   │
│   ├── clients/                # External service clients
│   │   ├── jasmin/             # Jasmin jCli/HTTP integration
│   │   ├── telique/            # LRN/LERG API
│   │   ├── tcr/                # 10DLC campaign registry
│   │   └── netsuite/           # Billing integration
│   │
│   └── config/                 # Configuration structs
│       └── config.go
│
├── pkg/                        # Public libraries (reusable across services)
│   ├── errors/
│   ├── response/
│   └── validator/
│
├── api/                        # OpenAPI specifications
│   └── openapi.yaml
│
├── migrations/                 # Database migrations (SQL)
│   ├── 001_initial_schema.up.sql
│   ├── 001_initial_schema.down.sql
│   └── ...
│
├── deployments/
│   └── kubernetes/             # K8s manifests for API
│       ├── deployment.yaml
│       ├── service.yaml
│       └── configmap.yaml
│
├── scripts/
│   └── generate-swagger.sh    # API doc generation
│
├── go.mod
├── go.sum
├── Dockerfile
├── .env.example
└── README.md
```

---

## API Service Architecture

### Layered Architecture

```
┌─────────────────────────────────────┐
│         HTTP Handlers               │  ← Gin routes, request/response
│      (controllers layer)            │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│       Business Services             │  ← Business logic, orchestration
│    (service layer)                  │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│       Data Repository               │  ← Database queries, data access
│    (repository layer)               │
└─────────────────┬───────────────────┘
                  │
┌─────────────────▼───────────────────┐
│      PostgreSQL / Redis             │  ← Data stores
└─────────────────────────────────────┘
```

### Service Modules

Each service follows this pattern:

```go
// internal/handlers/vendors.go
type VendorHandler struct {
    vendorService services.VendorService
    logger       *zap.Logger
}

func (h *VendorHandler) CreateVendor(c *gin.Context) {
    // 1. Parse and validate request
    // 2. Call service layer
    // 3. Return response
}

// internal/services/vendor_service.go
type VendorService interface {
    CreateSMPPVendor(ctx context.Context, vendor *models.SMPPVendor) error
    UpdateJasminConnector(ctx context.Context, vendorID string) error
}

// Implements business logic + external integrations
```

---

## Key Implementation Patterns

### 1. Jasmin Integration (SMPP Vendor Management)

```go
// internal/clients/jasmin/client.go
type JasminClient struct {
    jcliHost string
    jcliPort int
    password string
}

// Connect to Jasmin jCli via telnet
func (c *JasminClient) CreateSMPPConnector(vendor *models.SMPPVendor) error {
    conn, err := net.Dial("tcp", fmt.Sprintf("%s:%d", c.jcliHost, c.jcliPort))
    // Send jCli commands
    // smppccm -a
    // cid <vendor.ID>
    // host <vendor.Host>
    // port <vendor.Port>
    // ssl <vendor.UseTLS>
    // ok
}
```

### 2. Redis Integration (RTPEngine Discovery)

```go
// Update RTPEngine instances in Redis for Kamailio
func (s *RTPEngineService) UpdateRedisRegistry(instances []RTPEngineInstance) error {
    for i, inst := range instances {
        key := fmt.Sprintf("rtpengine:entry::%d", i+1)
        s.redisClient.HSet(ctx, key, map[string]interface{}{
            "id":       i + 1,
            "setid":    0,
            "url":      fmt.Sprintf("udp:%s:22222", inst.IP),
            "weight":   inst.Weight,
            "disabled": 0,
        })
    }
}
```

### 3. Telique Integration (LRN/LERG Lookups)

```go
// internal/clients/telique/client.go
type TeliqueClient struct {
    apiKey  string
    baseURL string
}

func (c *TeliqueClient) LookupLRN(phoneNumber string) (*LRNResult, error) {
    // HTTP API call to Telique
    // Cache result in Redis (1 hour TTL)
}
```

### 4. TCR Integration (10DLC Campaign Management)

```go
// internal/clients/tcr/client.go
type TCRClient struct {
    apiKey string
}

func (c *TCRClient) RegisterCampaign(campaign *Campaign) (*TCRCampaign, error) {
    // POST to TCR API
    // Store campaign ID in PostgreSQL
}
```

---

## API Endpoints to Implement

### Phase 1: Vendor Management (Priority 1)
```
POST   /api/v1/admin/smpp-vendors          # Create SMPP vendor (Sinch)
GET    /api/v1/admin/smpp-vendors          # List all vendors
PUT    /api/v1/admin/smpp-vendors/:id      # Update vendor
DELETE /api/v1/admin/smpp-vendors/:id      # Delete vendor
POST   /api/v1/admin/smpp-vendors/:id/bind # Start SMPP bind in Jasmin
GET    /api/v1/admin/smpp-vendors/:id/status # Check bind status
```

**Implementation**: Updates PostgreSQL `service_providers` table → Calls Jasmin jCli to create connector

### Phase 2: Campaign Management (10DLC)
```
POST /api/v1/admin/campaigns               # Register with TCR
GET  /api/v1/admin/campaigns               # List campaigns
POST /api/v1/admin/campaigns/:id/numbers  # Assign phone numbers
```

### Phase 3: Message Sending
```
POST /api/v1/messages/sms                  # Send SMS via Jasmin
GET  /api/v1/messages/:id                  # Get message status
POST /api/v1/messages/bulk                 # Bulk sending
```

### Phase 4: Trunk & Number Management
```
POST /api/v1/trunks                        # Create SIP trunk
GET  /api/v1/numbers                       # List DIDs
POST /api/v1/routing/test                  # Test routing decision
```

---

## Development Workflow

### 1. Initialize Project
```bash
mkdir -p warp-api
cd warp-api
go mod init github.com/ringer-warp/warp-api

# Install dependencies
go get github.com/gin-gonic/gin
go get github.com/jackc/pgx/v5
go get github.com/redis/go-redis/v9
go get github.com/swaggo/gin-swagger
go get go.uber.org/zap
```

### 2. Generate Swagger Docs
```bash
# Install swag
go install github.com/swaggo/swag/cmd/swag@latest

# Generate docs from code comments
swag init -g cmd/api-server/main.go -o api/swagger
```

### 3. Run Locally
```bash
# With hot reload (using air)
go install github.com/cosmtrek/air@latest
air

# Or standard
go run cmd/api-server/main.go
```

### 4. Build Container
```bash
# Multi-stage Dockerfile
docker build -t us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest .

# Push to GCP Artifact Registry
docker push us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest
```

---

## Integration Points

### Jasmin SMSC Integration

**jCli Protocol** (Telnet):
- Host: `jasmin-http-service.messaging.svc.cluster.local`
- Port: 8990
- Auth: Password-based

**HTTP API** (If available):
- Host: `jasmin-http-service.messaging.svc.cluster.local`
- Port: 8080
- Auth: Basic or token

### Redis Integration

**Connection**:
- Host: `redis-service.messaging.svc.cluster.local`
- Port: 6379
- Database: 0

**Tables Used**:
- `rtpengine:entry::*` - RTPEngine instance registry
- `location:*` - Kamailio user registrations (read-only)
- `dialog:*` - Active call state (read-only)

### PostgreSQL Integration

**Connection**:
- Host: Cloud SQL private IP (via Cloud SQL Proxy sidecar)
- Database: `warp`
- User: Service account with IAM authentication

**Schemas**:
- `accounts` - Customer accounts
- `routing` - LCR configuration
- `billing` - Rate tables, invoices
- `messaging` - SMS campaigns, DLRs
- `vendor_mgmt` - Service provider configurations

---

## Security Considerations

### Authentication Flow
```go
// JWT validation middleware
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        // Validate JWT
        // Check permissions
        // Set user context
    }
}
```

### Rate Limiting
```go
// Redis-based rate limiting
func RateLimitMiddleware(rdb *redis.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        key := fmt.Sprintf("ratelimit:%s", c.ClientIP())
        count, _ := rdb.Incr(ctx, key).Result()
        if count == 1 {
            rdb.Expire(ctx, key, time.Minute)
        }
        if count > 100 {
            c.JSON(429, gin.H{"error": "Rate limit exceeded"})
            c.Abort()
            return
        }
    }
}
```

---

## Next Steps

1. **Create project scaffold**: `warp-api/` directory with Go standard layout
2. **Implement Phase 1**: Vendor management API + Jasmin integration
3. **Add to Terraform**: Kubernetes deployment manifests
4. **Deploy to GKE**: warp-api namespace
5. **Connect Admin UI**: Update frontend to call new API endpoints

---

## Why Go Over Node.js/Java

**vs Node.js**:
- ✅ 3-5x better performance
- ✅ Better concurrency (goroutines vs event loop)
- ✅ Smaller containers (20MB vs 150MB)
- ❌ Slightly steeper learning curve (but gentle)

**vs Java**:
- ✅ 10x faster startup (critical for Kubernetes)
- ✅ 20x smaller memory footprint
- ✅ Much simpler deployment (no JVM tuning)
- ✅ Better for microservices

**Node.js Still Used For**:
- Admin scripts and utilities
- Testing and development tools
- Frontend (React/Vite)

---

**Decision**: Go 1.21+ with Gin framework
**Approved**: October 2025
**First Service**: Vendor Management API
