# Claude Flow Implementation Guide for WARP Platform

## Overview
This guide ensures the WARP project is optimally structured for Claude Flow with Hive-mind AI-driven development.

## Current Structure Assessment

### ✅ Strengths
1. **Comprehensive Documentation**
   - PRD.md (Product Requirements) - Well detailed
   - ARCHITECTURE.md - Technical architecture defined
   - BILLING_SYSTEM.md - Complex billing logic documented
   - BIGQUERY_CDR_ARCHITECTURE.md - Data pipeline specified
   - HOMER_TROUBLESHOOTING.md - Support tools documented

2. **API Specification**
   - OpenAPI 3.0.3 spec complete (openapi.yaml)
   - RESTful endpoints defined
   - NetSuite integration documented

3. **Infrastructure as Code**
   - Terraform modules organized
   - Kubernetes manifests present
   - Deployment scripts available

### ⚠️ Areas for Improvement

1. **Missing Implementation Roadmap**
2. **No explicit service boundaries**
3. **Database schemas need SQL files**
4. **Missing service implementation stubs**
5. **No test specifications**
6. **Lack of component interaction diagrams**

## Recommended Project Structure

```
sip_tg_iaas/
├── README.md                      # Project overview & quick start
├── CLAUDE_FLOW_GUIDE.md          # This guide
├── IMPLEMENTATION_ROADMAP.md     # Phased implementation plan
├── .env.example                   # ✅ Already exists
│
├── docs/                          # All documentation
│   ├── architecture/
│   │   ├── SYSTEM_OVERVIEW.md    # High-level architecture
│   │   ├── DATA_FLOW.md          # Data pipeline details
│   │   ├── SECURITY.md           # Security architecture
│   │   └── SCALABILITY.md        # Scaling strategies
│   │
│   ├── requirements/
│   │   ├── PRD.md                # ✅ Product requirements
│   │   ├── FUNCTIONAL_SPEC.md    # Detailed functional specs
│   │   └── USER_STORIES.md       # User stories for each role
│   │
│   ├── api/
│   │   ├── openapi.yaml          # ✅ OpenAPI specification
│   │   ├── WEBHOOKS.md           # Webhook specifications
│   │   └── ERROR_CODES.md        # Error handling guide
│   │
│   └── guides/
│       ├── DEPLOYMENT.md         # Deployment procedures
│       ├── TROUBLESHOOTING.md    # ✅ Homer integration
│       └── MONITORING.md         # Observability setup
│
├── infrastructure/                # All IaC code
│   ├── terraform/                 # ✅ GCP infrastructure
│   ├── kubernetes/                # K8s manifests
│   ├── docker/                    # Dockerfiles
│   └── scripts/                   # Deployment scripts
│
├── services/                      # Microservices
│   ├── api-gateway/              # API Gateway service
│   │   ├── README.md
│   │   ├── openapi.yaml
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── billing-engine/           # Rating & billing
│   │   ├── README.md
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── routing-engine/           # LCR & routing
│   │   ├── README.md
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── sip-controller/           # Kamailio management
│   │   ├── README.md
│   │   ├── configs/
│   │   └── scripts/
│   │
│   ├── media-processor/          # RTPEngine management
│   │   ├── README.md
│   │   ├── configs/
│   │   └── scripts/
│   │
│   ├── messaging-gateway/        # SMS/MMS/RCS
│   │   ├── README.md
│   │   ├── src/
│   │   └── tests/
│   │
│   └── data-pipeline/            # BigQuery ingestion
│       ├── README.md
│       ├── dataflow/
│       └── pubsub/
│
├── database/                      # Database schemas
│   ├── postgresql/
│   │   ├── 001_customers.sql
│   │   ├── 002_trunks.sql
│   │   ├── 003_routing.sql
│   │   └── 004_billing.sql
│   │
│   ├── bigquery/
│   │   ├── cdrs_schema.sql
│   │   ├── mdrs_schema.sql
│   │   └── views.sql
│   │
│   └── migrations/
│       └── flyway/
│
├── frontend/                      # Next.js application
│   ├── README.md
│   ├── src/
│   ├── components/
│   └── pages/
│
└── tests/                         # Integration tests
    ├── e2e/
    ├── load/
    └── scenarios/
```

## Implementation Roadmap for Claude Flow

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Set up core infrastructure and databases

**Tasks for Claude Flow**:
1. Deploy GCP infrastructure using Terraform
2. Set up GKE clusters with Autopilot
3. Deploy PostgreSQL and BigQuery schemas
4. Configure networking and security

**Key Files**:
- `infrastructure/terraform/`
- `database/postgresql/*.sql`
- `database/bigquery/*.sql`

### Phase 2: Core Services (Weeks 3-4)
**Goal**: Implement essential services

**Tasks for Claude Flow**:
1. API Gateway with authentication
2. Customer management service
3. Basic routing engine
4. Kamailio configuration

**Key Files**:
- `services/api-gateway/`
- `services/routing-engine/`
- `services/sip-controller/`

### Phase 3: Billing Integration (Weeks 5-6)
**Goal**: Rating engine and NetSuite integration

**Tasks for Claude Flow**:
1. Implement rating engine
2. NetSuite customer sync
3. Usage aggregation pipeline
4. Invoice generation workflow

**Key Files**:
- `services/billing-engine/`
- `services/data-pipeline/`

### Phase 4: Messaging Platform (Weeks 7-8)
**Goal**: SMS/MMS/RCS capabilities

