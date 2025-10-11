# WARP Platform API Gateway

Go-based API Gateway for the WARP Platform with OpenAPI 3.0.3 documentation.

## Features

- RESTful API with Gin web framework
- OpenAPI 3.0.3 / Swagger documentation (auto-generated)
- PostgreSQL integration with pgx (connection pooling)
- Redis caching support
- JWT authentication
- Customer management
- Voice vendor management
- SMS vendor management
- SIP trunk management
- Production-ready with health checks

## Quick Start

### Prerequisites

- Go 1.21+
- PostgreSQL 15+ (Cloud SQL)
- Redis (MemoryStore)
- Docker (for containerized deployment)

### Local Development

```bash
# Install dependencies
make deps

# Generate Swagger docs
make gen-docs

# Run locally (requires database connection)
export DATABASE_PASSWORD="your_password"
export JWT_SECRET="your_secret"
make run
```

### API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8080/docs/index.html
- **OpenAPI JSON**: http://localhost:8080/swagger.json
- **OpenAPI YAML**: http://localhost:8080/swagger.yaml

## API Endpoints

### Customer Management
- `POST /v1/customers` - Create customer
- `GET /v1/customers` - List customers
- `GET /v1/customers/:id` - Get customer
- `PUT /v1/customers/:id` - Update customer
- `GET /v1/customers/by-ban/:ban` - Get by BAN
- `GET /v1/customers/:id/trunks` - Get customer trunks
- `GET /v1/customers/:id/dids` - Get customer DIDs

### Vendor Management
- `POST /v1/admin/voice-vendors` - Create voice vendor
- `GET /v1/admin/voice-vendors` - List voice vendors
- `POST /v1/admin/sms-vendors` - Create SMS vendor
- `GET /v1/admin/sms-vendors` - List SMS vendors

### Trunk Management
- `POST /v1/customers/:id/trunks` - Create trunk
- `GET /v1/trunks/:id` - Get trunk

## Database Schema

Run the schema initialization:

```bash
psql -h 10.126.0.3 -U warp_api -d warp -f ../../infrastructure/database/schemas/01-core-schema.sql
```

## Docker Build & Deploy

```bash
# Build and push to Artifact Registry
make docker-push

# Deploy to Kubernetes
make deploy-k8s

# View logs
make logs
```

## Configuration

Configuration via `config.yaml` or environment variables:

```bash
# Database
export WARP_DATABASE_HOST=10.126.0.3
export WARP_DATABASE_PORT=5432
export WARP_DATABASE_USER=warp_api
export WARP_DATABASE_DATABASE=warp
export DATABASE_PASSWORD=secret

# Redis
export WARP_REDIS_HOST=10.206.200.36
export WARP_REDIS_PORT=6379

# JWT
export JWT_SECRET=your_secret_key

# Server
export WARP_SERVER_PORT=8080
export WARP_SERVER_ENVIRONMENT=production
```

## Project Structure

```
api-gateway/
├── cmd/
│   └── api-server/          # Main application entry point
│       └── main.go          # Swagger annotations here
├── internal/
│   ├── config/              # Configuration management
│   ├── handlers/            # HTTP handlers with Swagger comments
│   ├── models/              # Request/response models
│   ├── repository/          # Database access layer
│   └── middleware/          # Auth, logging, CORS
├── docs/                    # Auto-generated Swagger docs
├── deployments/
│   └── kubernetes/          # K8s manifests
├── Dockerfile
├── Makefile
└── README.md
```

## Testing

### Create Test Customer

```bash
curl -X POST http://localhost:8080/v1/customers \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "ban": "TEST-001",
    "company_name": "Test Corp",
    "customer_type": "POSTPAID",
    "contact": {"name": "Test User", "email": "test@example.com", "phone": "+1234567890"},
    "address": {"line1": "123 Test St", "city": "Denver", "state": "CO", "zip": "80202", "country": "US"}
  }'
```

### Create Voice Vendor

```bash
curl -X POST http://localhost:8080/v1/admin/voice-vendors \
  -H "Authorization: Bearer test-token" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_code": "test_vendor",
    "vendor_name": "Test Vendor",
    "vendor_type": "TIER1",
    "billing_model": "LRN",
    "sip_endpoints": [{"host": "sip.test.com", "port": 5060, "transport": "UDP", "priority": 1}],
    "supported_codecs": ["PCMU", "PCMA"]
  }'
```

## Production Deployment

```bash
# 1. Build and push image
make docker-push VERSION=v1.0.0

# 2. Deploy to GKE
kubectl apply -f deployments/kubernetes/

# 3. Verify deployment
kubectl get pods -n warp-api
kubectl logs -n warp-api -l app=api-gateway

# 4. Access Swagger docs (via port-forward)
kubectl port-forward -n warp-api svc/api-gateway 8080:8080
open http://localhost:8080/docs/index.html
```

## Next Steps

1. Initialize database with schema
2. Configure database user and password
3. Generate Swagger documentation
4. Build and deploy to Kubernetes
5. Integrate with admin portal
6. Add remaining endpoints (messaging, CDRs, analytics)

## License

Proprietary - Ringer Technologies
