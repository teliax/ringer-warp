# WARP Platform Architectural Decisions

## Date: January 2025

Based on PRD review and planning discussions, the following architectural decisions have been made:

## 1. Frontend Architecture

### Decision: Separate Applications
- **Customer Portal**: https://console.ringer.tel (`/frontend/`)
- **Admin Portal**: https://admin.ringer.tel (`/admin-frontend/`)
- **Rationale**: Complete isolation, different security requirements, independent deployment

## 2. Authentication Strategy

### Decision: Hybrid Authentication Architecture
- **Customer/Admin Portals**: Google Identity Platform (Firebase Auth)
  - OAuth2 flow for interactive login
  - JWT tokens with refresh mechanism
  - MFA, SSO, RBAC support
  - ~100-200ms latency acceptable for login flows
  
- **Voice/SMS APIs**: JWT with Redis caching
  - JWT validation with 1-hour cache
  - ~10-20ms latency for API calls
  - Supports up to 2,000 TPS
  
- **Telco Data APIs (LRN/LERG)**: Cloud Armor with API Keys
  - API key validation at edge using CEL expressions
  - ~1-5ms latency (critical for routing decisions)
  - Supports 5,000+ TPS
  - No Identity Platform overhead

- **Rationale**: Different authentication methods for different performance requirements. Interactive flows can tolerate Identity Platform latency, while high-TPS APIs need edge validation.

## 3. Service Communication

### Decision: REST APIs Only
- **Protocol**: RESTful HTTP/JSON
- **Documentation**: OpenAPI 3.0.3
- **Alternative Considered**: gRPC (not widely adopted by target developers)
- **Rationale**: Developer familiarity, tooling ecosystem, easier debugging

## 4. State Management & Databases

### Decision: Purpose-Specific Database Selection
- **Kamailio State**: Redis (required by Kamailio)
- **Customer Data**: HubSpot CRM (source of truth) + PostgreSQL cache
- **CDR/Analytics**: BigQuery (GCP native, petabyte scale)
- **Session/Cache**: Redis clusters
- **Note**: CockroachDB not needed - Cloud SQL provides regional replication

### CRM Strategy
- **HubSpot as Master**: All customer data originates in HubSpot
- **PostgreSQL as Cache**: Local copy for performance
- **Sync Pattern**: Near real-time via webhooks + periodic reconciliation

### GCP Services Stack:
- Cloud SQL for PostgreSQL (HA configuration)
- Memorystore for Redis
- BigQuery for analytics
- Cloud Storage for backups

## 5. Message Queue Architecture

### Decision: Context-Dependent Approach
- **CDR Streaming**: Pub/Sub → BigQuery (real-time ingestion)
- **SMS Queue (Jasmin)**: RabbitMQ (Jasmin requirement)
- **Billing Jobs**: Cloud Tasks (scheduled, retryable)
- **Event Bus**: Cloud Pub/Sub (webhooks, notifications)

## 6. Multi-Tenancy Strategy

### Decision: Row-Level Security with Partition Keys
- **Implementation**: All tables include `customer_id` column
- **Isolation**: PostgreSQL row-level security policies
- **Routing**: Partition-based routing per PRD
- **Future**: Option for dedicated instances for enterprise

## 7. Monitoring & Observability

### Decision: Prometheus-First Architecture
- **Metrics**: Comprehensive Prometheus exporters for everything
- **Storage**: GCP Managed Prometheus
- **Visualization**: Grafana dashboards
- **Real-time**: WebSocket for trunk status only
- **On-demand**: CDR queries via API

### Prometheus Exporters Required:
1. **Kamailio Exporter**: Active calls, CPS, registration count
2. **RTPEngine Exporter**: Media stats, codec usage, packet loss
3. **API Exporter**: Request rates, latencies, errors
4. **Business Metrics Exporter**: ASR, ACD, PDD, cost/margin
5. **Jasmin Exporter**: Message queue depth, delivery rates

## 8. Priority Build Order (MVP Strategy)

### Phase 1: Core Infrastructure (Week 1-2)
**Agent 1 Focus**
1. GCP project setup with Terraform
2. Cloud SQL PostgreSQL schemas
3. Redis clusters
4. Basic networking

### Phase 2: Authentication & API Gateway (Week 3-4)
**Agent 2 Focus**
1. Google Identity Platform integration
2. API Gateway with rate limiting
3. OpenAPI documentation
4. Basic customer CRUD

### Phase 3: SIP Platform Core (Week 5-6)
**Agent 1 & 2 Collaboration**
1. Kamailio deployment with LuaJIT FFI (high-performance routing)
2. RTPEngine cluster
3. Basic trunk provisioning
4. Simple routing (no LCR yet)

### Phase 4: CDR & Billing Foundation (Week 7-8)
**Agent 3 Focus**
1. CDR Pub/Sub → BigQuery pipeline
2. Prometheus exporters
3. Basic rating engine
4. Usage tracking

### Phase 5: Frontend MVP (Week 9-10)
**Agent 4 Focus**
1. Customer portal login
2. Dashboard with metrics
3. Trunk management UI
4. CDR viewing

### Phase 6: Advanced Routing (Week 11-12)
**Agent 2 Focus**
1. Partition-based routing
2. LCR implementation (See [LCR_ROUTING_ARCHITECTURE.md](LCR_ROUTING_ARCHITECTURE.md))
3. Telique integration
4. Route testing tools

### Phase 7: Messaging Platform (Week 13-14)
**Agent 3 Focus**
1. Jasmin SMSC deployment
2. Sinch SMPP binds
3. SMS/MMS API
4. Message delivery tracking

