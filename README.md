# WARP - Wholesale Accounting Routing and Provisioning Platform

## 🚀 Overview
WARP is a carrier-grade SIP trunking and messaging platform designed for wholesale telecom carriers. It provides API-driven provisioning, real-time routing, comprehensive billing, and SMS/MMS/RCS capabilities.

## 📋 Quick Navigation

### Core Documentation
- [Documentation Structure Guide](docs/README.md) - 📚 **START HERE** - Explains documentation organization
- [Product Requirements](warp/docs/PRD.md) - Business requirements and features
- [Architecture](warp/docs/ARCHITECTURE.md) - Technical architecture and design
- [API Specification](warp/api/openapi.yaml) - OpenAPI 3.0.3 specification

### Platform Documentation (`/docs/`)
- [Architectural Decisions](docs/ARCHITECTURAL_DECISIONS.md) - Platform-wide architecture choices
- [Development Decisions](docs/DEVELOPMENT_ENVIRONMENT_DECISIONS.md) - Framework and tooling decisions
- [Environment Setup](docs/ENVIRONMENT_SETUP.md) - Development environment configuration
- [Integration Matrix](docs/INTEGRATION_MATRIX.md) - External integrations overview
- [Hive-Mind Orchestration Guide](docs/HIVEMIND_ORCHESTRATION_GUIDE.md) - AI implementation guide

### WARP Service Documentation (`/warp/docs/`)
- [Billing System](warp/docs/BILLING_SYSTEM.md) - Complete billing implementation
- [Billing Architecture](warp/docs/BILLING_ARCHITECTURE.md) - Billing technical design
- [BigQuery CDR Architecture](warp/docs/BIGQUERY_CDR_ARCHITECTURE.md) - Data pipeline design
- [SIP Network Architecture](warp/docs/SIP_NETWORK_ARCHITECTURE.md) - SIP infrastructure
- [SMS Architecture](warp/docs/SMS_ARCHITECTURE.md) - SMS/MMS system design
- [Homer Architecture](warp/docs/HOMER_ARCHITECTURE.md) - SIP capture system
- [Homer Troubleshooting](warp/docs/HOMER_TROUBLESHOOTING.md) - Debugging guide

## 🏗️ Technology Stack

### Cloud Infrastructure
- **Platform**: Google Cloud Platform (GCP)
- **Orchestration**: Kubernetes (GKE with Autopilot)
- **Databases**: PostgreSQL (Cloud SQL), BigQuery (CDR/MDR)
- **Cache**: Redis Cluster
- **Service Mesh**: Consul

### Core Components
- **SIP Control**: Kamailio
- **Media Processing**: RTPEngine
- **SMS Gateway**: Jasmin SMSC
- **SIP Capture**: Homer
- **API Gateway**: Go/Rust microservices
- **Frontend**: Next.js/TypeScript/Tailwind (Vercel)

### Integrations
- **Authentication**: Auth0/Keycloak
- **Billing**: NetSuite
- **SMS Delivery**: Sinch
- **Telecom Data**: Telique API

## 🚦 Getting Started

### Prerequisites
```bash
# Required tools
- gcloud CLI (authenticated)
- kubectl
- terraform >= 1.0
- docker
- node >= 18
- go >= 1.21
```

### Environment Setup
1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure GCP project:
```bash
export GCP_PROJECT_ID=your-project-id
gcloud config set project $GCP_PROJECT_ID
```

3. Initialize Terraform:
```bash
cd warp/terraform/environments/dev
terraform init
terraform plan
```

4. Deploy infrastructure:
```bash
terraform apply
```

## 📂 Project Structure

```
ringer-warp/
├── customer-frontend/    # Customer portal (React/Next.js)
├── admin-frontend/       # Admin portal (React/Next.js)
├── warp/
│   ├── api/              # API specifications
│   ├── docs/             # Platform documentation
│   ├── terraform/        # Infrastructure as Code
│   ├── k8s/             # Kubernetes manifests
│   ├── database/        # Database schemas
│   └── services/        # Microservices
├── docker/              # Docker compose configurations
├── docs/
│   ├── api_docs/        # External API documentation
│   └── coordination/    # Hive-mind coordination files
├── HIVEMIND_ORCHESTRATION_GUIDE.md # Complete hive-mind guide
├── DEVELOPMENT_ENVIRONMENT_DECISIONS.md # Framework decisions
└── .env.development     # Development configuration
```

## 🔑 Key Features

