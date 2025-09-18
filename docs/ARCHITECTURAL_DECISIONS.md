# WARP Platform Architectural Decisions

## Date: January 2025

Based on PRD review and planning discussions, the following architectural decisions have been made:

## 1. Frontend Architecture

### Decision: Separate Applications
- **Customer Portal**: https://console.ringer.tel (`/frontend/`)
- **Admin Portal**: https://admin.ringer.tel (`/admin-frontend/`)
- **Rationale**: Complete isolation, different security requirements, independent deployment

## 2. Authentication Strategy

### Decision: Auth0 for All Authentication
- **Implementation**: Auth0 for both customer and admin portals
- **Features**: MFA, SSO, JWT tokens, RBAC
- **Alternative Considered**: Keycloak (more complex, self-hosted burden)
- **Rationale**: Managed service, quick implementation, proven scale

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
1. Auth0 integration
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
- **Details**: See [SIP_NETWORK_ARCHITECTURE.md](./SIP_NETWORK_ARCHITECTURE.md)

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
- **Details**: See [SMS_ARCHITECTURE.md](./SMS_ARCHITECTURE.md)

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

## 15. Billing Architecture

### Decision: Product-Specific Billers with Complex Rating
- **Separate Billers**: Voice, SMS, Telco Data API each have dedicated billing services
- **Rating Complexity**: Voice based on jurisdiction, NPANXX, not tied to routing partitions
- **Balance Storage**: PostgreSQL for consistency (not Redis)
- **Details**: See [BILLING_FLOWS.md](./BILLING_FLOWS.md) and [BILLING_PRD.md](../warp/docs/BILLING_PRD.md)

### Key Billing Principles
- **BAN-Centric**: All billing cycles tied to Billing Account Number
- **Zero Rating Failure Tolerance**: Failed rating blocks calls
- **NetSuite for Invoicing**: SKU-based, cannot handle complex voice rating
- **Vendor-Specific Cycles**: Weekly (Telnyx), Monthly (Peerless, Sinch)

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
- Deliverables: React applications, Grafana configs

## Communication Protocol

All agents will coordinate through:
- This ARCHITECTURAL_DECISIONS.md file
- PROGRESS.md for daily updates
- API contracts in /api/openapi.yaml
- Shared Prometheus metrics definitions

---
*Last Updated: January 2025*
*Next Review: After Phase 3 completion*