### Phase 8: Admin Portal (Week 15-16)
**Agent 4 Focus**
1. Admin frontend at admin.ringer.tel
2. Customer management
3. System monitoring dashboards
4. Rate management tools

## 9. API Development Standards

### REST API Conventions
```
GET    /api/v1/resources          # List
POST   /api/v1/resources          # Create
GET    /api/v1/resources/{id}     # Read
PUT    /api/v1/resources/{id}     # Update
DELETE /api/v1/resources/{id}     # Delete
```

### Response Format
```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2025-01-17T10:00:00Z",
    "request_id": "req_abc123"
  }
}
```

## 10. Deployment Strategy

### Production URLs
- **API**: https://api.ringer.tel
- **Customer Portal**: https://console.ringer.tel
- **Admin Portal**: https://admin.ringer.tel

### Environments
1. **Development**: Local k8s / Cloud SQL dev instance
2. **Staging**: Full GKE cluster, production-like
3. **Production**: Multi-region GKE, HA everything

### CI/CD
- **Frontend**: GitHub Actions → Vercel
- **Backend**: GitHub Actions → GCR → GKE
- **IaC**: Terraform Cloud

## 11. Security Decisions

### API Security
- **Portal Access**: Bearer tokens (JWT from Firebase Auth)
- **Voice/SMS APIs**: Cached JWT validation (Redis)
- **Telco Data APIs**: API keys validated by Cloud Armor CEL
- **Rate Limiting**: 
  - Portal: 100 req/min per user
  - Voice/SMS: 1,000 req/min per customer
  - Telco Data: 5,000 req/sec per API key
- **IP Allowlisting**: Enforced at Cloud Armor for Telco APIs
- **Request Signing**: For webhooks and sensitive operations

### Network Security
- Private GKE cluster
- Cloud NAT for egress
- Cloud Armor DDoS protection
- VPC Service Controls

## 12. SIP Network Architecture

### Decision: Shared Multi-Tenant Infrastructure
- **Kamailio**: Shared pods across all customers
- **RTPEngine**: Shared VM pool
- **Isolation**: Logical (database), not physical
- **Details**: See [SIP_NETWORK_ARCHITECTURE.md](../warp/docs/SIP_NETWORK_ARCHITECTURE.md)

### Kamailio Integration Architecture
- **Routing Engine**: LuaJIT with FFI for C library performance
- **API Communication**: HTTP calls from Lua to WARP services
- **Performance**: Sub-50ms routing decisions via FFI optimizations
- **Failover**: Cached routes in Lua when API unavailable
- **Implementation**: See routing details in [LCR_ROUTING_ARCHITECTURE.md](LCR_ROUTING_ARCHITECTURE.md)
### IP Address Strategy
- **Origination**: 3-5 static IPs via Cloud NAT
- **Termination**: Single anycast IP via Load Balancer
- **RTP Media**: Separate /28 subnet
- **Customer Requirement**: Must whitelist all origination IPs

### Authentication
- **Primary**: IP ACL (90% of customers)
- **Secondary**: SIP Registration (dynamic IPs)
- **Hybrid**: Both available simultaneously

## 13. Technology Constraints

### Must Use (Per PRD)
- Kamailio for SIP
- RTPEngine for media
- Redis for Kamailio state
- Jasmin for SMSC
- PostgreSQL for relational data
- BigQuery for analytics

### Recommended Stack
- Go for high-performance APIs
- TypeScript for frontend
- Python for data pipelines
- Terraform for all IaC

## 13.1. Go API Stack (Detailed Implementation)

### Decision: Go as Primary Backend Language for API Services
**Date**: October 2025
**Status**: APPROVED

### Rationale

1. **Performance Requirements Met**:
   - API latency < 200ms (p99) ✅
   - 10,000+ req/s throughput ✅
   - Compiled binary (no JVM/Node.js startup overhead)
   - Efficient memory usage for high-concurrency

2. **Telecom-Specific Benefits**:
   - Excellent network programming primitives
   - Built-in concurrency (goroutines) for handling thousands of simultaneous SIP/SMS requests
   - Strong typing prevents errors in critical billing/routing code
   - Standard library includes comprehensive networking support

3. **Operational Simplicity**:
   - Single binary deployment (perfect for Kubernetes)
   - Fast container builds
   - Cross-compilation for different architectures
   - Small container images (alpine-based, <50MB)

4. **Team Experience**:
   - Team has Node.js experience (transferable concepts)
   - Go learning curve is gentle
   - Existing Go code in repo (`src/exporters/business-metrics`)

### Go Framework & Library Stack

#### HTTP Framework
**Choice**: **Gin Web Framework**

```go
// Why Gin:
// - 40x faster than Martini
// - Similar to Express.js (familiar for Node.js developers)
// - Rich middleware ecosystem
// - Built-in validation, error handling
// - JSON rendering optimized
// - Active community support

import "github.com/gin-gonic/gin"
```

**Alternative Considered**: Echo, Chi (both excellent, Gin chosen for Express-like familiarity)

#### Database Drivers

**PostgreSQL**: `pgx/v5` (not database/sql)
```go
// Why pgx:
// - 3-5x faster than lib/pq
// - Connection pooling built-in
// - Context support
// - Batch operations
// - COPY protocol support

import "github.com/jackc/pgx/v5"
import "github.com/jackc/pgx/v5/pgxpool"
```

**Redis**: `go-redis/v9`
```go
// Why go-redis:
// - Most popular Redis client
// - Cluster support
// - Pipeline support
// - Pub/Sub
// - Redis Streams support

import "github.com/redis/go-redis/v9"
```

#### API Documentation & Validation

