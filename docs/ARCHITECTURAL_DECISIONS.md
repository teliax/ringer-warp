# WARP Platform Architectural Decisions

## Date: January 2025

Based on PRD review and planning discussions, the following architectural decisions have been made:

## 1. Frontend Architecture

### Decision: Separate Applications
- **Customer Portal**: https://console.ringer.tel (`/frontend/`)
- **Admin Portal**: https://admin.ringer.tel (`/admin-frontend/`)
- **Rationale**: Complete isolation, different security requirements, independent deployment

## 2. Authentication Strategy

### Decision: Google Identity Platform for All Authentication
- **Implementation**: Firebase Auth/Identity Platform for both customer and admin portals
- **Features**: MFA, SSO, JWT tokens, RBAC, native GCP integration
- **Alternative Considered**: Auth0 (external dependency, added latency), Keycloak (self-hosted burden)
- **Rationale**: Native GCP service, no external latency, better integration, cost-effective

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
1. Kamailio deployment
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
2. LCR implementation
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
- Bearer tokens (JWT from Auth0)
- API rate limiting per customer
- IP allowlisting available
- Request signing for webhooks

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

## 14. SMS/MMS Architecture

### Decision: Jasmin SMSC with Sinch Integration
- **SMSC Platform**: Jasmin (open-source, scalable)
- **Carrier Integration**: Sinch via SMPP binds
- **Customer Access**: REST API (90%) and SMPP (10%)
- **Details**: See [SMS_ARCHITECTURE.md](../warp/docs/SMS_ARCHITECTURE.md)

### SMS Routing Strategy
- **A2P Messaging**: All outbound via Sinch
- **10DLC Registration**: Managed through Sinch TCR
- **Inbound**: Direct delivery to customer webhooks/SMPP
- **Queue Management**: RabbitMQ for reliable delivery

### Database Design
- **Separate Schema**: `sms` schema in PostgreSQL
- **Message Storage**: 30-day retention, then archive
- **Campaign Management**: 10DLC templates and registration
- **Rate Limiting**: Per-customer MPS limits

## 15. Frontend Integration Architecture

### Decision: API-First with Mock Data Replacement
- **Frontend Status**: Polymet-generated UI templates ready for API integration
- **Integration Pattern**: Replace mock data imports with API client calls
- **State Management**: React Query for all API state
- **Authentication**: Auth0 with JWT tokens
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

## 17. Secrets Management & Container Registry

### Decision: Google Secret Manager for All Credentials
- **All sensitive credentials** stored in Google Secret Manager
- **No secrets in `.env` files** - only non-sensitive configuration
- **Access pattern**: Applications use Application Default Credentials (ADC)
- **Secret naming convention**: `projects/{project-id}/secrets/{service}-credentials/versions/latest`
- **Rotation policy**: Automated rotation for database passwords, manual for API keys

### Secret Categories
1. **Authentication Secrets**
   - Auth0 credentials → `auth0-credentials`
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

3. **Infrastructure Secrets** (created during implementation)
   - Database passwords → `cloudsql-{db}-password`
   - Redis auth → `redis-auth-string`
   - Service mesh tokens → `consul-tokens`

### Decision: Google Artifact Registry for Container Images
- **Use Google Artifact Registry** (NOT Container Registry which is deprecated)
- **Registry location**: `us-central1-docker.pkg.dev`
- **Repository structure**: `{location}-docker.pkg.dev/{project-id}/warp-platform/{service}:{tag}`
- **Build for AMD64 architecture** (not ARM)
- **Image scanning**: Enabled for vulnerability detection

### Container Image Organization
```
us-central1-docker.pkg.dev/ringer-472421/warp-platform/
├── api-gateway:latest
├── billing-service:latest
├── routing-service:latest
├── kamailio:latest
├── rtpengine:latest
├── jasmin-smsc:latest
└── homer:latest
```

## 18. Frontend Hosting (Vercel)

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
VITE_AUTH0_DOMAIN=warp.us.auth0.com
VITE_AUTH0_CLIENT_ID=[from Auth0]
VITE_ENVIRONMENT=production
```

### Frontend Framework Note
- Using Vite + React (not Next.js)
- Environment variables use `VITE_` prefix for client-side access
- Vercel automatically handles Vite builds

## 19. Error Tracking

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
  - Setup Auth0 authentication
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