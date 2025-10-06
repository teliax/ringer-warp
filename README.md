# WARP - Wholesale Accounting Routing and Provisioning Platform

## 🚀 Overview
WARP is a carrier-grade SIP trunking and messaging platform designed for wholesale telecom carriers. It provides API-driven provisioning, real-time routing, comprehensive billing, and SMS/MMS/RCS capabilities.

## 📊 Current Status
**Project**: `ringer-warp-v01` (GCP)  
**Phase 1**: ✅ **100% COMPLETE** (Infrastructure)  
**Environment**: Production  
**SSL/HTTPS**: ✅ Enabled for all web services  

📄 **Status Reports**:
- [CURRENT_STATUS.md](CURRENT_STATUS.md) - Live deployment status
- [PHASE1_COMPLETE.md](PHASE1_COMPLETE.md) - Infrastructure completion report

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
- [Provider Modules Specification](docs/PROVIDER_MODULES_SPECIFICATION.md) - Plugin-based provider architecture
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
- **Orchestration**: Kubernetes (GKE Autopilot)
- **Databases**: PostgreSQL (Cloud SQL - customer data), BigQuery (CDR/MDR)
- **Cache/State**: Redis (Kamailio state, RTPEngine discovery, Jasmin queues)
- **Service Mesh**: Consul (RTPEngine, future use)
- **IaC**: Terraform (all infrastructure managed)

### Core Components
- **SIP Control**: Kamailio ✅ (3 pods, Redis-backed state)
- **Media Processing**: RTPEngine ✅ (mr13.4.1, 3 VMs, 10.0.1.0/24 subnet)
- **SMS Gateway**: Jasmin SMSC ✅ (2 pods, SMPP 34.55.43.157)
- **SIP Capture**: Homer ✅
- **API Gateway**: Go/Rust microservices 🔄 (Next priority)
- **Frontend**: React/Vite/TypeScript/Tailwind (Vercel) 🔄

### Integrations
- **Authentication**: Google Identity Platform (Firebase Auth)
- **Billing**: NetSuite
- **SMS Delivery**: Sinch
- **Telecom Data**: Telique API

## 🎉 Phase 1 Complete - Production Ready

**Infrastructure Status**: ✅ Fully deployed and operational  
**HTTPS Endpoints**: ✅ All services secured with SSL/TLS  
**Monitoring**: ✅ Prometheus & Grafana accessible  

### Production Endpoints
- **API**: https://api-v2.ringer.tel
- **Grafana**: https://grafana.ringer.tel  
- **Prometheus**: https://prometheus.ringer.tel

### Phase 2 Complete - Core Services Operational
Application deployment status:
- **Kamailio**: ✅ Deployed (3 pods, warp-core namespace)
  - Using Redis for shared state (db_redis module)
  - usrloc db_mode=3, dialog db_mode=1
  - Dynamic RTPEngine discovery via Redis
- **RTPEngine**: ✅ Deployed (mr13.4.1, 3 VMs on 10.0.1.0/24)
  - Terraform-managed infrastructure
  - Golden image deployment
  - Load balancing: Weight-based across 3 instances
  - Dynamic discovery via Redis rtpengine table
- **Jasmin SMSC**: ✅ Deployed (2 pods, messaging namespace)
  - External SMPP: 34.55.43.157:2775/2776
  - RabbitMQ and Redis integration
  - Sinch carrier integration ready
- **API Gateway**: 🔄 Next development target

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

### Accessing Production Environment

1. **Configure kubectl**:
```bash
export GCP_PROJECT_ID=ringer-warp-v01
gcloud config set project $GCP_PROJECT_ID
gcloud container clusters get-credentials warp-kamailio-cluster --zone us-central1
```

2. **Access Services**:
```bash
# View all services
kubectl get services --all-namespaces

# Check SSL certificates
kubectl get certificates --all-namespaces

# Monitor pods
kubectl get pods --all-namespaces
```

3. **Production URLs**:
- Grafana: https://grafana.ringer.tel (admin/prom-operator)
- Prometheus: https://prometheus.ringer.tel
- API: https://api-v2.ringer.tel

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

### Production Access Points
- **Grafana**: https://grafana.ringer.tel - Metrics dashboards  
- **Prometheus**: https://prometheus.ringer.tel - Metrics queries
- **API**: https://api-v2.ringer.tel - API endpoint
- **Portal**: https://app.warp.io - Customer interface (Phase 2)

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
- **Authentication**: Verify Google Identity Platform config
- **SIP Routing**: Check Kamailio logs and Homer
- **Billing**: Verify NetSuite credentials

## 📝 License
Proprietary - All rights reserved

## 🏢 About
Built for wholesale telecom carriers requiring enterprise-grade SIP trunking with comprehensive billing and support capabilities.

---

**Version**: 1.0.0  
**Phase 1 Status**: ✅ COMPLETE (Infrastructure)  
**Phase 2 Status**: 🚧 In Progress (Applications)  
  - RTPEngine: ✅ Deployed (3 production VMs)
  - Jasmin SMSC: 🚧 Next target
  - API Services: 🔄 Development
**Target Launch**: Q2 2025  

📚 **Key Documents**:
- [PHASE1_COMPLETE.md](PHASE1_COMPLETE.md) - Infrastructure completion report
- [CURRENT_STATUS.md](CURRENT_STATUS.md) - Live status updates
- [HIVEMIND_ORCHESTRATION_GUIDE.md](HIVEMIND_ORCHESTRATION_GUIDE.md) - AI implementation guide