**OpenAPI/Swagger**: `swaggo/swag`
```go
// Auto-generates Swagger docs from code comments
// Integrates with Gin
// Live documentation UI

import "github.com/swaggo/gin-swagger"
```

**Request Validation**: `go-playground/validator/v10`
```go
// Struct tag-based validation
// Custom validators
// Localized error messages

import "github.com/go-playground/validator/v10"
```

#### Monitoring & Observability

**Metrics**: `prometheus/client_golang`
```go
// Official Prometheus client
// Already used in business-metrics exporter

import "github.com/prometheus/client_golang/prometheus"
```

**Logging**: `uber-go/zap`
```go
// Structured logging
// High performance (zero-allocation)
// JSON output for Cloud Logging

import "go.uber.org/zap"
```

**Tracing**: `open-telemetry/opentelemetry-go`
```go
// Distributed tracing
// Cloud Trace integration
// Automatic instrumentation

import "go.opentelemetry.io/otel"
```

#### Message Queue / Events

**RabbitMQ**: `streadway/amqp`
```go
// For Jasmin message queue integration

import "github.com/streadway/amqp"
```

#### Configuration Management

**Environment/Config**: `spf13/viper`
```go
// 12-factor app config
// Environment variables
// Config files (YAML/JSON)
// Secrets integration

import "github.com/spf13/viper"
```

#### Testing

**Testing**: Built-in `testing` package + `stretchr/testify`
```go
// Assertions and mocks
// Table-driven tests
// Suite support

import "github.com/stretchr/testify/assert"
```

### Project Structure (Go Standard Layout)

```
warp-api/
├── cmd/
│   ├── api-server/          # Main API server
│   ├── worker/              # Background job processor
│   └── migrate/             # Database migrations
├── internal/
│   ├── handlers/            # HTTP handlers (controllers)
│   ├── services/            # Business logic
│   ├── repository/          # Database access layer
│   ├── models/              # Data models
│   ├── middleware/          # Auth, logging, CORS
│   └── clients/             # External API clients (Jasmin, Telique, etc.)
├── pkg/                     # Public libraries (reusable)
├── api/                     # OpenAPI specs
├── migrations/              # SQL migrations
├── deployments/
│   └── kubernetes/          # K8s manifests
├── go.mod
├── go.sum
└── Dockerfile
```

### Node.js Use Cases (Complementary)

Keep Node.js for:
- **Admin scripts**: Quick database queries, data imports
- **Testing tools**: Load testing with k6, API testing
- **Development tools**: Code generation, documentation builders
- **Frontend**: Admin and customer portals (already React/Vite)

### Performance Comparison (Rough)

| Metric | Go | Node.js | Java |
|--------|-----|---------|------|
| Startup Time | 10ms | 100ms | 1000ms |
| Memory (baseline) | 10MB | 50MB | 200MB |
| Concurrent Connections | 100k+ | 10k | 50k |
| p99 Latency (typical API) | 5ms | 15ms | 20ms |
| Container Image Size | 20MB | 150MB | 300MB |

### Implementation Timeline

**Week 1**: Project scaffold, basic CRUD
**Week 2**: Authentication, database integration
**Week 3**: Jasmin integration (SMPP vendor management)
**Week 4**: Telique integration (LRN/LERG)
**Week 5**: Billing endpoints
**Week 6**: Production deployment

### Migration Path (If Needed)

If you start with Node.js and want to migrate:
- Both can run simultaneously
- Move high-traffic endpoints to Go incrementally
- Use same PostgreSQL/Redis backends
- Same OpenAPI spec

---

## Decision Summary

**Primary Backend Language**: Go 1.21+
**Framework**: Gin Web Framework
**Use Node.js For**: Admin tools, scripts, testing
**Rationale**: Performance requirements, concurrency needs, operational simplicity

## 14. SMS/MMS Architecture

### Decision: Custom Go SMPP Gateway (UPDATED October 2025)
**Date**: October 10, 2025
**Status**: IMPLEMENTED - Replaced Jasmin

**Rationale for Change:**
- Jasmin jCli persistence broken for Kubernetes automation
- File-based config incompatible with multi-pod deployments
- Community acknowledges not cloud-native
- Need PostgreSQL-backed configuration for true HA

**Implementation:**
- **SMSC Platform**: Custom Go SMPP Gateway (~600 lines vs 1000+ lines of jCli wrappers)
- **Carrier Integration**: Multiple SMPP vendors via PostgreSQL configuration
- **Database**: `messaging.vendors` table (unified with API Gateway)
- **Features**:
  - PostgreSQL vendor configuration (stateless pods)
  - TLS support for Sinch connections
  - Redis DLR tracking and rate limiting
  - REST API for management
  - Multi-pod HA ready

**Deployment:**
- Namespace: `messaging`
- Image: `us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/smpp-gateway:v1.1.0`
- Status: ✅ Connected to Sinch_Atlanta

### SMS Vendor Management
- **Database**: `messaging.vendors` table (shared with API Gateway)
- **API Access**: Both go-smpp and API Gateway use same table
- **Admin UI**: Can manage vendors via API Gateway endpoints
- **Schema Migration**: Completed October 11, 2025 (vendor_mgmt → messaging.vendors)

## 15. Frontend Integration Architecture

### Decision: API-First with Mock Data Replacement
- **Frontend Status**: Polymet-generated UI templates ready for API integration
- **Integration Pattern**: Replace mock data imports with API client calls
- **State Management**: React Query for all API state
- **Authentication**: Google Identity Platform (Firebase Auth) with JWT tokens
- **WebSocket**: Real-time updates for metrics and status