### Voice Services
- **SIP Trunking**: Bidirectional IP configuration
- **Routing**: Partition-based LCR engine
- **Codecs**: G.711, G.729, Opus transcoding
- **Quality**: Real-time MOS scoring
- **Scale**: 100,000+ concurrent calls

### Messaging Services
- **SMS/MMS**: A2P messaging via Sinch
- **RCS**: Rich Communication Services
- **Delivery**: DLR tracking and reporting
- **Compliance**: 10DLC and campaign registry

### Billing & Rating
- **Real-time Rating**: Zone-based pricing
- **NetSuite Integration**: Automated invoicing
- **Prepaid/Postpaid**: Flexible account types
- **Usage Tracking**: BigQuery analytics

### Support & Monitoring
- **Homer**: SIP packet capture
- **Grafana**: Real-time dashboards
- **Prometheus**: Metrics collection
- **BigQuery**: CDR/MDR analytics

## 🔄 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- GCP infrastructure setup
- Database schemas
- Basic authentication

### Phase 2: Core Services (Week 3-4)
- Customer management
- SIP trunk provisioning
- Kamailio routing

### Phase 3: Billing (Week 5-6)
- Rating engine
- CDR pipeline
- NetSuite integration

### Phase 4: Messaging (Week 7-8)
- Jasmin SMSC setup
- Sinch integration
- Message routing

### Phase 5: Portal (Week 9)
- Next.js frontend
- Customer dashboard
- Admin tools

### Phase 6: Production (Week 10)
- Testing & validation
- Documentation
- Deployment

## 🧪 Testing

### Run Tests
```bash
# Unit tests
go test ./services/...

# Integration tests
npm run test:integration

# Load tests
k6 run tests/load/scenarios.js
```

## 📊 Monitoring

### Access Points
- **Homer**: https://homer.warp.io - SIP troubleshooting
- **Grafana**: https://grafana.warp.io - Metrics dashboards
- **Portal**: https://app.warp.io - Customer interface

## 🔐 Security

### Key Security Features
- OAuth 2.0 / JWT authentication
- Role-based access control (RBAC)
- IP whitelisting for SIP
- TLS/SRTP encryption
- Cloud Armor DDoS protection

## 📚 API Documentation

### View API Docs
```bash
# Start local documentation server
npx @redocly/cli preview-docs warp/api/openapi.yaml
```

### Generate Client SDKs
```bash
# TypeScript
npx @openapitools/openapi-generator-cli generate \
  -i warp/api/openapi.yaml \
  -g typescript-axios \
  -o sdk/typescript

# Python
npx @openapitools/openapi-generator-cli generate \
  -i warp/api/openapi.yaml \
  -g python \
  -o sdk/python
```

## 🤝 Development Workflow

### For Claude Flow/Hive-mind

1. **Start with Documentation**
   - Read [PRD.md](warp/docs/PRD.md) for requirements
   - Review [ARCHITECTURE.md](warp/docs/ARCHITECTURE.md) for technical decisions
   - Follow [HIVEMIND_ORCHESTRATION_GUIDE.md](HIVEMIND_ORCHESTRATION_GUIDE.md) for complete implementation guide

2. **Check Environment Setup**
   - Review [DEVELOPMENT_ENVIRONMENT_DECISIONS.md](DEVELOPMENT_ENVIRONMENT_DECISIONS.md) for framework choices
   - Configure `.env.development` with credentials
   - Verify GCP project access

3. **Implement Services**
   - Start with database schemas
   - Build services according to OpenAPI spec
   - Add tests for all business logic
   - Update documentation

4. **Deploy and Test**
   - Deploy to development environment
   - Run integration tests
   - Verify monitoring
   - Document any issues

## 🆘 Support

### Troubleshooting
- Check [Homer](warp/docs/HOMER_TROUBLESHOOTING.md) for SIP issues
- Review logs in Cloud Logging
- Check service health endpoints
- Consult runbooks in docs/

### Common Issues
- **Database Connection**: Check Cloud SQL proxy
- **Authentication**: Verify Auth0/Keycloak config
- **SIP Routing**: Check Kamailio logs and Homer
- **Billing**: Verify NetSuite credentials

## 📝 License
Proprietary - All rights reserved

## 🏢 About
Built for wholesale telecom carriers requiring enterprise-grade SIP trunking with comprehensive billing and support capabilities.

---

**Version**: 1.0.0
**Status**: In Development
**Target Launch**: Q2 2025

For detailed implementation instructions, see [CLAUDE_FLOW_GUIDE.md](CLAUDE_FLOW_GUIDE.md)