**Tasks for Claude Flow**:
1. Jasmin SMSC deployment
2. Sinch integration
3. Message routing logic
4. DLR handling

**Key Files**:
- `services/messaging-gateway/`

### Phase 5: Monitoring & Support (Week 9)
**Goal**: Observability and troubleshooting

**Tasks for Claude Flow**:
1. Deploy Homer SIP capture
2. Configure Prometheus/Grafana
3. Set up alerting rules
4. Create support dashboards

**Key Files**:
- `infrastructure/kubernetes/monitoring/`
- `docs/guides/MONITORING.md`

### Phase 6: Frontend & Testing (Week 10)
**Goal**: Customer portal and testing

**Tasks for Claude Flow**:
1. Deploy Next.js application
2. Implement authentication flow
3. Create customer dashboards
4. Run integration tests

**Key Files**:
- `frontend/`
- `tests/`

## Service Implementation Templates

### Each Service Should Have:

```markdown
# Service: [Service Name]

## Purpose
Brief description of what this service does

## API Endpoints
- List of endpoints this service exposes
- Link to OpenAPI spec if applicable

## Dependencies
- Databases used
- External services called
- Internal services consumed

## Configuration
- Environment variables needed
- Config files required

## Deployment
- How to build
- How to deploy
- Health check endpoints

## Testing
- Unit test location
- Integration test requirements
- Test data setup
```

## Database Schema Organization

### PostgreSQL Schemas Needed:

```sql
-- 001_customers.sql
CREATE SCHEMA IF NOT EXISTS customers;

CREATE TABLE customers.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_number VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    -- etc.
);

-- 002_trunks.sql
CREATE SCHEMA IF NOT EXISTS trunks;

CREATE TABLE trunks.configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES customers.accounts(id),
    -- etc.
);
```

## Claude Flow Instructions File

Create `CLAUDE_INSTRUCTIONS.md`:

```markdown
# Instructions for Claude Flow Implementation

## General Principles
1. Always check existing code before creating new files
2. Follow the established patterns in the codebase
3. Use the technology stack defined in .env.example
4. Reference the PRD for business requirements
5. Consult ARCHITECTURE.md for technical decisions

## Service Development Order
1. Start with database schemas
2. Implement data models
3. Create service logic
4. Add API endpoints
5. Write tests
6. Update documentation

## Code Standards
- Go for high-performance services
- TypeScript for frontend and Node services
- Rust for critical performance paths
- Follow OpenAPI spec exactly

## Testing Requirements
- Unit tests for all business logic
- Integration tests for API endpoints
- Load tests for performance-critical paths

## Deployment Process
1. Build Docker images
2. Push to Artifact Registry
3. Deploy to GKE using kubectl
4. Verify health checks
5. Run smoke tests
```

## Hive-mind Coordination

### Task Distribution Strategy

```yaml
# hive-mind-tasks.yaml
agents:
  infrastructure_agent:
    focus: Terraform, Kubernetes, GCP
    files:
      - infrastructure/**
      - database/migrations/**

  backend_agent:
    focus: Go services, API implementation
    files:
      - services/api-gateway/**
      - services/billing-engine/**
      - services/routing-engine/**

  integration_agent:
    focus: External integrations
    files:
      - services/messaging-gateway/**
      - services/sip-controller/**
      - services/media-processor/**

  frontend_agent:
    focus: Next.js, React, TypeScript
    files:
      - frontend/**
      - docs/api/**

  testing_agent:
    focus: Test implementation
    files:
      - tests/**
      - services/**/tests/**
```

## Validation Checklist

Before Claude Flow begins implementation, ensure:

- [ ] All environment variables are documented in .env.example
- [ ] Database schemas are defined in SQL files
- [ ] API endpoints are specified in OpenAPI
- [ ] Service boundaries are clearly defined
- [ ] Test requirements are documented
- [ ] Deployment procedures are written
- [ ] Monitoring requirements are specified
- [ ] Security requirements are documented

## Success Metrics

Claude Flow implementation will be successful when:

1. **All services are deployable** - Each service can be built and deployed independently
2. **APIs match specification** - OpenAPI spec is fully implemented
3. **Tests pass** - All unit and integration tests are green
4. **Documentation is complete** - Every service has README and API docs
5. **Monitoring works** - Prometheus metrics and Homer capture are functional
6. **Billing flows** - CDRs flow to BigQuery and NetSuite integration works

## Next Steps for Project Owner

1. **Create missing SQL schema files** in `database/postgresql/`
2. **Define service boundaries** with README in each service directory
3. **Add test specifications** for critical paths
4. **Create implementation priority list** if different from roadmap
5. **Set up GCP project** and update .env.example with actual project IDs

## Questions for Claude Flow to Answer

When Claude Flow starts, it should determine:

1. Which language to use for each service (Go, Rust, TypeScript)
2. Whether to use gRPC or REST for internal communication
3. How to handle service discovery (Consul vs K8s native)
4. Caching strategy (Redis for everything or mixed)
5. Message queue choice (Pub/Sub vs Cloud Tasks)

## Reference Documentation Priority

Claude Flow should reference docs in this order:

1. **PRD.md** - Business requirements
2. **ARCHITECTURE.md** - Technical decisions
3. **openapi.yaml** - API contracts
4. **BILLING_SYSTEM.md** - Complex billing logic
5. **BIGQUERY_CDR_ARCHITECTURE.md** - Data pipeline
6. **.env.example** - Configuration requirements

This structure provides clear boundaries and implementation paths for Claude Flow with Hive-mind to efficiently build the WARP platform.