### Frontend-Backend Mapping
- **Customer Portal**: Maps to customer-scoped endpoints
- **Admin Portal**: Maps to admin endpoints with elevated permissions
- **API Coverage**: All UI features must have corresponding API endpoints
- **Documentation**: See FRONTEND_API_MAPPING.md for complete mapping

### Implementation Strategy
1. **Phase 1**: Implement base API client with auth
2. **Phase 2**: Replace mock data with API calls
3. **Phase 3**: Add WebSocket for real-time features
4. **Phase 4**: Implement error handling and retry logic

## 16. Billing Architecture

### Decision: Product-Specific Billers with Complex Rating
- **Separate Billers**: Voice, SMS, Telco Data API each have dedicated billing services
- **Rating Complexity**: Voice based on jurisdiction, NPANXX, not tied to routing partitions
- **Balance Storage**: PostgreSQL for consistency (not Redis)
- **Details**: See [BILLING_FLOWS.md](../warp/docs/BILLING_FLOWS.md) and [BILLING_PRD.md](../warp/docs/BILLING_PRD.md)

### Key Billing Principles
- **BAN-Centric**: All billing cycles tied to Billing Account Number
- **Zero Rating Failure Tolerance**: Failed rating blocks calls
- **NetSuite for Invoicing**: SKU-based, cannot handle complex voice rating
- **Vendor-Specific Cycles**: Weekly (Telnyx), Monthly (Peerless, Sinch)

## 17. Third-Party Service Configuration Management

### Decision: Admin-Configurable Service Integrations
- **All third-party services configurable via admin UI** - no hardcoded vendor dependencies
- **Dynamic vendor management** - add/update/remove providers without code changes
- **Service configurations stored in PostgreSQL** with full audit trails
- **Credentials referenced from Google Secret Manager** but managed through admin portal
- **Multi-vendor support with failover** for critical services

### Service Configuration Architecture
```yaml
Admin UI Configuration Pages:
  /admin/settings/telecom:      # LRN/LERG/CNAM, porting, toll-free
  /admin/settings/messaging:    # SMPP vendors, SMS routing, 10DLC
  /admin/settings/business:     # CRM, ERP, tax integrations  
  /admin/settings/payments:     # Payment gateways, processors
  /admin/settings/infrastructure: # Email, DNS, monitoring
```

### Configurable Service Categories

#### Telecom Services
- **LRN/LERG/CNAM**: Telique (provides all three via single API)
- **Toll-free Management**: Somos API
- **Number Porting**: Teliport API
- **CNAM Provisioning**: TransUnion
- **10DLC Registration**: TCR (The Campaign Registry)

#### Messaging Vendors (SMPP)
- **Multiple vendor support** with priority-based routing
- **Per-vendor configuration**: host, port, credentials, binds
- **Automatic failover** between vendors
- **No Sinch REST API** - SMPP binds only

#### Business Systems
- **CRM**: HubSpot (customer data, support tickets)
- **ERP/Billing**: NetSuite (invoicing, AR)
- **Tax Calculation**: Avalara

#### Payment Processing  
- **Credit Cards**: Authorize.Net
- **ACH Payments**: Mustache/Plaid

#### Infrastructure Services
- **Email Delivery**: SendGrid
- **DNS Management**: Gandi
- **Error Tracking**: Airbrake

### Plugin-Based Provider Architecture

Each provider will have its own module implementing a common interface, with provider-specific configuration schemas:

```go
// Common interface all providers must implement
type ServiceProvider interface {
    // Core methods
    Initialize(config json.RawMessage) error
    TestConnection() error
    GetCapabilities() []Capability
    GetConfigSchema() ConfigSchema
    
    // Provider-specific methods implemented per category
    // e.g., LRNProvider, SMPPProvider, PaymentProvider, etc.
}

// Provider configuration schema definition
type ConfigSchema struct {
    Provider     string                 `json:"provider"`
    Version      string                 `json:"version"`
    Fields       []FieldDefinition      `json:"fields"`
    Webhooks     []WebhookDefinition    `json:"webhooks"`
    Capabilities map[string]interface{} `json:"capabilities"`
}

type FieldDefinition struct {
    Name        string      `json:"name"`
    Type        string      `json:"type"` // string, number, boolean, url, secret
    Required    bool        `json:"required"`
    Description string      `json:"description"`
    Validation  string      `json:"validation"` // regex or validation rule
    Encrypted   bool        `json:"encrypted"`   // if true, store in Secret Manager
}
```

### Provider Module Examples

```yaml
# Telique Module Configuration
telique:
  credentials:
    api_key: {type: secret, required: true}
    account_id: {type: string, required: true}
  settings:
    api_url: {type: url, default: "https://api.telique.com/v1"}
    enable_lrn: {type: boolean, default: true}
    enable_lerg: {type: boolean, default: true}
    enable_cnam: {type: boolean, default: true}
    cache_ttl: {type: number, default: 3600}
  capabilities: [lrn_lookup, lerg_lookup, cnam_lookup]

# NetSuite Module Configuration  
netsuite:
  credentials:
    account_id: {type: string, required: true}
    consumer_key: {type: secret, required: true}
    consumer_secret: {type: secret, required: true}
    token_id: {type: secret, required: true}
    token_secret: {type: secret, required: true}
  settings:
    subsidiary_id: {type: string, required: false}
    location_id: {type: string, required: false}
    department_id: {type: string, required: false}
    class_id: {type: string, required: false}
    custom_fields: {type: json, required: false}
  webhooks:
    invoice_created: {type: url, required: false}
    payment_received: {type: url, required: false}
  capabilities: [invoicing, payments, inventory, custom_records]

# SMPP Vendor Module Configuration
smpp_vendor:
  credentials:
    system_id: {type: string, required: true}
    password: {type: secret, required: true}
  settings:
    host: {type: string, required: true}
    port: {type: number, default: 2775}
    system_type: {type: string, default: ""}
    bind_type: {type: enum, values: [transceiver, transmitter, receiver]}
    window_size: {type: number, default: 10}
    enquire_link_interval: {type: number, default: 30}
  capabilities: [sms_mt, sms_mo, delivery_receipts]
```

