# WARP API Gateway

Main API service for the WARP platform, providing REST APIs for vendor management, trunk management, messaging, and routing.

## Technology Stack

- **Language**: Go 1.21+
- **Framework**: Gin Web Framework
- **Database**: PostgreSQL (pgx driver)
- **Cache**: Redis (go-redis)
- **Documentation**: Swagger/OpenAPI

## Project Structure

```
api-gateway/
├── cmd/
│   └── server/          # Main entry point
├── internal/
│   ├── handlers/        # HTTP request handlers
│   ├── services/        # Business logic
│   ├── repository/      # Data access layer
│   ├── models/          # Domain models
│   ├── middleware/      # HTTP middleware (auth, logging, CORS)
│   └── clients/         # External API clients
├── pkg/                 # Reusable packages
├── migrations/          # Database migrations
└── deployments/         # Kubernetes manifests
```

## Getting Started

### Prerequisites

- Go 1.21+
- Docker
- Access to GKE cluster
- PostgreSQL (Cloud SQL)
- Redis

### Local Development

```bash
# Install dependencies
go mod download

# Run locally
go run cmd/server/main.go

# With live reload (using air)
go install github.com/cosmtrek/air@latest
air
```

### Build

```bash
# Build binary
go build -o api-server cmd/server/main.go

# Build Docker image
docker build -t api-gateway:latest .
```

### Deploy

```bash
# Build and push to GCP Artifact Registry
gcloud builds submit --tag us-central1-docker.pkg.dev/ringer-warp-v01/warp-platform/api-gateway:latest

# Deploy to Kubernetes
kubectl apply -f deployments/kubernetes/
```

## API Endpoints

### Health & Monitoring
```
GET /health              # Health check
GET /ready               # Readiness check
```

### Vendor Management (Phase 1)
```
POST   /api/v1/admin/smpp-vendors          # Create SMPP vendor
GET    /api/v1/admin/smpp-vendors          # List vendors
GET    /api/v1/admin/smpp-vendors/:id      # Get vendor details
PUT    /api/v1/admin/smpp-vendors/:id      # Update vendor
DELETE /api/v1/admin/smpp-vendors/:id      # Delete vendor
POST   /api/v1/admin/smpp-vendors/:id/bind # Start SMPP bind
GET    /api/v1/admin/smpp-vendors/:id/status # Get bind status
```

## Configuration

Environment variables:

```bash
PORT=8080                          # Server port
GIN_MODE=release                   # Gin mode (debug, release)
DATABASE_URL=postgresql://...      # PostgreSQL connection
REDIS_URL=redis://...              # Redis connection
JASMIN_JCLI_HOST=jasmin-http-service.messaging.svc.cluster.local
JASMIN_JCLI_PORT=8990
JASMIN_ADMIN_PASSWORD=...          # From K8s secret
```

## Development Roadmap

### Phase 1: Vendor Management (Current)
- [x] Project scaffold
- [ ] SMPP vendor CRUD operations
- [ ] Jasmin jCli integration
- [ ] PostgreSQL service_providers table
- [ ] Swagger documentation

### Phase 2: Campaign Management
- [ ] TCR API integration
- [ ] 10DLC campaign registration
- [ ] Number assignment to campaigns

### Phase 3: Messaging
- [ ] SMS send endpoint
- [ ] Bulk messaging
- [ ] DLR tracking

### Phase 4: Trunk & Routing
- [ ] SIP trunk management
- [ ] Number management
- [ ] Routing configuration

## Integration Points

### Jasmin SMSC
- **jCli**: jasmin-http-service.messaging.svc.cluster.local:8990 (telnet)
- **HTTP API**: jasmin-http-service.messaging.svc.cluster.local:8080

### PostgreSQL
- **Host**: Cloud SQL (via proxy sidecar)
- **Database**: warp
- **Schema**: vendor_mgmt, accounts, routing, messaging

### Redis
- **Host**: redis-service.messaging.svc.cluster.local:6379
- **Usage**: Caching, rate limiting, session storage

## Testing

```bash
# Run tests
go test ./...

# With coverage
go test -cover ./...

# Integration tests
go test -tags=integration ./...
```

## Documentation

Full API documentation available at:
- **Local**: http://localhost:8080/swagger/index.html
- **Production**: https://api-v2.ringer.tel/swagger/index.html

See `/docs/API_DEVELOPMENT_GUIDE.md` for detailed development guidelines.
