# Backend Services

This directory contains all backend services for the WARP platform, written in Go.

## Services

### api-gateway/
Main API service providing:
- Vendor management (SMPP vendors, Jasmin integration)
- Trunk management (SIP trunk CRUD)
- Number management (DID inventory)
- Campaign management (10DLC/TCR integration)
- Message sending (SMS/MMS via Jasmin)
- Routing services (LCR, rate calculation)

**Stack**: Go 1.21+, Gin framework, PostgreSQL (pgx), Redis (go-redis)

### exporters/
Prometheus exporters for business metrics:
- `business-metrics/` - Custom telecom metrics (ASR, ACD, revenue, etc.)

## Development

See [/docs/API_DEVELOPMENT_GUIDE.md](/docs/API_DEVELOPMENT_GUIDE.md) for:
- Project structure (Go standard layout)
- Framework and library choices
- Development workflow
- Integration patterns

## Deployment

Services are deployed to GKE:
- Kubernetes manifests: `/infrastructure/kubernetes/`
- Docker configs: `/infrastructure/docker/`