### Database Schema for Plugin-Based Configuration
```sql
CREATE TABLE service_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type VARCHAR(50) NOT NULL, -- 'telique', 'netsuite', 'hubspot', etc.
    instance_name VARCHAR(100) NOT NULL UNIQUE, -- user-defined name
    display_name VARCHAR(200),
    module_version VARCHAR(20), -- version of the provider module
    credentials JSONB, -- encrypted fields reference Secret Manager
    settings JSONB, -- provider-specific settings
    webhooks JSONB, -- webhook configurations
    capabilities TEXT[], -- array of capabilities this instance provides
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false, -- primary provider for its capability
    priority INTEGER DEFAULT 0, -- for failover/load balancing
    health_status VARCHAR(20) DEFAULT 'unknown', -- healthy, degraded, unhealthy
    last_health_check TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    UNIQUE(provider_type, instance_name)
);

CREATE TABLE provider_health_checks (
    id BIGSERIAL PRIMARY KEY,
    provider_id UUID REFERENCES service_providers(id),
    check_time TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20),
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB
);

CREATE TABLE provider_usage_stats (
    provider_id UUID REFERENCES service_providers(id),
    date DATE,
    requests_count BIGINT DEFAULT 0,
    errors_count BIGINT DEFAULT 0,
    avg_response_time_ms INTEGER,
    PRIMARY KEY (provider_id, date)
);
```

### Implementation Pattern
```go
// Services fetch configuration from database
func GetServiceConfig(serviceType string) (*ServiceConfig, error) {
    var config ServiceConfig
    err := db.QueryRow(`
        SELECT * FROM service_configurations 
        WHERE service_type = $1 AND is_active = true 
        ORDER BY priority LIMIT 1
    `, serviceType).Scan(&config)
    
    // Fetch credentials from Secret Manager
    credentials, err := secretManager.GetSecret(config.CredentialsRef)
    config.Credentials = credentials
    return &config, nil
}
```

## 18. Secrets Management & Container Registry

### Decision: Google Secret Manager for All Credentials
- **All sensitive credentials** stored in Google Secret Manager
- **No secrets in `.env` files** - only non-sensitive configuration
- **Access pattern**: Applications use Application Default Credentials (ADC)
- **Secret naming convention**: `projects/{project-id}/secrets/{service}-credentials/versions/latest`
- **Rotation policy**: Automated rotation for database passwords, manual for API keys
- **JWT Signing Key**: Created and stored as `jwt-signing-key` for API token generation

### Secret Categories
1. **Authentication Secrets**
   - Google Identity Platform credentials → `google-identity-credentials`
   - JWT signing keys → `jwt-signing-key`

2. **External API Credentials**
   - Sinch (SMS) → `sinch-api-credentials`
   - Telique (LRN/LERG) → `telique-api-credentials`
   - NetSuite (ERP) → `netsuite-api-credentials`
   - HubSpot (CRM) → `hubspot-api-credentials`
   - Authorize.Net → `authorize-net-credentials`
   - Mustache/Plaid → `mustache-api-credentials`
   - Avalara (Tax) → `avalara-api-credentials`
   - SendGrid (Email) → `sendgrid-api-credentials`

3. **Infrastructure Secrets** (to be created during deployment)
   - Database passwords → `cloudsql-{db}-password` (auto-generated by Terraform)
   - Redis auth → `redis-auth-string` (auto-generated by Terraform)
   - Service mesh tokens → `consul-tokens` (created during Consul setup)
   - Kamailio shared secret → `kamailio-shared-secret` (for inter-node communication)
   - RTPEngine control password → `rtpengine-control-password` (for RTPEngine API)

### Decision: Google Artifact Registry for Container Images
- **Use Google Artifact Registry** (NOT Container Registry which is deprecated)
- **Registry location**: `us-central1-docker.pkg.dev`
- **Repository structure**: `{location}-docker.pkg.dev/{project-id}/warp-platform/{service}:{tag}`
- **Build for AMD64 architecture** (not ARM)
- **Image scanning**: Enabled for vulnerability detection

### Container Image Organization
```
us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/
├── api-gateway:latest
├── billing-service:latest
├── routing-service:latest
├── kamailio:latest
├── rtpengine:latest
├── jasmin-smsc:latest
└── homer:latest
```

## 19. Frontend Hosting (Vercel)

### Decision: Vercel for React/Next.js Frontend Hosting
- **Customer Portal**: Deployed to Vercel at console.ringer.tel
- **Admin Portal**: Deployed to Vercel at admin.ringer.tel
- **Build Variables**: Set in Vercel Dashboard, not `.env`
- **Deployment**: Automatic from GitHub main branch

### Vercel Configuration
```
# Vercel Project Settings (set in Dashboard)
VERCEL_PROJECT_NAME_CUSTOMER=warp-customer-portal
VERCEL_PROJECT_NAME_ADMIN=warp-admin-portal
VERCEL_TEAM_ID=[your-team-id]

# Build & Development Settings
BUILD_COMMAND=npm run build
OUTPUT_DIRECTORY=dist  # for Vite/React
INSTALL_COMMAND=npm install
DEVELOPMENT_COMMAND=npm run dev

# Environment Variables (set in Vercel Dashboard)
VITE_API_URL=https://api.ringer.tel/v1
VITE_WS_URL=wss://api.ringer.tel/ws
VITE_FIREBASE_API_KEY=[from Firebase]
VITE_FIREBASE_AUTH_DOMAIN=[project-id].firebaseapp.com
VITE_FIREBASE_PROJECT_ID=[project-id]
VITE_ENVIRONMENT=production
```

### Frontend Framework Note
- Using Vite + React (not Next.js)
- Environment variables use `VITE_` prefix for client-side access
- Vercel automatically handles Vite builds

## 20. Error Tracking

### Decision: Airbrake for Error Monitoring
- **Choice**: Airbrake (based on team familiarity)
- **Alternative Considered**: Sentry (more popular but team prefers Airbrake)
- **Integration Points**:
  - Frontend JavaScript errors
  - Backend API errors
  - Background job failures
- **Configuration**: Error tracking key stored in Google Secret Manager

### Airbrake Setup
```
# Secret Manager
airbrake-credentials:
  project_id: [project-id]
  project_key: [project-key]
  environment: production

# Integration
- Frontend: @airbrake/browser
- Go Services: github.com/airbrake/gobrake/v5
- Node Services: @airbrake/node
```

### Error Tracking Requirements
- Capture stack traces with source maps
- Group similar errors automatically
- Alert on error rate spikes
- Integration with PagerDuty for critical errors
- 30-day error retention minimum

## Payment Processing Integration

### Decision: Dual Payment Processor Strategy
- **Credit Cards**: Authorize.Net
  - Tokenization for PCI compliance
  - Recurring billing support
  - Fraud detection included
- **ACH Payments**: Mustache (Plaid)
  - Bank account verification
  - Lower transaction fees for high-volume
  - Instant account validation

## Open Decisions Requiring Input

1. **NetSuite Integration Approach**
   - Direct API integration?
   - ETL pipeline through Pub/Sub?
   - Third-party integration platform?

2. **Disaster Recovery Strategy**
   - Active-active multi-region?
   - Active-passive with failover?
   - Backup region selection?

3. **Number Inventory Providers**
   - Which providers to integrate first?
   - Build vs buy number management?

## Hive-Mind Agent Assignments

### Agent 1: Infrastructure & Data
- Owns: Terraform, Kubernetes, Databases
- Deliverables: IaC code, schemas, deployment scripts

### Agent 2: Core Services
- Owns: API Gateway, Routing, Rating
- Deliverables: REST APIs per OpenAPI spec

### Agent 3: Integrations
- Owns: Jasmin, Sinch, Telique, Billing pipelines
- Deliverables: External connectors, data flows

### Agent 4: Frontend & Admin
- Owns: Customer portal, Admin portal, Dashboards
- Deliverables: React applications with full API integration, Grafana configs
- Key Tasks:
  - Implement API clients per API_CLIENT_SPECIFICATION.md
  - Replace all mock data with real API calls per FRONTEND_API_MAPPING.md
  - Setup Google Identity Platform (Firebase Auth) authentication
  - Implement WebSocket for real-time updates

## Communication Protocol

All agents will coordinate through:
- This ARCHITECTURAL_DECISIONS.md file
- PROGRESS.md for daily updates
- API contracts in /api/openapi.yaml
- Shared Prometheus metrics definitions

---
*Last Updated: January 2025*
*Next Review: After Phase 3 completion*
## 21. Authentication & Permission System

### Decision: Firebase + Gatekeeper Pattern (October 2025)
**Date**: October 11, 2025
**Status**: PLANNED - Ready for implementation

**Pattern Source**: Adapted from ringer-soa (Spring Boot) to Go + React/Vite

### Authentication Architecture
- **Frontend Auth**: Firebase Authentication (Google OAuth + Email/Password)
- **Backend Verification**: Firebase Admin SDK for Go
- **Token Flow**: Direct Firebase ID tokens (no proxy layer)
- **Session Management**: Firebase handles token refresh

**Why Firebase:**
- Proven in ringer-soa project
- Handles OAuth complexity
- Built-in token refresh
- Admin SDK available for Go
- MFA support built-in

### Authorization Architecture (Gatekeeper Pattern)
- **Model**: Database-driven permissions (zero frontend logic)
- **Enforcement**: Single Gatekeeper middleware in Go API Gateway
- **Permission Matching**: Wildcard support (`/api/v1/customers/*`)
- **Customer Scoping**: User-customer access table for data filtering

### Database Schema
```
auth.user_types              → Role definitions (superAdmin, admin, etc.)
auth.user_type_permissions   → What each role can access
auth.permission_metadata     → Friendly names, descriptions for UI
auth.users                   → Links Firebase UID to user type
auth.user_customer_access    → Customer scoping (what customers user can see)
```

### Permission Flow
```
1. User logs in with Google → Firebase returns ID token
2. Frontend sends request with: Authorization: Bearer {firebase_id_token}
3. Go middleware verifies token with Firebase Admin SDK
4. Lookup user by firebase_uid → get user_type_id
5. Gatekeeper checks: user_type → permissions → resource_path
6. If allowed: Get accessible_customer_ids → filter data
7. If denied: Return 403
```

### Key Features
- ✅ All authorization in backend (frontend just hides UI)
- ✅ Permissions stored in database (dynamic, auditable)
- ✅ SuperAdmin wildcard: `*` permission
- ✅ Customer data scoping (users see only assigned customers)
- ✅ Permission metadata for friendly UI
- ✅ Batch permission checks for performance

### Implementation Reference
- Pattern: See `EXAMPLE_PERMISSION_SYSTEM.md` (ringer-soa)
- Adaptation: See `PERMISSION_SYSTEM_ADAPTATION.md`
- Plan: See `AUTH_IMPLEMENTATION_PLAN.md`

**Differences from ringer-soa:**
- Go (not Java/Spring Boot)
- React + Vite (not Next.js)
- Direct Firebase tokens (not proxy pattern)
- Gin middleware (not Spring Security filters)

## 22. Frontend Framework Final Decision

### Decision: React + Vite (October 2025)
**Date**: October 11, 2025
**Status**: CONFIRMED

**What We Have:**
- `apps/admin-portal/` - React 18 + Vite + shadcn/ui
- `apps/customer-portal/` - (to be built, same stack)

**PRD Originally Suggested:**
- Next.js 14+ with App Router

**Why We Chose React + Vite Instead:**
1. **Polymet-generated UI components** already in React/Vite
2. **Simpler deployment** - static build, no server-side rendering needed
3. **Faster dev experience** - Vite HMR is instant
4. **API-first architecture** - Don't need Next.js API routes (have Go backend)
5. **Vercel still works** - Vercel supports Vite builds natively

**Trade-offs Accepted:**
- No server-side rendering (acceptable - internal admin tool)
- No API proxy pattern (direct backend calls with CORS)
- Need client-side Firebase SDK (vs server-side in Next.js)

**Configuration:**
- Environment variables: `VITE_` prefix
- Build command: `vite build`
- Output: `dist/` directory
- Deployment: Vercel (automatic)

## 23. Resource Optimization Lessons

### Decision: Right-Size Resource Requests (October 2025)
**Date**: October 11, 2025
**Problem**: Cluster CPU capacity exhausted despite zero traffic

**Root Cause:**
- Default resource requests too high (500m-1000m CPU per pod)
- Actual usage at idle: 1-15m CPU per pod
- Over-allocation: 98% waste

**Solution:**
- Reduced CPU requests by 82% (2750m → 500m total)
- Set requests based on actual measured usage + 3-5x buffer
- Keep limits high for burst capacity

**Final Resource Requests:**
```
Kamailio:        50m CPU, 256Mi RAM (was 500m/512Mi)
API Gateway:     50m CPU, 128Mi RAM (was 250m/256Mi)
go-smpp:         100m CPU, 256Mi RAM (was 500m/512Mi)
```

**Lesson Learned:**
- Always measure actual usage before setting requests
- Start small, scale up based on real traffic
- Idle services need 10-20m CPU, not 500m+

## 24. Cloud NAT Configuration for GKE Pods

### Decision: Use ALL_IP_RANGES for GKE Subnet NAT (November 2025)
**Date**: November 25, 2025
**Status**: IMPLEMENTED
**Impact**: P1 - Fixed 22+ day SMPP Gateway outage

**Context:**
The SMPP Gateway could not connect to Sinch due to Cloud NAT misconfiguration. Pods were egressing through the wrong IP (34.57.46.26 instead of whitelisted 34.58.165.135), causing Sinch's firewall to block connections.

### Root Cause

The Cloud NAT was configured with `LIST_OF_SECONDARY_IP_RANGES` which only NATs traffic originating from the pod IP range (10.1.x.x secondary range), but NOT traffic from the node primary IP range (10.0.0.x).

**Broken Configuration:**
```terraform
subnetwork {
  name                     = google_compute_subnetwork.gke_subnet.id
  source_ip_ranges_to_nat  = ["LIST_OF_SECONDARY_IP_RANGES"]
  secondary_ip_range_names = ["gke-pods"]
}
```

**Fixed Configuration:**
```terraform
subnetwork {
  name                    = google_compute_subnetwork.gke_subnet.id
  source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
}
```

### Key Technical Learnings

1. **GKE Network Topology:**
   - GKE nodes have primary IPs from the node subnet (e.g., 10.0.0.x)
   - GKE pods have IPs from the secondary "gke-pods" range (e.g., 10.1.x.x)
   - Outbound traffic from pods may originate from EITHER range depending on network path
   - `ALL_IP_RANGES` is the only safe option to cover all pod egress traffic

2. **Cloud NAT Endpoint Types:**
   - `ENDPOINT_TYPE_GKE` does NOT exist in GCP Cloud NAT
   - Valid options: `ENDPOINT_TYPE_VM`, `ENDPOINT_TYPE_SWG`, `ENDPOINT_TYPE_MANAGED_PROXY_LB`
   - Standard configuration without `endpoint_types` works for GKE

3. **GKE Default SNAT:**
   - GKE clusters have default SNAT enabled by default
   - Must disable default SNAT for pods to use Cloud NAT: `defaultSnatStatus.disabled: true`
   - Verify: `gcloud container clusters describe <cluster> --format="value(networkConfig.defaultSnatStatus.disabled)"`

4. **Two-NAT Architecture:**
   - `warp-nat-gke` for GKE pods (uses 34.58.165.135 - Sinch whitelisted)
   - `warp-nat-general` for VMs (uses 3 other IPs that customers may have whitelisted)
   - Keeps separate egress IPs for different service types

### Verification Commands
```bash
# Test egress IP from GKE pod
kubectl run ip-test --image=curlimages/curl --rm -it --restart=Never -- curl -s https://api.ipify.org
# Expected: 34.58.165.135

# Check NAT configuration
gcloud compute routers nats describe warp-nat-gke --router=warp-router --region=us-central1
```

### Lessons for Future Infrastructure
- **Always use `ALL_IP_RANGES`** for GKE subnet NAT configuration
- **Test egress IP** before assuming vendor connectivity will work
- **Document whitelisted IPs** - Sinch only whitelists 2 IPs, cannot add more
- **IaC discipline** - Manual NAT changes get overwritten by terraform apply

**References:**
- [SMPP_NAT_TROUBLESHOOTING_HANDOFF.md](../../SMPP_NAT_TROUBLESHOOTING_HANDOFF.md) - Complete troubleshooting history
- [GO_SMPP_GATEWAY_ARCHITECTURE.md](GO_SMPP_GATEWAY_ARCHITECTURE.md) - Network architecture section

---

*Last Updated: November 25, 2025*
*Next Review: After SMPP traffic validation*

## 15. SSL/TLS Termination Strategy

**Date**: 2025-11-30
**Status**: Accepted
**Decision**: NGINX Ingress Controller with cert-manager for automated Let's Encrypt certificates

### Context
WARP platform required HTTPS for all public-facing services to:
- Enable secure TCR webhooks (requires HTTPS endpoints)
- Protect user credentials and API tokens in transit
- Meet enterprise customer security requirements
- Comply with PCI DSS requirements for payment processing

**Options Evaluated**:
1. **NGINX Ingress + cert-manager** (chosen)
2. GCP Application Load Balancer with Managed Certificates
3. Manual SSL certificates on individual LoadBalancers

### Architecture

**Single Ingress Pattern**:
```
Internet (HTTPS) → GCP Load Balancer → NGINX Ingress Controller → Backend Services
                                              ↓
                                        cert-manager (Let's Encrypt)
```

**Services**:
- `api.rns.ringer.tel` → API Gateway (warp-api namespace)
- `grafana.ringer.tel` → Grafana (monitoring namespace)
- `prometheus.ringer.tel` → Prometheus (monitoring namespace)

**Certificate Management**:
- Provider: Let's Encrypt (free, automated)
- Challenge Type: HTTP-01 (no DNS API required)
- Renewal: Automatic (cert-manager renews at 30 days before expiry)
- Certificate Lifetime: 90 days

### Rationale

**Cost Savings**:
- Before: 3 LoadBalancers × $18/month = $54/month (projected)
- After: 1 LoadBalancer × $18/month = $18/month  
- **Savings: $36/month ($432/year)**

**Operational Benefits**:
- Automatic certificate renewal (no manual intervention)
- Centralized TLS configuration
- Single point for security policies (rate limiting, WAF rules)
- Native Kubernetes integration (annotations, CRDs)

**Technical Benefits**:
- Path-based routing (critical for TCR webhooks on `/webhooks/*`)
- WebSocket support (required for real-time UI updates)
- Header manipulation (X-Forwarded-For, custom headers)
- Cloud-agnostic (can migrate off GCP without rewrite)

**Why Not GCP Load Balancer**:
- Vendor lock-in (GCP-specific configuration)
- Higher cost at scale (per-GB data processing charges)
- Slower provisioning (5-10 min vs 30 sec for certificates)
- Less flexible routing than NGINX

### Consequences

**Positive**:
- $36/month cost reduction
- Zero manual certificate management
- Foundation for advanced routing (webhooks, WebSocket, API versioning)
- Prometheus metrics built-in (ingress request rates, latencies)

**Negative**:
- Extra component to maintain (NGINX controller pod)
- Minimal latency overhead (~1-2ms per request)
- Single point of failure (mitigated by GCP LoadBalancer HA + pod autoscaling)

### Monitoring & Alerts

**Metrics** (automatically scraped by Prometheus):
- `nginx_ingress_controller_requests` - Request rates per ingress
- `nginx_ingress_controller_request_duration_seconds` - Latency percentiles
- `nginx_ingress_controller_ssl_expire_time_seconds` - Certificate expiry

**Alerts** (to be configured):
- Certificate expiry < 7 days → Page on-call
- NGINX pod crash loop → Page on-call
- 5xx error rate > 1% → Alert
- P95 latency > 500ms → Alert

### Impact on Dependent Services

**TCR Webhooks** (Phase 3 of implementation):
- Webhook URLs will use HTTPS: `https://api.rns.ringer.tel/webhooks/tcr/*`
- Path-based routing allows multiple webhook endpoints on single domain
- SSL termination at ingress → backend receives plain HTTP (simplifies webhook handler)

**Customer Portal** (Vercel-hosted):
- No changes required (separate domain: console.rns.ringer.tel)
- Vercel manages its own SSL certificates

**Admin Portal** (Vercel-hosted):
- No changes required (separate domain: admin.rns.ringer.tel)

**Kamailio/RTPEngine**:
- No changes required (SIP/RTP traffic uses separate network paths)

### Rollback Plan

If issues arise with NGINX Ingress:
1. Revert DNS to old LoadBalancer IP (34.58.150.254)
2. Keep old LoadBalancer service for 7 days before deletion
3. Total rollback time: ~5 minutes (DNS TTL: 300 seconds)

### Future Considerations

**Phase 2** (Q1 2026): Add Cloud Armor policies to NGINX LoadBalancer
- DDoS protection (rate limiting at edge)
- Geographic restrictions (block non-US traffic if needed)
- IP allowlisting for sensitive endpoints

**Phase 3** (Q2 2026): Multi-region ingress
- Deploy NGINX Ingress Controllers in us-west1, europe-west1
- Global load balancing via DNS-based routing
- Sub-50ms latency worldwide

### References
- NGINX Ingress Controller: https://kubernetes.github.io/ingress-nginx/
- cert-manager: https://cert-manager.io/
- Let's Encrypt: https://letsencrypt.org/
- Implementation Plan: `~/.claude/plans/snappy-petting-quill.md`

---

*Last Updated: November 30, 2025*
*Next Review: After TCR webhook implementation*
